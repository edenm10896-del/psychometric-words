"""Extract the word list from the source PDF into data/raw_words.json.

The PDF has two parts:
  * pages 1-8   : an alphabetical index (word - unit number)
  * pages 9-105 : 10 units, each row = word (with niqqud) + one or more definitions
Characters are stored in visual (LTR) order, so each line is reversed.
"""
import json, re, sys, unicodedata, collections
import pdfplumber

PDF = sys.argv[1]
OUT = sys.argv[2]
FIX = {'(cid:170)': 'נ', '(cid:205)': 'ך', '\ue802': 'ךְ'[::-1], '\ue804': 'לֹ'[::-1]}  # glyphs with no unicode mapping
MIRROR = str.maketrans('()[]', ')(][')

def line_text(chars):
    chars = sorted(chars, key=lambda c: c['_i'])  # content-stream order (visual)
    s = ''.join(FIX.get(c['text'], c['text']) for c in chars)[::-1]
    s = s.translate(MIRROR)
    # runs of digits / latin were reversed too: flip them back
    s = re.sub(r'[0-9A-Za-z.,:\-]*[0-9A-Za-z][0-9A-Za-z.,:\-]*', lambda m: m.group(0)[::-1] if re.search(r'[0-9A-Za-z]{2,}', m.group(0)) else m.group(0), s)
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'\(\s+', '(', s)
    s = s.replace("מָז' וֹר", "מָז'וֹר")  # spacing artifact in the PDF
    return re.sub(r'\s+', ' ', s).strip()

def group_lines(chars):
    lines = collections.OrderedDict()
    for c in chars:
        key = round(c['top'])
        # merge with an existing line within 2pt
        for k in lines:
            if abs(k - c['top']) < 2.5:
                key = k; break
        lines.setdefault(key, []).append(c)
    return sorted(lines.items())

pdf = pdfplumber.open(PDF)
entries = []
index = []
for pi, page in enumerate(pdf.pages):
    chars = [dict(c, _i=i) for i, c in enumerate(page.chars)]
    if pi < 8:
        # index pages: 4 columns, each item "word - N"
        for top, lc in group_lines([c for c in chars if c['top'] > 30]):
            # split into columns by x gaps
            lc.sort(key=lambda c: c['x0'])
            cols, cur = [], [lc[0]]
            for a, b in zip(lc, lc[1:]):
                if b['x0'] - a['x1'] > 25:
                    cols.append(cur); cur = []
                cur.append(b)
            cols.append(cur)
            for col in cols:
                t = line_text(col)
                index.append((pi + 1, top, col[0]['x0'], t))
        continue
    seps = sorted(r['top'] for r in page.rects if r['width'] > 300 and r['height'] < 1.5 and r['top'] > 74)
    boxes = sorted(r['top'] for r in page.rects if 385 < r['x0'] < 395 and 8 < r['height'] < 12)
    body = [c for c in chars if c['top'] > 74]
    for top, lc in group_lines(body):
        word = [c for c in lc if c['x0'] >= 425]
        defn = [c for c in lc if c['x1'] <= 388]
        other = [c for c in lc if c not in word and c not in defn]
        if other:
            print('WARN unclassified chars p%d' % (pi + 1), line_text(other), file=sys.stderr)
        new_entry = not entries or any(entries[-1]['_last'] < s < top for s in seps) or entries[-1]['_page'] != pi + 1
        if new_entry and not word:
            # continuation from previous page
            new_entry = False
        if new_entry:
            entries.append({'word_lines': [], 'defs': [], 'page': pi + 1, '_page': pi + 1, '_last': top})
        e = entries[-1]
        e['_page'] = pi + 1; e['_last'] = top
        if word:
            e['word_lines'].append(line_text(word))
        if defn:
            t = line_text(defn)
            has_box = any(abs(b - top) < 6 for b in boxes)
            if has_box or not e['defs']:
                e['defs'].append(t)
            else:
                e['defs'][-1] += ' ' + t

out = []
unit = None
for e in entries:
    w = ' '.join(e['word_lines'])
    m = re.match(r'^(\d+)יחידה\s*', w)
    if m:
        unit = int(m.group(1)); w = w[m.end():]
    out.append({'word': w, 'definitions': e['defs'], 'unit': unit, 'page': e['page']})
json.dump({'entries': out, 'index': index}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print('entries', len(out), 'index lines', len(index))
