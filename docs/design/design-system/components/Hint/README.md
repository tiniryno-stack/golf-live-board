Small guidance under a choice (a lightbulb hint) and the amber box for problems that block progress.

**Consumer provides:** the text; for a problem box, a heading and the list of problems.

**Rules**
- Hint: 13px `text-muted` with a 16px lightbulb icon in `text-muted` (never green: green means you). It says only what the currently selected option means and changes when the selection changes. One sentence, two at most.
- Problem box: `warn-bg` fill, 1.5px `warn` outline, heading in `warn`. Each problem is plain English with the fix ("Hole 7 has no par."). The primary button stays disabled and says how many are left.
- The organizer-only box (admin PIN, host link) uses the same amber, with a dashed outline and "screenshot this, keep it private".
- Never use `double` (red) for warnings.
