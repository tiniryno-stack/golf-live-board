# 036 · Landscape cards, chrome packs, the Passport and course stamps

Status: approved by Andrew Nov 24, 2026 for an overnight build. Not built yet.

Changes 035 (`docs/design/features/035-scorecard-locker/`, live on `main`). 035 is not edited; where this SPEC and 035
disagree, this SPEC wins. Everything in 035 that this SPEC does not mention stays as it is: the grading rules (launch
ladder, your normal, rookie cards), `card_opens`, `open_card`, the admin list, offline opens, Home staying exactly as
it was if the locker can't load.

One sentence: cards turn sideways with the whole scorecard on the front and a "who you played with" back, packs become
horizontal chrome foil packs you open by swiping across the top, and the Locker gets a second tab, the **Passport**, a
book of course stamps (cut from each club's real logo) and milestone stamps that is also your profile and your
friends' profiles.

---

## 0. Read this first (for the engineer)

- **Every screen in this SPEC has an approved prototype in this folder.** The table in §11 says which file is the
  truth for which part. Open them in a browser (they are self-contained HTML, no server needed).
- **`components/` holds the code lifted from those prototypes**: CSS, markup builders and the controllers (tear,
  tilt, page turn). Port it into the app's files; rename freely. The prototypes use plain DOM; the app's screens
  return HTML strings and wire actions through the global action table (`lk-*` for the locker), so follow 035's
  patterns (`js/screens/locker.js`, `js/screens/pack.js`).
- **`components/stamps.js` + `components/stamps-data.js` are ready to drop in** as `js/stamps.js` and
  `js/stamps-data.js` (pure, tested by hand; add the unit test in §12).
- **No database change.** Everything new is derived from `events` + `scores` + `card_opens`, all already readable by
  the browser. No migration, no RPC.
- **Do not touch** score entry, sync, joining or the engine beyond what §9 says. No smoke run is needed unless a
  change reaches those (it shouldn't).
- Run `npm test` only (CLAUDE.md → Testing). Do not push to `main` without Andrew's OK.

---

## 1. Decisions (Andrew, Nov 24)

| # | Decision |
|---|---|
| 1 | **Cards are landscape (7 : 5)** with the **whole scorecard on the front**: big gross, course, date, to-par, the 18 scores with score marks, out/in totals, up to two milestone pills. Portrait cards are retired. |
| 2 | **Finishes stay metal, in the dark-metal family.** Standard is flat black. **Gold is the bright gold.** Prismatic is a dark card whose colour **comes from tilting it**, not a painted rainbow. |
| 3 | **Prismatic = oil slick bands + colour-shifting ink + a soft flash when it moves.** **Every other grade also gets sliding bands, in its own metal colour** (Andrew: "the bands should be only on prismatic and every grade"; read as: bands on all grades, colour only on Prismatic. See §13, Q1). |
| 4 | **The back of the card = who you played with (left) + stats (right).** Small groups list everyone in large type; big groups list as many ranked names as fit in small type, always showing your place. |
| 5 | **No course art on the cards.** Watercolour, posters, two-ink prints and course pictures were explored and dropped. Pictures of courses belong to the passport stamps only. |
| 6 | **Packs are horizontal chrome refractor foil packs**, same shape as the card, so the card slides straight out with no turn. **No course branding on the pack.** The real Golf Live Board mark (ring + green ball) is on every pack. |
| 7 | **Opening = swipe across the top.** A glowing dashed line marks the strip; the pack cuts under your finger, the cut edge curls up, at the end the strip peels away upward and flies off. Holding the pack still works as a fallback. |
| 8 | **The reveal = the card lands, then whatever the round earned is stamped under it** (milestone stamps, and a course stamp the first time you finish 18 somewhere). That screen is the thing people share. |
| 9 | **Flow A: the Locker has two tabs, Cards and Passport.** Home stays quiet (a packs card when packs wait, one Locker row). |
| 10 | **The Passport is a book you swipe through** (pages turn on the spine): cover, holder page (you), courses, milestones. **No "rounds" page**: rounds and history are the cards; the passport is achievements, like Strava badges. |
| 11 | **The Passport replaces the plain profile.** Your avatar opens your passport. **Tapping a friend's name** on the Board or Season standings opens **their** passport (and their cards), read-only. |
| 12 | **Course stamps look like real passport stamps in a single ink**, and their picture is **the club's own logo emblem, icon only, no words**. The stamp prints the course name, city and the date you first played there in its own type. |
| 13 | **68 DFW + Austin courses are hard-coded** with their emblems (§7). Courses not in the library get an automatic monogram stamp. Adding a course later = collect its logo, cut the emblem, add a line. |
| 14 | **Milestone pills stay on the card** and the same milestones are also rubber stamps in the passport. |
| 15 | **Share** = the card. A framed share image of the reveal (card + stamps) and a share of your passport page. |
| 16 | Andrew's group is the audience now ("me and my friends"). Scaling to strangers is far off; don't design for it. |

---

## 2. The card

### 2.1 Front (prototype: `five-grades.html`, layout from `twin-creeks-art.html` "Where we were")

Landscape, `aspect-ratio: 7 / 5`, every size in `cqw` (container = the card face), so one markup works in the
carousel, the grid, the pack and the share image. Components: `components/card-front.css`, `card-front.js`.

```
┌──────────────────────────────────────────────┐
│ ◯• GOLF LIVE BOARD                  PRISMATIC │  brand row (real mark), finish name (none on Standard)
│ 87   Twin Creeks                              │  gross 25cqw · course 4.8cqw · "+15 · Nov 20, 2026"
│      +15 · Nov 20, 2026                       │
│      [BROKE 90] [LOWEST ROUND YET]            │  up to 2 milestone pills (035 stamps)
│ ─────────────────────────────────────────── │
│ 1  2  3  4  5  6  7  8  9  OUT                │  hole numbers 1.9cqw
│ 6 (3) 4  4  4 [7] 4 [6] 6   44                │  score marks: ○ birdie, ◎ eagle, □ bogey, ■ double+
│ 10 … 18  IN                                   │
│ 5  3  4 [6] 5  4 [6] 5  5   43                │
│ ANDREW           WITH THE CREW          NO. 5 │
└──────────────────────────────────────────────┘
```

- Score marks: the same rules as 035 (`kind(s, par)`): eagle or better = double circle, birdie = circle, par = bare,
  bogey = outline square in the soft ink, double or worse = filled square in the ink (text in `--m-inv`).
- **Brand mark:** replace 035's `MARK` with the real mark from `img/mark-dark.svg`: ring stroke 13 at (42, 58) r 30
  in the card ink, ball r 11 at (82, 20) in `#3DDC84` (`--cart-you`). Use it on cards, packs and the passport cover.
- Pills: 035's `.lk-st`, smaller (`.x-stamps .lk-st`).

### 2.2 Finishes (prototype: `five-grades.html`)

All five are dark metal: a 135° gradient body and a light "metal" ink. Exact values (`components/card-front.js`
`GRADE`):

| Grade | Body (`--m-base`) | Ink (`--m-ink`) | `--m-inv` | Sheen |
|---|---|---|---|---|
| Prismatic | `#1a1b24 → #33344a → #1a1b24` | colour-shifting (below) | `#1a1b24` | .25 |
| Gold | `#4a3806 → #b0871a → #4a3806` | `#fff0b4` | `#4a3806` | .45 |
| Silver | `#2a3546 → #687a92 → #2a3546` | `#f5f9ff` | `#2a3546` | .40 |
| Bronze | `#3a200f → #804923 → #3a200f` | `#ffc79a` | `#3a200f` | .35 |
| Standard | `#141518 → #26282d → #141518` | `#b4b9c1` | `#141518` | .20 |
| Rookie | unchanged from 035 (paper) | | | |

`--m-soft` = ink at 64 %, `--m-edge` = ink at 30 % (`color-mix`). `--m-emboss: 0 -1px 0 rgba(0,0,0,.55)`,
`--m-grain: .5`. The 035 `holo` / `facet` layers are **removed** (no painted rainbow, no diamond pattern).

**Prismatic** (Andrew picked "Shift + soft flash" *and* "Oil slick"; build both together):
1. **Oil slick bands** `.x-slick`: soft bands of colour (`mix-blend-mode: screen`), `background-position` follows the
   tilt `--sx`.
2. **Colour-shifting ink:** `--m-ink: hsl(calc(230 + var(--sx) * 150) 95% 82%)` plus a faint tinted glow
   `linear-gradient(120deg, hsl(<same hue> 90% 60% / .2), transparent 62%)` over the body.
3. **Soft flash** `.x-prism`: a thin feathered rainbow streak, `opacity: var(--mv)`, where `--mv` is how fast the
   card is moving (0 at rest). It only appears while the card moves.

**Every other grade:** `.x-mslick`, the same sliding bands but in the grade's own ink (white-ish on Silver, gold on
Gold…), never multicolour. Standard gets none.

**Tilt input** (`components/card-front.js` end): `--sx`, `--sy` in −1…1, eased (0.16 per frame), `--mv` decays at
0.93 per frame. In the app, feed it from 035's tilt loop (phone tilt after the iPhone permission tap, pointer
otherwise, slow idle sway). Reduced motion: no sway, no flash, bands at rest.

