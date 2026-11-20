/* UI: home, flashcards, multiple choice, settings. */
(function () {
  'use strict';
  const S = window.SRS;
  const app = document.getElementById('app');
  const GRADES = [[1, 'שוב'], [2, 'קשה'], [3, 'טוב'], [4, 'קל']];

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  }
  function render(...nodes) { app.replaceChildren(...nodes); window.scrollTo(0, 0); }
  function toast(msg) {
    const t = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(t); setTimeout(() => t.remove(), 2600);
  }
  const display = (w) => (w.showNiqqud ? w.vocalized : w.word);
  function fmtInterval(ms) {
    const m = ms / 60000;
    if (m < 1) return 'פחות מדקה';
    if (m < 60) return Math.round(m) + ' דק׳';
    const hr = m / 60;
    if (hr < 24) return Math.round(hr) + ' שע׳';
    const d = hr / 24;
    if (d < 1.5) return 'יום';
    if (d < 30) return Math.round(d) + ' ימים';
    if (d < 365) { const mo = Math.round(d / 30); return mo === 1 ? 'חודש' : mo + ' חוד׳'; }
    return 'שנה+';
  }
  function topbar(title, extra) {
    return h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'חזרה למסך הבית', onclick: home }, '→'),
      h('h1', null, title), extra || null);
  }
  function applyTheme() {
    const t = S.p.settings.theme || 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  function unitsText(w) {
    return w.units.length > 1 ? 'יחידות ' + w.units.join(' ו-') : 'יחידה ' + w.units[0];
  }
  function exampleNode(w) {
    const ex = w.example; const plain = w.word.split(' / ')[0].replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const i = plain.length > 1 ? ex.indexOf(plain) : -1;
    if (i < 0) return h('div', { class: 'example' }, ex);
    return h('div', { class: 'example' }, ex.slice(0, i), h('mark', null, plain), ex.slice(i + plain.length));
  }
  const relWords = (list) => list.map((v) => { const w = S.words.find((x) => x.vocalized === v); return w ? display(w) : v; }).join('، ');

  /* The details shown on the back of a card / after a quiz answer */
  function details(w, opts) {
    opts = opts || {};
    const rec = S.rec(w.id);
    const hard = S.isHard(w.id);
    const hint = S.hints[w.id] || S.hints[w.vocalized];
    return [
      opts.showWord ? h('div', { class: 'word small' }, display(w)) : null,
      h('div', { class: 'voc' }, w.vocalized),
      h('ol', { class: 'defs' }, w.definitions.map((d) => h('li', null, d))),
      w.example ? h('div', { class: 'section' }, h('div', { class: 'h' }, 'משפט לדוגמה'), exampleNode(w)) : null,
      w.root ? h('div', { class: 'section' }, h('div', { class: 'h' }, 'שורש'), w.root) : null,
      w.synonyms.length ? h('div', { class: 'section' }, h('div', { class: 'h' }, 'מילים נרדפות מהרשימה'), relWords(w.synonyms)) : null,
      w.antonyms.length ? h('div', { class: 'section' }, h('div', { class: 'h' }, 'הפכים מהרשימה'), relWords(w.antonyms)) : null,
      hard ? h('div', { class: 'section' }, h('div', { class: 'h' }, 'רמז זיכרון'),
        h('div', { class: 'hint' }, hint || 'זו מילה קשה במיוחד (' + rec.fails + ' טעויות). רמז זיכרון ייכתב לה בסבב העדכון הבא.')) : null,
      w.needsReview ? h('div', { class: 'section review-note' }, '⚠︎ מסומנת לבדיקה: ' + (w.reviewNote || 'הפירוש דורש בדיקה')) : null,
    ];
  }

  /* ---------- home ---------- */
  function home() {
    const c = S.counts();
    const streak = S.streak();
    const pct = Math.round((c.known / S.words.length) * 100);
    const newBlocked = c.review > 0 && c.newLeftToday > 0;
    const hardN = S.hardIds().length;
    render(
      h('div', { class: 'topbar' }, h('div', { style: 'flex:1' }),
        h('button', { class: 'icon-btn', 'aria-label': 'הגדרות', onclick: settings }, '⚙︎')),
      h('div', { class: 'hero' }, h('h1', null, 'מילים לפסיכומטרי'),
        h('p', null, new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }))),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('div', { class: 'n' }, c.dueTotal), h('div', { class: 'l' }, 'חזרות מחכות היום')),
        h('div', { class: 'stat' }, h('div', { class: 'n' }, c.newLeftToday), h('div', { class: 'l' }, 'מילים חדשות להיום')),
        h('div', { class: 'stat' }, h('div', { class: 'n' }, c.known), h('div', { class: 'l' }, 'מילים שאני יודע')),
        h('div', { class: 'stat' }, h('div', { class: 'n' }, c.remaining), h('div', { class: 'l' }, 'עוד לא נלמדו')),
        h('div', { class: 'stat wide' },
          h('div', { class: 'row' },
            h('div', null, h('div', { class: 'n' }, '🔥 ' + streak), h('div', { class: 'l' }, streak === 1 ? 'יום ברצף' : 'ימים ברצף')),
            h('div', { style: 'text-align:left' }, h('div', { class: 'n' }, pct + '%'), h('div', { class: 'l' }, 'מתוך ' + S.words.length + ' מילים'))),
          h('div', { class: 'bar' }, h('i', { style: 'width:' + pct + '%' })))),
      c.backlog ? h('div', { class: 'banner' }, 'הצטברו ' + c.review + ' חזרות. מילים חדשות יחזרו אחרי שתסיים את החזרות, והחזרות שאיחרו הכי הרבה מוצגות ראשונות.')
        : newBlocked ? h('div', { class: 'banner' }, 'המילים החדשות יוצגו אחרי החזרות.') : null,
      c.laterLearning && !c.dueTotal ? h('div', { class: 'banner' }, c.laterLearning + ' מילים בשלבי לימוד יחזרו בעוד כמה דקות.') : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: study },
          'כרטיסיות', h('small', null, c.dueTotal || c.newLeftToday ? (c.dueTotal + c.newLeftToday) + ' להיום' : 'סיימת להיום')),
        h('button', { class: 'btn', onclick: () => quiz() }, 'מבחן אמריקאי'),
        hardN ? h('p', { class: 'pill', style: 'text-align:center' }, hardN + ' מילים קשות במיוחד') : null),
    );
  }

  /* ---------- flashcards ---------- */
  let lastId = null;
  function study() {
    const nx = S.next(lastId);
    if (!nx) return doneScreen();
    const w = S.word(nx.id);
    const c = S.counts();
    const kindTag = { new: h('span', { class: 'tag new' }, 'מילה חדשה'), review: h('span', { class: 'tag' }, 'חזרה'), learning: h('span', { class: 'tag' }, 'בלימוד') }[nx.kind];
    const counter = h('span', { class: 'pill' }, 'חזרות ' + c.dueTotal + ' · חדשות ' + c.newLeftToday);
    const card = h('div', { class: 'card' },
      h('div', { class: 'meta' }, kindTag, S.isHard(w.id) ? h('span', { class: 'tag hard' }, 'קשה במיוחד') : null, h('span', { class: 'tag' }, unitsText(w))),
      h('div', { class: 'word' }, display(w)));
    const bottom = h('div', { class: 'bottom' },
      h('button', { class: 'btn primary', onclick: reveal }, 'הצג'));
    render(topbar('כרטיסיות', counter), card, bottom);

    function reveal() {
      card.querySelector('.word').classList.add('small');
      card.append(...details(w).filter(Boolean));
      const pv = S.preview(w.id);
      bottom.replaceChildren(h('div', { class: 'grades' }, GRADES.map(([g, label]) =>
        h('button', { class: 'grade g' + g, onclick: () => { S.grade(w.id, g); lastId = w.id; study(); } },
          label, h('span', null, fmtInterval(pv[g]))))));
    }
  }
  function doneScreen() {
    const c = S.counts();
    render(topbar('כרטיסיות'), h('div', { class: 'done' },
      h('div', { class: 'big' }, '🎉'),
      h('h2', null, 'סיימת את המנה של היום'),
      h('p', null, c.laterLearning ? c.laterLearning + ' מילים בשלבי לימוד יחזרו בעוד כמה דקות.' : 'אפשר לתרגל במבחן האמריקאי, או לחזור מחר.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: () => quiz() }, 'מבחן אמריקאי'),
        h('button', { class: 'btn', onclick: home }, 'למסך הבית'))));
  }

  /* ---------- multiple choice ---------- */
  const qs = { right: 0, total: 0, recent: [] };
  function pickQuizTarget() {
    const ids = Object.keys(S.p.cards).map(Number);
    if (!ids.length) return null;
    const fresh = ids.filter((id) => !qs.recent.includes(id));
    const pool = fresh.length ? fresh : ids;
    const due = pool.filter((id) => S.isDue(id));
    const from = due.length && Math.random() < 0.7 ? due : pool;
    return from[Math.floor(Math.random() * from.length)];
  }
  function quiz() {
    const id = pickQuizTarget();
    if (id == null) {
      return render(topbar('מבחן אמריקאי'), h('div', { class: 'done' },
        h('h2', null, 'עוד אין מילים לתרגול'), h('p', null, 'המבחן האמריקאי מתרגל מילים שכבר פגשת. התחל בכרטיסיות.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: study }, 'לכרטיסיות'))));
    }
    qs.recent = [id].concat(qs.recent).slice(0, Math.min(8, Math.floor(Object.keys(S.p.cards).length / 2)));
    const w = S.word(id);
    const rec = S.rec(id);
    const hard = (rec.correct || 0) >= 2;
    const dir = Math.random() < 0.5 ? 'w2d' : 'd2w';
    const words = S.words.map((x) => S.word(x.id));
    const q = window.Quiz.build(w, words, { hard, dir });
    const wasDue = S.isDue(id);

    const score = h('span', { class: 'pill score' }, qs.right + '/' + qs.total);
    const question = h('div', { class: 'question' },
      h('div', { class: 'prompt' }, dir === 'w2d' ? 'מה פירוש המילה?' : 'איזו מילה מתאימה לפירוש?'),
      dir === 'w2d' ? h('div', { class: 'q' }, display(w)) : h('div', { class: 'q def' }, q.shownDef),
      h('div', { style: 'margin-top:8px' }, h('span', { class: 'tag' }, hard ? 'מסיחים קשים' : 'שלב לימוד')));
    const feedback = h('div', { class: 'feedback' });
    const buttons = q.options.map((o) => h('button', {
      class: 'opt' + (dir === 'd2w' ? ' word-opt' : ''), onclick: () => answer(o),
    }, dir === 'd2w' ? display(S.word(o.id)) : o.text));
    render(topbar('מבחן אמריקאי', score), question, h('div', { class: 'options' }, buttons), feedback);

    function answer(o) {
      buttons.forEach((b, i) => {
        b.disabled = true; b.style.opacity = 1;
        if (q.options[i].correct) b.classList.add('correct');
        else if (q.options[i] === o) b.classList.add('wrong');
      });
      qs.total++; if (o.correct) qs.right++;
      score.textContent = qs.right + '/' + qs.total;
      if (wasDue) S.grade(id, o.correct ? 3 : 1); // counts as the scheduled review
      else { S.recordStat(id, o.correct); S.markActivity(); }
      const wrongW = !o.correct ? S.word(o.id) : null;
      feedback.replaceChildren(
        h('div', { class: 'card', style: 'min-height:0' },
          h('div', { class: 'meta' }, h('span', { class: 'tag' + (o.correct ? '' : ' hard') }, o.correct ? 'נכון!' : 'לא נכון'),
            S.isHard(id) ? h('span', { class: 'tag hard' }, 'קשה במיוחד') : null),
          ...details(w, { showWord: true }).filter(Boolean),
          wrongW ? h('div', { class: 'section' }, h('div', { class: 'h' }, 'בחרת: ' + display(wrongW)), wrongW.definitions.join(' · ')) : null),
        h('div', { class: 'bottom' }, h('button', { class: 'btn primary', onclick: quiz }, 'הבא')));
      feedback.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* ---------- settings ---------- */
  function settings() {
    const out = h('output', null, S.p.settings.newPerDay);
    const setN = (d) => {
      S.p.settings.newPerDay = Math.max(0, Math.min(200, S.p.settings.newPerDay + d));
      out.textContent = S.p.settings.newPerDay; S.save();
    };
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'ערכת צבעים' },
      [['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']].map(([v, l]) =>
        h('button', { 'aria-pressed': String((S.p.settings.theme || 'auto') === v), onclick: (e) => {
          S.p.settings.theme = v; S.save(); applyTheme();
          seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
        } }, l)));
    const file = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: importFile });
    const hard = S.hardIds().map((id) => S.word(id));
    render(
      topbar('הגדרות'),
      h('div', { class: 'panel' }, h('h2', null, 'מילים חדשות ביום'),
        h('div', { class: 'row' }, h('p', null, 'כמה מילים חדשות להכניס כל יום'),
          h('div', { class: 'stepper' }, h('button', { 'aria-label': 'פחות', onclick: () => setN(-5) }, '−'), out,
            h('button', { 'aria-label': 'יותר', onclick: () => setN(5) }, '+')))),
      h('div', { class: 'panel' }, h('h2', null, 'מראה'), seg),
      h('div', { class: 'panel' }, h('h2', null, 'גיבוי ההתקדמות'),
        h('p', null, 'ההתקדמות נשמרת במכשיר הזה. כדאי לייצא קובץ גיבוי מדי פעם.'),
        h('div', { class: 'actions', style: 'margin-top:10px' },
          h('button', { class: 'btn', onclick: exportFile }, 'ייצוא לקובץ'),
          h('button', { class: 'btn', onclick: () => file.click() }, 'ייבוא מקובץ'), file)),
      hard.length ? h('div', { class: 'panel' }, h('h2', null, 'מילים קשות במיוחד (' + hard.length + ')'),
        h('p', null, 'מילים שטעית בהן 5 פעמים ומעלה. הרמזים להן ייכתבו בסבב הבא.'),
        h('ul', { class: 'list' }, hard.map((w) => h('li', null, display(w) + ' — ' + S.rec(w.id).fails + ' טעויות')))) : null,
      h('div', { class: 'panel' }, h('h2', null, 'איפוס'),
        h('p', null, 'מוחק את כל ההתקדמות במכשיר הזה.'),
        h('button', { class: 'btn danger', style: 'margin-top:8px', onclick: () => {
          if (confirm('למחוק את כל ההתקדמות? מומלץ לייצא גיבוי קודם.')) { S.reset(); toast('ההתקדמות אופסה'); home(); }
        } }, 'איפוס ההתקדמות')),
      h('p', { class: 'pill', style: 'text-align:center' }, S.words.length + ' מילים · חזרה מרווחת FSRS'),
    );
  }
  function exportFile() {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const name = 'psy-words-backup-' + S.dayKey() + '.json';
    const f = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f], title: name }).catch(() => {});
      return;
    }
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    toast('קובץ הגיבוי נשמר');
  }
  function importFile(e) {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => {
      if (!confirm('הייבוא יחליף את ההתקדמות הנוכחית. להמשיך?')) return;
      S.importJSON(t); applyTheme(); toast('ההתקדמות יובאה'); home();
    }).catch((err) => toast('שגיאה בייבוא: ' + err.message));
  }

  /* ---------- boot ---------- */
  Promise.all([
    fetch('data/words.json').then((r) => r.json()),
    fetch('data/hints.json').then((r) => r.json()).catch(() => ({})),
  ]).then(([data, hints]) => {
    S.init(data.words, hints);
    applyTheme();
    home();
  }).catch((e) => render(h('div', { class: 'done' }, h('h2', null, 'שגיאה בטעינת המילים'), h('p', null, String(e)))));

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.App = { home, study, quiz, settings };
})();
