# Prompt for the designer · "How Golf Board maps a course's greens"

Paste everything below the line.

---

Make me **one visual explainer** of how Golf Board gets GPS yardages (front / middle / back of the green) for a golf
course. I'm the owner, not a developer: I want to understand the system at a glance and know what to do when a course
has no yardages. Plain words on the diagram, no code names except in small grey captions. Use the app's Night Round
look (dark, `--surface` cards, green only for the one "this is what the phone does on the course" highlight, amber only
for warnings / failure branches). One page, readable on a laptop; a phone-width version is a bonus.

## The story the visual tells

Two stages, drawn as two lanes:

**Lane A — Before the round: getting a course ready (done once per course, by me + Claude in a session).**
**Lane B — On the course: what the phone does (every round, automatic).**

### Lane A · Getting a course ready

Two things a course needs, side by side:

1. **The scorecard** (pars, handicaps, each tee's yardage per hole)
   - Normally from **OpenGolfAPI** (a free golf course database the app searches in Setup).
   - When that's down or wrong: **a photo of the printed scorecard** → typed into the app as a *built-in course*.
     Rule: the printed card wins over any website.
2. **The greens** (the shape of each green + where the tee boxes are), from the most reliable source to the least:
   1. **OpenStreetMap, the free world map.** Volunteers often draw a course's greens and tee boxes, sometimes with the
      hole numbers. Claude pulls them with one tool (`tools/osm-greens.mjs`) from OpenStreetMap's main server.
   2. **The check against the scorecard** (draw this as a gate every green passes through): does each hole's green
      exist, is it the size of a green (12–50 yards deep), and do the tee boxes measure the card's yardages? (On a
      dogleg the straight line runs a little short — that's fine.) Pass all 18 → ship it.
   3. **Ship it inside the app** ("built-in", like Twin Creeks and Firewheel Lakes): works with no signal on the course.
   4. **Fallback — AI from satellite photos** (only when nothing is mapped): a cloud function takes a satellite
      picture (Mapbox) and asks Claude to find the greens and tee boxes, then numbers the holes by matching the tee →
      green lengths to the scorecard. Show this as a *draft* path: its result goes back through the same scorecard
      gate, and holes that don't pass are left off rather than shown wrong.

Add a small "when it fails" strip under Lane A, with what happened at Firewheel Lakes (Nov 7) as the example:

| What we tried | What happened | What we do now |
|---|---|---|
| Course search (OpenGolfAPI) | Their server was down | Scorecard photo → built-in course |
| Scorecard websites | Wrong handicaps, a par that contradicted itself | Trust the printed card |
| OpenStreetMap's lookup service | Down / timed out | Use OpenStreetMap's main server instead |
| AI from satellite | Saw 9 of 18 greens, guessed 5 hole numbers | Draft only; never shipped without the card check |
| Numbering greens by length alone | Holes 5–18 shuffled | Use the mapper's hole numbers when they exist; check every hole |

### Lane B · On the course

A simple left-to-right flow:

1. **Setup: pick the course** → the app looks for its greens in this order: **inside the app** (built-in) → **saved on
   this phone** from an earlier round → **the shared course list in the cloud** (`course_geo`) → **ask the cloud
   function to build them** (Lane A's fallback, in the background).
2. **Enter screen open** → the phone's **GPS** turns on (only while Enter is on screen, to save battery).
3. **Yardage card**: from where you're standing to the green's **front, middle and back**, plus a little drawing of the
   green split into three bands. It hides itself when: there are no greens for this course, GPS yardages are turned
   off for the round (Host → Rules), or you're more than ~600 yards from the hole (so nothing shows at home).
4. GPS states as small chips: *finding you* · *weak signal* (more than ±15 yards) · *location blocked*.

### One callout box: "A course has no yardages — what now?"

1. Send Claude a photo of the scorecard.
2. Claude checks OpenStreetMap for the course's greens (one command) and the scorecard check.
3. All 18 pass → built into the app → live after a refresh.
4. Not mapped? The AI draft, checked hole by hole; or map the greens on OpenStreetMap once (helps every app).

## Facts to keep exact

- Twin Creeks and Firewheel Lakes have built-in greens; every other course depends on OpenStreetMap or the AI draft.
- The cloud function is `course-geo` (Supabase). Its keys (Mapbox for satellite photos, Anthropic for the AI) are
  stored on Supabase, never in the app.
- Yardages are measured on the phone from its own GPS; no score or location is sent anywhere for that.
- Source for all of this: `docs/design/yardages/NOTES.md` (§7 the cloud function, §9 the playbook).

Deliver: the visual (HTML or an image), plus a one-paragraph caption I can read out loud.
