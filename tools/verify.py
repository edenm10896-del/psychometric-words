"""Verify data/words.json against the source PDF extraction.

Checks:
  1. every one of the source entries (from the PDF) is represented,
     and the number of cards equals the number of unique words;
  2. every card has every required field with the right type;
  3. synonyms/antonyms point to words that exist in the list.
Prints a summary and exits non-zero on failure.
"""
import json, os, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = json.load(open(os.path.join(ROOT, 'data/source_words.json'), encoding='utf-8'))
data = json.load(open(os.path.join(ROOT, 'data/words.json'), encoding='utf-8'))
entries, words = src['entries'], data['words']
errors = []

index_items = [x for x in src['index'] if ' - ' in x[3]]
unique = {e['word'] for e in entries}
by_voc = {w['vocalized']: w for w in words}
missing = [e['word'] for e in entries if e['word'] not in by_voc]
lost_defs = [(e['word'], d) for e in entries if e['word'] in by_voc for d in e['definitions'] if d not in by_voc[e['word']]['definitions']]
if missing: errors.append(f'{len(missing)} source words missing: {missing[:5]}')
if lost_defs: errors.append(f'{len(lost_defs)} source definitions missing: {lost_defs[:3]}')
if len(words) != len(unique): errors.append(f'cards {len(words)} != unique source words {len(unique)}')
if len(entries) != len(index_items): errors.append(f'body entries {len(entries)} != index entries {len(index_items)}')
src_defs = sum(len(e['definitions']) for e in entries)

REQ = {'id': int, 'word': str, 'vocalized': str, 'showNiqqud': bool, 'definitions': list,
       'units': list, 'root': str, 'synonyms': list, 'antonyms': list, 'example': str,
       'needsReview': bool}
for w in words:
    for f, t in REQ.items():
        if f not in w: errors.append(f'{w.get("word")}: missing field {f}')
        elif not isinstance(w[f], t): errors.append(f'{w["word"]}: field {f} is not {t.__name__}')
    if not w.get('definitions') or not all(d.strip() for d in w['definitions']):
        errors.append(f'{w["word"]}: empty definition')
    for rel in ('synonyms', 'antonyms'):
        for x in w.get(rel, []):
            if x not in by_voc: errors.append(f'{w["word"]}: {rel} {x!r} not in list')
ids = [w['id'] for w in words]
if len(set(ids)) != len(ids): errors.append('duplicate ids')

units = collections.Counter(w['units'][0] for w in words)
ex = collections.Counter(w['units'][0] for w in words if w['example'])
print('=== Verification ===')
print(f'PDF index entries          : {len(index_items)}')
print(f'PDF unit entries           : {len(entries)}  (definitions: {src_defs})')
print(f'Merged duplicates          : {len(entries) - len(unique)}')
print(f'Cards in words.json        : {len(words)}  (definitions: {sum(len(w["definitions"]) for w in words)})')
print(f'All source words present   : {"yes" if not missing else "NO"}')
print(f'All source definitions kept: {"yes" if not lost_defs else "NO"}')
print(f'All required fields        : {"yes" if not any("field" in e for e in errors) else "NO"}')
print(f'needsReview                : {sum(w["needsReview"] for w in words)}')
print('Examples per unit          : ' + ', '.join(f'{u}: {ex[u]}/{units[u]}' for u in sorted(units)))
print(f'Total with example         : {sum(ex.values())}/{len(words)}')
if errors:
    print('\nFAILED:'); [print(' -', e) for e in errors[:30]]; sys.exit(1)
print('\nRESULT: OK')
