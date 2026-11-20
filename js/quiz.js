/* Multiple-choice question builder with similarity-based distractors. */
(function () {
  'use strict';
  const STOP = new Set(('של את על עם או גם לא כל אל מן מה זה זו הוא היא הם כי אשר בו לו כמו בין כדי ' +
    'אחד אחת דבר משהו מישהו באופן בצורה שלו שלה ידי מאוד בדרך כלל יותר פחות').split(' '));
  const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

  const stripNiqqud = (s) => s.replace(/[֑-ׇ]/g, '');
  function skeleton(s) {
    return stripNiqqud(s).replace(/\(.*?\)/g, '').split('/')[0]
      .replace(/[ךםןףץ]/g, (c) => FINALS[c]).replace(/[^א-ת]/g, '');
  }
  function tokens(s) {
    return new Set(stripNiqqud(s).replace(/\(.*?\)/g, ' ').split(/[^א-ת]+/)
      .map((t) => t.replace(/^[והבלמש](?=[א-ת]{3,})/, ''))
      .filter((t) => t.length > 1 && !STOP.has(t)));
  }
  function overlap(a, b) {
    let n = 0; for (const t of a) if (b.has(t)) n++;
    return n / Math.max(1, Math.min(a.size, b.size));
  }
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const normDef = (d) => stripNiqqud(d).replace(/\s+/g, ' ').trim();

  let cache = null;
  function prep(words) {
    if (cache && cache.words === words) return cache;
    const info = new Map();
    for (const w of words) {
      info.set(w.id, {
        sk: skeleton(w.word),
        defTok: w.definitions.map(tokens),
        allTok: tokens(w.definitions.join(' ')),
        defs: new Set(w.definitions.map(normDef)),
      });
    }
    cache = { words, info };
    return cache;
  }

  /* Is candidate c (word) a possibly-correct answer for target t? */
  function conflicts(t, c, ti, ci, shownDef) {
    if (c.id === t.id) return true;
    if (ti.sk === ci.sk) return true; // same written word (different sense)
    if ((t.synonyms || []).includes(c.vocalized) || (c.synonyms || []).includes(t.vocalized)) return true;
    for (const d of ci.defs) if (ti.defs.has(d)) return true;
    // a definition of c that overlaps strongly with one of t's definitions
    for (const a of ti.defTok) for (const b of ci.defTok) if (a.size && b.size && overlap(a, b) >= 0.5) return true;
    if (shownDef) for (const b of ci.defTok) if (overlap(tokens(shownDef), b) >= 0.5) return true;
    return false;
  }

  function similarity(t, c, ti, ci) {
    let s = 0;
    const d = lev(ti.sk, ci.sk);
    const len = Math.max(ti.sk.length, ci.sk.length);
    s += Math.max(0, 1 - d / Math.max(3, len)) * 3; // looks alike
    if (t.root && c.root && t.root === c.root) s += 3; // same root
    if (ti.sk.slice(-3) === ci.sk.slice(-3) && ti.sk.length > 3) s += 0.5;
    s += Math.min(1, overlap(ti.allTok, ci.allTok) * 3) * 2; // same field (shared definition words)
    if (t.units.some((u) => c.units.includes(u))) s += 0.3;
    return s;
  }

  /**
   * build(target, words, {hard, dir})
   * dir 'w2d': show word, choose definition; 'd2w': show definition, choose word.
   */
  function build(target, words, opts) {
    const { info } = prep(words);
    const ti = info.get(target.id);
    const defIdx = Math.floor(Math.random() * target.definitions.length);
    const shownDef = target.definitions[defIdx];
    const scored = [];
    for (const c of words) {
      const ci = info.get(c.id);
      if (conflicts(target, c, ti, ci, opts.dir === 'd2w' ? shownDef : null)) continue;
      scored.push({ c, s: similarity(target, c, ti, ci), first: ci.sk[0] === ti.sk[0] });
    }
    let pick;
    if (opts.hard) {
      scored.sort((a, b) => b.s - a.s);
      pick = window.SRS.shuffle(scored.slice(0, 10)).slice(0, 3);
    } else {
      // learning stage: clearly different words (low similarity, different first letter)
      const easy = scored.filter((x) => x.s < 0.9 && !x.first);
      pick = window.SRS.shuffle(easy.length >= 3 ? easy : scored.sort((a, b) => a.s - b.s).slice(0, 40)).slice(0, 3);
    }
    // the options must also be distinct from each other
    const opts4 = [{ w: target, correct: true }];
    for (const p of pick) opts4.push({ w: p.c, correct: false });
    const options = window.SRS.shuffle(opts4).map((o) => ({
      id: o.w.id, correct: o.correct,
      text: opts.dir === 'w2d'
        ? (o.correct ? shownDef : o.w.definitions[Math.floor(Math.random() * o.w.definitions.length)])
        : o.w.word,
      vocalized: o.w.vocalized,
    }));
    return { target, dir: opts.dir, hard: opts.hard, shownDef, options };
  }

  window.Quiz = { build, skeleton };
})();
