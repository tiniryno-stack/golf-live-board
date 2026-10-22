A ranked team row on the Board: position, team name, players and record, a progress bar, and points.

**Consumer provides:** position, team (name, players, color, yours or not), record, holes played, official points and provisional points.

**Rules**
- Points use `title` size in mono, in the team’s color; your row gets a `tint-you` background and a small YOU tag.
- The bar shows official points solid and provisional points hatched (diagonal stripes in the same color).
- Provisional points also get a dashed `text-muted` tag ("+1½ prov") under the total. Provisional = from a rotation still in play.
- Rows are separated by `line` hairlines, not boxed.
