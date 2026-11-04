A thin row of 18 segments under the Enter card: where you are in the round, with a gap where each rotation ends.

**Consumer provides:** holes done, the current hole, where the gaps go (after 6 and 12 for three rotations; at the turn for a 9-hole game), and the sync state.

**Rules**
- 18 segments, 6px tall, 3px radius, 3px gaps; an extra 8px gap starts each new set of holes.
- Done: `text-muted`. Current: `text`. Ahead: `surface-2`.
- To the right, the sync state in `small` `text-muted`: "● Synced", "2 unsynced", "Reconnecting". Never green or red.
- It sits between the cards and Next hole; it never pushes Enter into scrolling.
