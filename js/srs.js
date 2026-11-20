/* Progress storage, FSRS scheduling and the daily study queue. */
(function () {
  'use strict';
  const F = window.FSRS;
  const KEY = 'psy-words-progress-v1';
  const BACKLOG_LIMIT = 150;
  const LEARN_AHEAD_MS = 60 * 1000; // only pull a card forward by up to a minute, so the 10-minute step is kept
  const HARD_FAILS = 5;

  const scheduler = F.fsrs(F.generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  }));

  const pad = (n) => String(n).padStart(2, '0');
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function endOfToday() {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  }

  function shuffle(a, rnd) {
    rnd = rnd || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function freshProgress() {
    return { version: 1, settings: { newPerDay: 20, theme: 'auto' }, cards: {}, days: {}, newOrder: null, edits: {} };
  }

  const S = {
    words: [], byId: new Map(), hints: {}, p: freshProgress(),
    HARD_FAILS, BACKLOG_LIMIT, scheduler, dayKey, shuffle,

    init(words, hints) {
      this.words = words;
      this.byId = new Map(words.map((w) => [w.id, w]));
      this.hints = hints || {};
      this.load();
      if (!this.p.newOrder || this.p.newOrder.length !== words.length) this.p.newOrder = this.buildNewOrder();
      this.save();
    },

    /* New words: unit 1..10 in order, random order inside each unit (fixed once). */
    buildNewOrder() {
      const byUnit = {};
      for (const w of this.words) (byUnit[w.units[0]] = byUnit[w.units[0]] || []).push(w.id);
      return Object.keys(byUnit).map(Number).sort((a, b) => a - b).flatMap((u) => shuffle(byUnit[u]));
    },

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) this.p = Object.assign(freshProgress(), JSON.parse(raw));
      } catch (e) { console.warn('load failed', e); }
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.p)); } catch (e) { console.warn('save failed', e); }
    },
    exportJSON() {
      return JSON.stringify(Object.assign({ app: 'psy-words', exportedAt: new Date().toISOString() }, this.p), null, 1);
    },
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || typeof d !== 'object' || !d.cards || !d.settings) throw new Error('הקובץ אינו גיבוי תקין של האפליקציה');
      this.p = Object.assign(freshProgress(), d);
      delete this.p.app; delete this.p.exportedAt;
      if (!this.p.newOrder || this.p.newOrder.length !== this.words.length) this.p.newOrder = this.buildNewOrder();
      this.save();
    },
    reset() { this.p = freshProgress(); this.p.newOrder = this.buildNewOrder(); this.save(); },

    /* ---- per-card state ---- */
    rec(id) { return this.p.cards[id]; },
    fsrsCard(r) {
      const c = Object.assign({}, r.c);
      c.due = new Date(c.due);
      if (c.last_review) c.last_review = new Date(c.last_review);
      return c;
    },
    isHard(id) { const r = this.rec(id); return !!r && r.fails >= HARD_FAILS; },
    word(id) {
      const w = this.byId.get(id);
      const e = this.p.edits[id];
      return e ? Object.assign({}, w, e) : w;
    },

    today() {
      const k = dayKey();
      return this.p.days[k] || (this.p.days[k] = { newCount: 0, reviews: 0 });
    },

    /* preview: what each of the 4 buttons would do */
    preview(id) {
      const r = this.rec(id);
      const card = r ? this.fsrsCard(r) : F.createEmptyCard(new Date());
      const now = new Date();
      const res = scheduler.repeat(card, now);
      const out = {};
      for (const g of [1, 2, 3, 4]) out[g] = res[g].card.due - now;
      return out;
    },

    /* grade: 1 again, 2 hard, 3 good, 4 easy */
    grade(id, g) {
      const now = new Date();
      let r = this.rec(id);
      const isNew = !r;
      if (!r) r = this.p.cards[id] = { c: F.createEmptyCard(now), fails: 0, correct: 0, introduced: dayKey(now) };
      const res = scheduler.next(this.fsrsCard(r), now, g);
      r.c = res.card;
      this.recordStat(id, g > 1);
      const t = this.today();
      if (isNew) t.newCount++;
      t.reviews++;
      this.save();
    },

    /* stats only (used by quiz on a card that isn't due) */
    recordStat(id, ok) {
      const r = this.rec(id);
      if (!r) return;
      if (ok) r.correct = (r.correct || 0) + 1;
      else r.fails = (r.fails || 0) + 1;
      r.lastSeen = Date.now();
    },
    markActivity() { this.today().active = true; this.save(); },

    isDue(id, now) {
      const r = this.rec(id);
      if (!r) return false;
      now = now || new Date();
      const due = new Date(r.c.due);
      if (r.c.state === F.State.Review) return due <= endOfToday();
      return due <= now; // learning / relearning
    },

    /* ---- queue ---- */
    counts() {
      const now = new Date(), eod = endOfToday();
      let learning = 0, review = 0, known = 0, laterLearning = 0;
      for (const id in this.p.cards) {
        const c = this.p.cards[id].c, due = new Date(c.due);
        if (c.state === F.State.Review) {
          known++;
          if (due <= eod) review++;
        } else if (due <= now) learning++;
        else laterLearning++;
      }
      const introduced = Object.keys(this.p.cards).length;
      const t = this.today();
      const backlog = review > BACKLOG_LIMIT;
      const newLeftToday = Math.max(0, Math.min(this.p.settings.newPerDay - t.newCount, this.words.length - introduced));
      return { learning, review, known, laterLearning, introduced, remaining: this.words.length - introduced,
        newToday: t.newCount, newLeftToday, backlog, dueTotal: learning + review };
    },

    nextNewId() {
      for (const id of this.p.newOrder) if (!this.p.cards[id]) return id;
      return null;
    },

    /* returns {id, kind:'learning'|'review'|'new'} or null */
    next(excludeId) {
      const now = new Date(), eod = endOfToday();
      const learning = [], reviews = [], ahead = [];
      for (const k in this.p.cards) {
        const id = Number(k);
        const c = this.p.cards[k].c, due = new Date(c.due);
        if (c.state === F.State.Review) { if (due <= eod) reviews.push({ id, due }); }
        else if (due <= now) learning.push({ id, due });
        else if (due - now <= LEARN_AHEAD_MS) ahead.push({ id, due });
      }
      const notEx = (x) => x.id !== excludeId;
      // 1. learning steps that are due now
      const l = learning.filter(notEx).sort((a, b) => a.due - b.due);
      if (l.length) return { id: l[0].id, kind: 'learning' };
      // 2. reviews before new words. Backlog: most overdue first; otherwise mixed.
      const rv = reviews.filter(notEx);
      if (rv.length) {
        if (reviews.length > BACKLOG_LIMIT) { rv.sort((a, b) => a.due - b.due); return { id: rv[0].id, kind: 'review' }; }
        return { id: rv[Math.floor(Math.random() * rv.length)].id, kind: 'review' };
      }
      // 3. new words, only once no reviews are waiting
      if (!reviews.length && this.counts().newLeftToday > 0) {
        const id = this.nextNewId();
        if (id != null) return { id, kind: 'new' };
      }
      // 4. learn ahead (soonest learning card within 20 minutes)
      const a = ahead.concat(learning).filter(notEx).sort((x, y) => x.due - y.due);
      if (a.length) return { id: a[0].id, kind: 'learning' };
      if (excludeId != null && (learning.length || reviews.length || ahead.length)) return { id: excludeId, kind: 'learning' };
      return null;
    },

    /* ms until the next learning-step card is due (null if none) */
    nextLearningWait() {
      let min = null; const now = Date.now();
      for (const k in this.p.cards) {
        const c = this.p.cards[k].c;
        if (c.state === F.State.Review) continue;
        const d = new Date(c.due) - now;
        if (min == null || d < min) min = d;
      }
      return min == null ? null : Math.max(0, min);
    },

    streak() {
      const active = (k) => { const d = this.p.days[k]; return d && (d.reviews > 0 || d.active); };
      const d = new Date();
      if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
      let n = 0;
      while (active(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },

    hardIds() { return Object.keys(this.p.cards).map(Number).filter((id) => this.isHard(id)); },
  };

  window.SRS = S;
})();
