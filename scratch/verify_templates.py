import re

with open('js/gfx/items.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Check all array definitions of 16x16
arrays = re.findall(r'var\s+([A-Z_]+)\s*=\s*\[(.*?)\];', code, re.DOTALL)
print(f'Found {len(arrays)} template arrays')
errors = 0
for name, body in arrays:
    rows = [r.strip().strip("'").strip('"') for r in body.split(',') if r.strip()]
    if len(rows) != 16:
        print(f'ERROR: {name} has {len(rows)} rows, expected 16')
        errors += 1
    for r_idx, r in enumerate(rows):
        if len(r) != 16:
            print(f'ERROR: {name} row {r_idx} has length {len(r)}, expected 16: "{r}"')
            errors += 1

if errors == 0:
    print('ALL 16x16 templates verified perfectly!')
else:
    print(f'Found {errors} template errors')
