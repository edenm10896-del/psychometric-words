"""Convert a batch TSV (data/enrich/src/unitNN.tsv) into data/enrich/unitNN.json.

Rows follow the order of the unit's cards in data/words.json; the first column
(word without niqqud) must match, so a misaligned row fails loudly.
"""
import json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
unit = int(sys.argv[1])
src = os.path.join(ROOT, f'data/enrich/src/unit{unit:02d}.tsv')
W = json.load(open(os.path.join(ROOT, 'data/words.json'), encoding='utf-8'))['words']
cards = [w for w in W if w['units'][0] == unit]
rows = [l.rstrip('\n') for l in open(src, encoding='utf-8') if l.strip() and not l.startswith('#')]
if len(rows) != len(cards):
    sys.exit(f'unit {unit}: {len(rows)} rows but {len(cards)} cards')
def key(s):
    return re.sub(r'[\s\-]', '', s.replace('וו', 'ו').replace('יי', 'י'))
out = {}
for i, (r, w) in enumerate(zip(rows, cards), 1):
    f = r.split('|')
    if len(f) != 7:
        sys.exit(f'row {i}: expected 7 fields, got {len(f)}: {r}')
    word, niq, root, syn, ant, review, ex = [x.strip() for x in f]
    if key(word) != key(w['word']):
        sys.exit(f'row {i}: {word!r} does not match card {w["word"]!r}')
    e = {'showNiqqud': niq == '1', 'root': root,
         'synonyms': [s.strip() for s in syn.split(';') if s.strip()],
         'antonyms': [s.strip() for s in ant.split(';') if s.strip()],
         'example': ex, 'needsReview': bool(review)}
    if review:
        e['reviewNote'] = review
    out[w['vocalized']] = e
json.dump(out, open(os.path.join(ROOT, f'data/enrich/unit{unit:02d}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'unit {unit}: {len(out)} cards enriched')
