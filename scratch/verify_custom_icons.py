import re

with open('js/gfx/items.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Match icon('name', [...], pal)
pattern = r"icon\(\s*['\"]([^'\"]+)['\"]\s*,\s*\[(.*?)\]\s*,"
custom_icons = re.findall(pattern, code, re.DOTALL)
print(f'Found {len(custom_icons)} custom icons')

errors = 0
for name, body in custom_icons:
    rows = [r.strip().strip("'").strip('"') for r in body.split(',') if r.strip()]
    if len(rows) != 16:
        print(f'ERROR in {name}: has {len(rows)} rows')
        errors += 1
    for r_idx, r in enumerate(rows):
        if len(r) != 16:
            print(f'ERROR in {name} row {r_idx}: len {len(r)} ("{r}")')
            errors += 1

if errors == 0:
    print('ALL custom icon rows verified 16x16 with zero errors!')
else:
    print(f'Found {errors} errors in custom icons')
