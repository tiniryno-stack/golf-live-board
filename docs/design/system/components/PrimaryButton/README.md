The one main action on a screen, full width at the bottom: "Start round · 5 players", "Next: pick a game", "Next hole".

**Consumer provides:** the label (say what happens, with the count or who's left when useful) and onPress.

**Rules**
- Height `button-primary` (60px; 56–58px on Enter where space is tight), `radius-xl`, `button-lg` type.
- Ready: `button` fill, `on-button` text. Waiting on something: `surface-2` fill, `text-muted` label that says what's missing ("Next hole · Sean left", "Fix 3 things to continue").
- Only one per screen. Secondary actions are `surface-1` rows or outlined `line` buttons.