### 2.3 Back (prototype: `card-back-big-group.html`; 5-player version in `reveal-back-book.html` Part 2 #1)

Tap to flip (035's flip). Left column = the people, right column = the round in numbers. Components:
`components/card-back.css`, `card-back.js`.

**Right column, always:** finish name (kicker) and one line (grade reason for small groups: 035's `c.line`, e.g. "Your
best of your first 5 rounds"; for groups of 7+: "11th of 16 on the day"), then four tiles (Birdies+, Pars, Bogeys,
Doubles+, from `cardStats`), then a row: Par 3s / Par 4s / Par 5s against par and Front · back totals.

**Left column:**

| Players who finished 18 | Left column |
|---|---|
| 1 (solo) | "Solo round" and nothing else (keep the stats) |
| 2–6 | Kicker "Played with · Nov 20", every player in large type (3.3cqw), sorted by gross, you in bold; "Low round of the group" under it when you were lowest |
| 7+ | Kicker "16 played · Nov 7"; a ranked list in small type (2.7cqw) with the rank number; ties share a rank (three players at 94 are all "5") |

**Fitting the big list** (`rows()` in `card-back.js`, `CAP = 11` rows fit the column):
- Your rank ≤ CAP: rows 1…CAP, then "+ N more played".
- Your rank > CAP: rows 1…7, a "···" gap, then the player above you, you, the player below you, then "+ N more played"
  if anyone is left.
- A small dot `●` after the names in **your tee time** (same group: `scoring.sameFoursome(roster, settings, you, them,
  1)`), and "· ● your tee time" appended to the last line.
- Players who did not finish 18 are left out of the list and the count.

Real checks: Nov 7 Firewheel Lakes (code `AMTXQ`), 16 players, Andrew 100 = 11th, Harold 76 low. Nov 20 Twin Creeks
(`R866T`), 5 players: Andrew 87, Justin 91, Sean 94, Mitchell 94, Baker 108.

**Not on the back (later):** who won the game that day (needs the engine's match result), photos.

---

## 3. The pack (prototype: `chrome-packs-2.html`)

Components: `components/pack.css`, `pack.js`. Replaces 035's portrait pack art; the overlay plumbing
(`toasts.showPack` / `closePack`, `#overlay`, `open_card` sent at the tear, offline pending) stays.

### 3.1 Look

- **Horizontal**, `aspect-ratio: 8.4 / 6.2`, width `min(92%, 400px)`, centred in the overlay.
- **Two pieces**: a top strip (`--tt: 15%` of the height) and the body, each with a zig-zag crimp edge (CSS masks)
  and a ridged crimp band (`repeating-linear-gradient`).
- **Chrome body**: one chrome gradient whose dark horizon sits right at the tear line (`#eef1f5 0%, #8d95a0 7%,
  #3a3f47 13%, #23262c 15.6%, #f6f8fa 17%, #c9cfd6 40%, #e9ecf0 66%, #aab1bb 86%, #dfe3e8 100%`). The top strip and
  body share it (`background-size` 666.7 % on the strip, 117.65 % on the body, positioned top and bottom).
- **Refractor**: a pattern layer plus a faint rainbow (`.refract`, `mix-blend-mode: color`, opacity .2) that slides
  with the tilt, plus the moving sheen.
- **Pattern**: Andrew approved the set without naming one. **Default: Fine line** (`.p-fine`). The other seven
  (Bold stripe, Brushed, Wave, Shimmer, Speckle, Atomic, Sapphire) are in the prototype; keep the CSS so Andrew can
  switch with one constant (`PACK_PATTERN`). See §13, Q2.
- **Face**: kicker "SCORECARDS · SERIES 1", the real mark (ring in the dark ink, ball green), "Golf Live / Board"
  (800, −0.25cqw, title case), "2026 Edition", a "1 CARD" pill. **No course name, no logo, no date on the pack.** In
  the Locker's packs grid the course and date go *under* each pack as a label (035 §7.2), not on it.

### 3.2 The tear (swipe) — exact behaviour

```
sealed ──swipe on the strip──▶ cutting ──reach 94 %──▶ separate (620 ms) ──▶ fly (520 ms) ──▶ reveal
   └──── hold anywhere on the body for 1.3 s (fallback) ───────────────▲
```

1. **Sealed.** A dashed line glows along the tear line with a light running along it (1.6 s loop), and a "Swipe to
   open" chip sits under the right end. Pack sways with the tilt.
2. **Touch.** A pointer down in the **top 36 %** of the pack starts a swipe; the side you start on (left or right
   half) sets the direction. A pointer down lower starts the hold fallback (left to right).
3. **Cutting.** `p` = how far the cut has run (0…1), only ever increases, follows the finger x. The strip is drawn
   twice: the uncut part stays sealed (`clip-path`), the cut part lifts **upward**, hinged at the finger:
   `transform-origin: <finger x> 100%`, `rotate(±(1.5 + 5p)°, capped at 6°)` (positive when cutting from the left,
   negative from the right: the far end rises), `rotateX(12 + 18p deg)` with `perspective(70cqw)` (the edge curls
   back), `translateY(-10p %)`, brightness `1 + .12p`. A dark slit with a light lower lip shows along the cut, and a
   small spark sits at the fingertip. The dashed line only shows ahead of the finger.
   - **Bug fixed in the last round:** the rotation sign was backwards and the strip tipped down. Rotation must lift
     the cut end.
4. **Finish** at `p > 0.94`. **Separate**: the whole strip peels up and back, 620 ms `cubic-bezier(.25,.7,.3,1)`
   to `translateY(-70%) rotate(±5°) rotateX(38°)`, hinged at the far edge.
5. **Fly** (starts at 650 ms): 520 ms to `translate(±60%, -420%) rotate(±26°) rotateX(60°)`, fading out, in the
   swipe direction. The body drops away (700 ms, starts 380 ms after fly begins).
6. **Card out.** The card sits inside the pack, clipped to the opening (only the part above the tear shows), rises
   46 % during the fly, then at **1650 ms** the clip is removed and it springs to its resting place (800 ms,
   `cubic-bezier(.25,1.25,.4,1)`) with a white flash. No rotation: the pack is already sideways.
7. **Stamps land** from 2550 ms, one every 420 ms, each a 380 ms "thump" (scale 1.8 → 1, slight overshoot), then the
   result appears.

`open_card` is sent at step 4 (the moment the strip separates), as 035 sends it at the tear.

Hold fallback: `p` grows at 1/1300 ms while held, with a growing jitter, stops (does not shrink) on release.
Reduced motion: a tap opens it; every step is a 150 ms fade (035 §6).

Keep 035's grade celebrations (gold flash and overshoot, prismatic rays, rings and sparks) layered on step 6; they
were not redesigned.

### 3.3 The reveal screen (prototypes: `chrome-packs-2.html` end state, `reveal-back-book.html` Part 1)

```
            [ the card, landscape ]
   [ BROKE 90 stamp ]  [ LOWEST ROUND · 87 stamp ]     ← milestones the round earned (rubber stamps, §6.3)
           or  [ course stamp, ring/oval/box ]          ← first finished round at this course (§7)
        PRISMATIC · S · YOU SHOT 87
        [ Add to locker ]                 (primary)
        [ Share ]  [ See in passport ]
        Open next pack · 2 left           (when more wait)
```

- What lands: the round's passport-worthy stamps (§6.3), plus the course stamp when this is the first card at that
  course. Up to two side by side; three or more wrap to a second row.
- **Share** builds a PNG with a canvas (follow `js/screens/recap.js`): framed, the player's name and date on top, the
  card, the stamps, "◯• Golf Live Board · Scorecard No. 5" at the bottom (prototype: `reveal-back-book.html` Part 1 #3
  "Share card"). Then `navigator.share({ files })`, falling back to saving the image.
- **See in passport** closes the overlay and opens the Passport on the page that got the new stamp.

---

## 4. Where it lives: flow A (prototype: `flows.html` → "A · Two tabs")

### 4.1 Home (`js/screens/home.js`)

Unchanged from 035 except the Locker row's subline: "5 scorecards · 3 courses · 4 milestones" (counts from §6). The
packs card and the pack thumbnail use the new horizontal chrome pack.

### 4.2 Locker (`#/locker`)

- Title "Locker", a two-tab segment **Cards | Passport** under it (the existing one-at-a-time / all toggle moves into
  the Cards tab), the **Packs · N** pill and the ⓘ sheet as in 035.
- **Cards tab:** 035's carousel and grid with the landscape card. Carousel slot width = the screen width minus the
  gutter peek; the grid becomes one column of landscape cards (two columns are too small for the scores). Tap flips.
- **Passport tab:** the book (§5).
- Remember the last tab in `app.ui` (in memory).

### 4.3 Profiles

- **You:** the Home avatar opens `#/passport` (your book, on the holder page). In a round, the existing "You" sheet
  (`sheets.js` `you`) keeps its actions and gets a first row "Your passport" (§13, Q4).
- **Friends:** a person's name on the Board standings, Matches and Season standings becomes a button →
  `#/passport/<personId>`: their book, read-only, with a **Cards** tab showing their opened cards (sealed packs show as
  sealed and cannot be opened; 035's admin view-as already does this, now for everyone). Names without a `personId`
  (old rounds) are not tappable.
- Routes (`js/app.js` `parseHash`): `#/passport` (mine), `#/passport/<personId>`. Keep `#/locker/p/<id>` working
  (redirect to the passport).
- Loading another person's locker: `loadLocker(app, personId)` already works for any personId (anon reads).

---

## 5. The Passport book (prototypes: `reveal-back-book.html` Part 3, `passport-booklet.html`)

Components: `components/passport.css`, `passport.js`, `stamps.css`, `stamps.js`.

### 5.1 The book

- Pages are stacked; each turns on the left spine: `transform-origin: left center`, `rotateY(-176deg)`, 760 ms
  `cubic-bezier(.3,.1,.2,1)`, `backface-visibility: hidden`, `perspective: 1700px` on the book, aspect 5 : 7.2,
  rounded `6px 16px 16px 6px`.
- Tap the right 60 % = next page, the left 40 % = back; a swipe > 30 px turns too. A caption under the book: "Cover ·
  tap to open", "You · page 1 of 3", "Courses · page 2 of 3"…
- Dark pages (the app's `--surface-1` with faint guilloche rings). **Cover: navy with gold** (`linear-gradient(135deg,
  #1b2a4a, #0f1830)`, ink `#f6d98a`): the mark, "GOLF LIVE BOARD", "PASSPORT", the holder's name (§13, Q5).
- Reduced motion: pages swap with a 150 ms fade.

### 5.2 Pages, in order

1. **Cover.**
2. **Holder (you).** A photo box with the initials (no photos yet), Name, Since (first round in the app), Best round
   ("87 · Twin Creeks"), Rounds, Courses; **Showcase**: three cards (best grade, then lowest gross; newest; your best
   round), not pinned by hand in this build (§13, Q3); "Cards in the locker": a tally per grade (Prism, Gold, Silver,
   Bronze, Std) in each grade's ink; the machine-readable line at the bottom
   (`GLB<<DUONG<<ANDREW<<<5RDS<3CRS<<ISSUED16OCT2026<<<…`).
3. **Courses** (one or more pages, 4 stamps per page): every course you finished 18 at, as its course stamp (§7),
   dated by your first round there, placed crooked and slightly overlapping (rotation −6…7°, positions from the slug
   hash so they never move), with "N visits · best 87" in small type under each (optional, see prototype
   `passport-booklet.html`). A dashed circle "Your next course" fills the next free spot.
4. **Milestones** (one or more pages): rubber stamps (§6.3), newest at the bottom, then dashed outlines for the goals
   not earned yet (Broke 80, Eagle, …).

Tapping a course stamp or milestone opens the card it came from (in the Cards tab).

---

## 6. Rules (pure; add to `js/locker.js` / `js/stamps.js`, tested)

### 6.1 Cards

035 §3 unchanged. Add to each card: `courseObj` (= `event.course`) so stamps can match it, and for the back: `group`
= every roster player with 18 strokes in that round: `{ personId, name, gross, rank, sameTeeTime }`.

**Loading change:** the back needs everyone's gross, so `db.fetchPersonRounds` fetches **each event's whole score
set** (`.eq('event_id', id)`, ≤ 16 × 18 = 288 rows), one query per event, in parallel. Still never one query across
all events (the 1,000-row limit; 035 §4.2).

### 6.2 Passport pages: `passportOf(cards)` in `components/stamps.js`

- **Courses:** one entry per `courseKey`, `first` = date of the first round there, `visits`, `best` (lowest gross).
- **Milestones** (from the cards' stamps, 035 §3.4):
  - once ever: **First birdie**, **Broke 100**, **Broke 90**, **Broke 80**, the first **Eagle**;
  - every time: **Lowest round** (one stamp per personal best, labelled "Lowest round · 87");
  - **"Best at <course>" is not a milestone**: the course stamp already shows your best there.
- Goals shown as outlines: `MILESTONE_GOALS` minus the ones earned.

Andrew's real passport (check against it): courses **Twin Creeks** (3 visits, best 87, first 16 Oct 2026),
**Bridlewood** (1, 97, 20 Oct), **Firewheel Lakes** (1, 100, 7 Nov). Milestones: **Lowest round · 93** (31 Oct),
**First birdie** (31 Oct, Twin Creeks hole 6), **Broke 90** (20 Nov), **Lowest round · 87** (20 Nov). Outlines:
Broke 80, Eagle (Broke 100 never fired: his first round was already 97).

### 6.3 Milestone stamps (rubber stamps)

`pp-rs` in `components/passport.css`: a rectangle (or pill for "First birdie") with a double border, big mono
uppercase title, a small line "20 NOV 2026 · TWIN CREEKS · 87", rotated −6…6°, the rough-edge filter, one ink:

| Milestone | Ink (dark page) |
|---|---|
| First birdie | `#6fd3a6` green (pill shape) |
| Lowest round | `#8fa8ff` blue |
| Broke 100 / 90 / 80 | `#ff8a80` red |
| Eagle | `#f6c56a` amber |

---

## 7. Course stamps and the stamp library

### 7.1 The look (prototype: `stamp-library.html`; earlier rounds `passport-keepsake-stamps.html`)

- **One ink, outlines and letters only**, like a border stamp. A rough, patchy press (`filter: url(#rough)`:
  `feTurbulence` + `feColorMatrix` alpha threshold, defined once per page) and an uneven press (a linear mask from
  55 % to 100 % to 65 % at a per-stamp angle).
- **The emblem** in the middle is the club's own logo icon with the words removed, filled with the ink (an SVG
  `<mask>` from the white-on-transparent PNG).
- **Three shapes**, fixed per course (`stamp.shape`): **ring** (name around the top, date around the bottom in the
  date ink, city under the emblem), **oval** (name over, city under, date under the emblem), **box** for wide emblems
  (emblem, a rule, name, date + city). Code: `courseStampSvg(course, date)` in `components/stamps.js`.
- **Inks** (dark page): blue `#8fa8ff`, red `#ff8a80`, green `#6fd3a6`, violet `#c3a6ff`, amber `#f6c56a`, teal
  `#6fd0e0`; the date is always `#ff8a80`. Paper-page values are in `stamp-library.html` (`.paper`) if ever needed.
- Andrew's three: **Twin Creeks blue oval** (the oak), **Bridlewood green box** (the horse head), **Firewheel red
  ring** (the firewheel flower).

### 7.2 The library (hard-coded)

- `components/stamps-data.js` → `js/stamps-data.js`: `STAMP_COURSES`, 68 entries: `slug, name, short, city, state,
  region (DFW | Austin), access, emblem (path or null), emblemRatio, monogram, stamp {shape, ink}, aliases`.
- **Emblems:** copy `stamps/emblems/*.png` (63 files, ~800 KB, white on transparent, ≤ 200 px) to `img/stamps/`. The
  five lettering-only clubs (Tierra Verde, Riverchase, Tangle Ridge, Grey Rock, Hancock) have `emblem: null` and print
  their `monogram`.
- **Matching a round's course** (`matchCourse(event.course)`): by course id or exact alias first, then by normalised
  name (lower case, punctuation and the words golf / club / course / country / the / at / of / park / links removed).
  Checked: "The Golf Club at Twin Creeks" → twin-creeks, "Firewheel Golf Park · Lakes" → firewheel, "Bridlewood Golf
  Course" → bridlewood, "Bear Creek Golf Club" → bear-creek.
- **Not in the library:** `stampFor()` builds one: the course's initials as a monogram, ring or oval and an ink picked
  from a hash of the course id, so it is stable for everyone.
- **Third-party logos.** These are the clubs' trademarks, used here for a private app among friends (Andrew's call).
  Do not use them in anything public, marketed or sold.

### 7.3 Adding courses later

1. Run `LOGO-COLLECTION-PROMPT.md` in a session with a browser; it saves logos + `LOGOS.md` to a branch (the 68 are
   on `design/036-course-logos`, `docs/design/features/036-card-designs/logos/`).
2. Cut the emblem: add a line to `SPEC` in `stamps/make-emblems.py` (which file, which crop, which ink mode), run it
   (needs `stamps/mask.py` and the logo PNGs in `lg/png/`), copy the PNG to `img/stamps/`.
3. Add the course to `js/stamps-data.js` with its aliases (the names rounds store for it).

### 7.4 Known rough emblems (fine for now, redo when convenient)

Words inside the icon: Luna Vista, Mesquite, Old Brickyard, Tenison Park. Soft (tiny source): Falconhead, Indian
Creek. Jimmy Clay shares Roy Kizer's bird (the city uses one mark for both).

---

## 8. Share

- **Card share** (§3.3): from the reveal and from any card in the Locker (⋯ on the card or a Share button under the
  carousel).
- **Passport share:** a Share button on the holder page draws the holder page and the courses page side by side
  into one PNG.
- Both use canvas like `recap.js` and wait for fonts first. Emblems are same-origin PNGs, so the canvas stays
  exportable.

---

## 9. Files

| File | Change |
|---|---|
| `js/stamps.js`, `js/stamps-data.js` (new) | from `components/`; `matchCourse`, `stampFor`, `courseStampSvg`, `stampDate`, `passportOf`, `MILESTONE_GOALS` |
| `img/stamps/*.png` (new) | 63 emblems from `stamps/emblems/` |
| `js/locker.js` | `courseObj` and `group` on each card (§6.1) |
| `js/db.js` | `fetchPersonRounds`: whole score set per event (§6.1) |
| `js/screens/locker.js` | landscape card front/back markup, finishes, Cards/Passport tabs, the book, friend view, share |
| `js/screens/pack.js` | horizontal chrome pack, swipe tear, new reveal |
| `js/screens/passport.js` (new, optional) | the book and its pages if `locker.js` gets too long |
| `css/locker.css` | all new styles (cards, pack, passport, stamps). Keep everything in this one file (035 rule) |
| `js/app.js` | routes `#/passport`, `#/passport/<id>`; old `#/locker/p/<id>` redirects |
| `js/screens/home.js` | Locker row subline; avatar → passport |
| `js/screens/board.js`, `season.js`, `ryder.js`/`play031.js` | names with a `personId` → `#/passport/<id>` |
| `js/screens/sheets.js` | "Your passport" row in the `you` sheet; update `lockerHow` text (landscape cards, passport) |
| `tests/stamps036.test.mjs` (new) | §12 |
| `ARCHITECTURE.md` 13a, `CLAUDE.md`, `README.md` | what was built; set this SPEC's status to "built in <commit>" |

Do not edit the 035 folder or the tracked `preview/` copy.

---

## 10. New patterns to flag (not in the design system)

Everything lives in `css/locker.css` and appears only on the Locker, the pack overlay, the passport and Home's two
entries. Round screens are untouched.

- New colours: the five dark-metal finishes (§2.2), the chrome pack gradient (§3.1), six stamp inks and the date ink
  (§7.1), milestone inks (§6.3), the passport cover navy and gold.
- Rainbow light that follows the tilt (prismatic, refractor), and movement-driven flash (`--mv`).
- 3D transforms: the tear curl and the book's page turn.
- SVG turbulence filter for the stamp ink; third-party logo artwork as stamp emblems.
- Card-face, pack and stamp type in `cqw` / SVG units, outside the six type styles.
- Green stays "you": the only green on these screens is the brand mark's ball and the green stamp ink (§13, Q6).

---

## 11. Prototypes: which file is the truth for what

| Part | File (this folder) | Published |
|---|---|---|
| Card front + all five finishes | `five-grades.html` | claude.ai/artifact/BGSswxbKf9MmSVPgsuRMro |
| Prismatic options, gold levels | `gold-prismatic.html` | …/PqXDYxse3AMxXot6mdZZGM |
| Tilt + flash controller | `dark-metals.html` | …/39PynNKaY2HRwTDAQioYJV |
| Card back, big group | `card-back-big-group.html` | …/XRxS1ghNgHS6ej9J7pVyHB |
| Card back small group, reveal variants, book | `reveal-back-book.html` | …/Rcpq28nAHZ2r7ZBqDWTnVi |
| **Pack + tear + reveal (final)** | `chrome-packs-2.html` | …/W85g7pHL5URCfHyvVs962q |
| Flow A storyboard | `flows.html` | …/1VZjCrWtsPny581Pd4R7C1 |
| Passport pages (holder, milestones) | `passport-booklet.html` | …/8xnm9CdRC4eiCg7StKpza1 |
| Stamp library (68 courses) | `stamp-library.html` | …/NZEZ3ErpzEdBMwDjsPEHZA |
| Logo-based stamps, first three | `passport-keepsake-stamps.html` | …/66n2j3dt5cLvKQyBCFDb53 |

Explored and **rejected** (kept for the record, do not build): `prototype.html` (round 1: course pictures),
`twin-creeks-art.html` (art styles), `art-on-card.html`, `finishes.html`, `ink-grades.html`, `colorway-grades.html`
(ink colour as grade), `metal-finishes.html`, `packs.html` (airmail, gift box, ticket, pouch), `foil-packs.html`
(portrait packs), `foil-packs-flat.html` (first swipe), `chrome-packs.html` (first chrome set; its tear tips the
wrong way), `passport.html`, `passport-designs.html`, `passport-real-stamps.html` (hole map), `passport-emblems.html`
(drawn emblems), `passport-logo-stamps.html` (redrawn logos).

---

## 12. Order of work and checks

1. `js/stamps-data.js`, `js/stamps.js`, `img/stamps/`; `tests/stamps036.test.mjs`:
   - `matchCourse` on the four names in §7.2; an unknown course → `stampFor` returns a monogram stamp, same output
     twice.
   - `passportOf` on Andrew's five rounds (fixture built from 035 §2 data) → exactly the courses and milestones in
     §6.2.
   - the card back `rows()` on the 16-player fixture (§2.3): 11 rows ending in Andrew at 11th, "+ 5 more"; and the
     same field viewed as the 14th-place player: 7 rows, gap, 13–15, "+ 1 more".
   - `npm test`.
2. `js/locker.js` (`courseObj`, `group`) + `db.fetchPersonRounds`; `npm test`.
3. Card front, finishes, tilt; card back; the Cards tab.
4. The pack and the reveal (keep 035's overlay plumbing and `open_card` timing).
5. The Passport tab and book; routes; profile and friend links; share images.
6. Docs; `npm run stamp`; push to the work branch; **ask Andrew before `main`**.

Check before handing back: open Andrew's locker (personId `eeae7a48-33fa-4052-ad0c-fc7623173fe6`) read-only against
the live data and compare with §6.2; open Sean's passport from the Board's standings.

---

## 13. Open questions (build the default, list them in the hand-back)

1. **Bands on every grade.** Default: Gold / Silver / Bronze get metal-coloured sliding bands; only Prismatic is
   multicolour; Standard has none. Andrew may have meant "bands only on Prismatic".
2. **Which chrome pattern.** Default Fine line; one constant switches it.
3. **Showcase.** Default: chosen by the app (best grade, newest, lowest). Pinning your own three needs a small store
   (`glb.pins`, or a table later).
4. **The "You" sheet.** Default: keep it in rounds with "Your passport" on top; Home's avatar goes straight to the
   passport.
5. **Passport cover colour.** Default navy + gold (black and green + gold are in `reveal-back-book.html`).
6. **Green stamp ink.** Green means "you" in the app; the green ink is used for Bridlewood's stamp and First birdie.
   Andrew approved the look; flag it in case it reads as "you".

Still open from 035, unchanged: rookie cards after a gold launch card; cut-offs per player; course rating / tee;
a pack offered on the Board's final card; "won the match" stamp; profile borders; old cards changing when an old
score is fixed.
