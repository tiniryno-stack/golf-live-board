# 023 mockups (reference only)

Open in a browser straight from this folder (`npm install` first so the Geist fonts under node_modules load; tokens come from `../../../design-system/tokens.css`). Each state is a JSON object in the URL hash. The files also still carry the options the council rejected (chips, marks, live dots, other Enter depths) — only the states below are the design.

## matches.html

| Frame | Hash |
|---|---|
| 01 waiting on them | `#{"v":"text","state":"live"}` |
| 02 their scores in | `#{"v":"text","state":"theirs"}` |
| 03 counted, low ball tied | `#{"v":"text","state":"counted"}` |
| 04 counted, they took low ball | `#{"v":"text","state":"lostlb"}` |
| 05 new since you looked | `#{"v":"text","state":"newsince"}` |
| 06 a finished rotation | `#{"v":"text","state":"other"}` |
| light | add `"light":true` to any of them |

## enter-d1.html (needs greencard.css beside it)

| Frame | Hash |
|---|---|
| 10 card, scores picked | `#{"concept":"a","depth":"d1","ry":true,"group":true,"up":-2,"a":3,"b":5}` |
| 11 light | same, plus `"light":true` |

Paste the hash URL-encoded if your browser doesn't take raw JSON (or append it and reload).
