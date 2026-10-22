# Builds css/tokens.css from docs/design/design-system/tokens.css: the variable blocks byte for byte,
# the 6 type styles under our .ts- prefix (the system's bare names collide with app classes).
import re, sys
src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
root = re.search(r':root\{.*?\n\}', s, re.S).group(0)
light = re.search(r'html\.light, \[data-theme="light"\]\{.*?\n\}', s, re.S).group(0)
types = re.findall(r'^\.(number-xl|label|title|row|body|small)\{(.*?)\}$', s, re.M)
assert root and light and len(types) == 6, (bool(root), bool(light), len(types))
lines = ["/* Golf Live Board design tokens. The two variable blocks are copied byte for byte from",
         "   docs/design/design-system/tokens.css (tests/tokens.test.mjs fails if they drift). The 6 type",
         "   styles are the system's, under our .ts- prefix: its bare class names (.title, .row, .body, .small,",
         "   .label) collide with class names the app already uses. Labels are uppercase (README → Type). */",
         root, light, "/* Type styles: the only 6 */"]
for name, decl in sorted(types, key=lambda t: ['number-xl', 'title', 'row', 'body', 'small', 'label'].index(t[0])):
    extra = ';text-transform:uppercase' if name == 'label' else ''
    lines.append('.ts-%s{%s%s}' % (name, decl, extra))
open(out, 'w').write('\n'.join(lines) + '\n')
print('wrote', out)
