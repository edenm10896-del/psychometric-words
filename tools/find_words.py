"""Helper: look up candidate words (without niqqud) in data/words.json."""
import json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(os.path.join(ROOT, 'data/words.json'), encoding='utf-8'))['words']
def norm(s):
    s = re.sub(r'[֑-ׇ]', '', s)
    return s.replace('וו', 'ו').replace('יי', 'י').strip()
idx = {}
for w in W:
    for part in [w['word']] + re.split(r'\s*/\s*', w['word']) + [re.sub(r'\s*\(.*?\)\s*', ' ', w['word']).strip()]:
        idx.setdefault(norm(part), set()).add(w['vocalized'])
for q in sys.argv[1:]:
    hit = idx.get(norm(q))
    if hit: print(q, '->', ' ; '.join(sorted(hit)))
