"""Build data/words.json from data/source_words.json + data/enrich/*.json.

* Exact duplicates (same vocalized word) are merged into one card that keeps
  every definition and lists all units it appears in.
* Enrichment files (one per batch) are keyed by the vocalized word as it
  appears in the source and may set: showNiqqud, root, synonyms, antonyms,
  example, needsReview, reviewNote.
"""
import json, glob, re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NIQQUD = re.compile(r'[֑-ׇ]')

def plain(s):
    return NIQQUD.sub('', s)

src = json.load(open(os.path.join(ROOT, 'data/source_words.json'), encoding='utf-8'))['entries']
words, by_voc = [], {}
for e in src:
    w = by_voc.get(e['word'])
    if w is None:
        w = {'id': len(words) + 1, 'word': plain(e['word']), 'vocalized': e['word'],
             'definitions': [], 'units': [], 'sourcePages': []}
        words.append(w); by_voc[e['word']] = w
    w['definitions'].extend(d for d in e['definitions'] if d not in w['definitions'])
    if e['unit'] not in w['units']:
        w['units'].append(e['unit'])
    w['sourcePages'].append(e['page'])

enrich = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'data/enrich/*.json'))):
    for k, v in json.load(open(f, encoding='utf-8')).items():
        if k not in by_voc:
            sys.exit(f'{os.path.basename(f)}: unknown word {k!r}')
        if k in enrich:
            sys.exit(f'{os.path.basename(f)}: word {k!r} enriched twice')
        enrich[k] = v

for w in words:
    x = enrich.get(w['vocalized'], {})
    w['enriched'] = bool(x)
    # until a batch decides, keep the source niqqud visible (safer than guessing)
    w['showNiqqud'] = x.get('showNiqqud', True)
    w['root'] = x.get('root', '')
    w['synonyms'] = x.get('synonyms', [])
    w['antonyms'] = x.get('antonyms', [])
    w['example'] = x.get('example', '')
    w['needsReview'] = x.get('needsReview', False)
    if x.get('reviewNote'):
        w['reviewNote'] = x['reviewNote']
    for rel in ('synonyms', 'antonyms'):
        for t in w[rel]:
            if t not in by_voc:
                sys.exit(f'{w["vocalized"]}: {rel} {t!r} is not a word in the list')

out = {'version': 1, 'count': len(words), 'sourceEntries': len(src), 'words': words}
with open(os.path.join(ROOT, 'data/words.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(f'{len(src)} source entries -> {len(words)} cards, enriched: {sum(w["enriched"] for w in words)}')
