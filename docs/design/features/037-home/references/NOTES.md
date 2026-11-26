# 037 Home: reference notes (Nov 26)

**Could not open or capture:**
- **Mobbin only shows a free account 3 screens and 1 flow per app.** Everything else is blurred behind Mobbin Pro.
  So I could not see Fuse's other screens, most of Apple Wallet's 132 screens, or most of Focus Flight's 121.
  The biggest gaps: **Focus Flight's own home / in-flight / logbook screens** (only onboarding and the paywall were
  free), **an Apple Wallet boarding pass or event ticket**, and **Apple Wallet's empty state**. Fuse's free set did
  include both its home and its empty home.
- **No spoken audio from either reel.** Reel 1 has subtitles burned into the video. I read them frame by frame, but I
  kept only the fragments listed below, not a full transcript. Reel 2 has no subtitles and Instagram offered no
  caption track, so for reel 2 everything below comes from the on-screen text and the before/after demos only.

Screenshots in this folder are 333–356 px wide phone captures (all under 410 KB). Files are named
`<source>-NN-<what>.png`, and the reel frames are `reel1-NN.png` / `reel2-NN.png` in time order.

---

## 1. Fuse (iOS crypto wallet)

**What Andrew said:** likes Fuse a lot and thinks it may be the font; not in love with bento boxes, but Fuse does them
well.

### Home, top to bottom (`fuse-01-home.png`)
1. Status bar, then a small **"Wallet"** label at about body size. There is no big screen title.
2. Kicker **"Total Balance"** in light grey with a small green **↗ 100%** chip.
3. **The hero number "$10.04"**, about 48 pt and roughly a seventh of the screen width per character. **The dollars are
   black and the cents are light grey.** It's one number with two weights of emphasis, and I think a big part of the
   "font" feeling comes from that contrast plus the tight, bold grotesque, not from the typeface alone.
4. A thin tick-mark sparkline (no axes or labels), then range tabs **1D 1W 1M 6M 1Y** in small grey text.
5. **A 2×2 bento.** Each tile has a coloured icon square, a black label, and one grey line that's either a status or an
   offer: *Cash / Send and receive*, *Investments / $10.04*, *Earn / Up to 4.56% APY*, *Fuse Card / Get your free
   card*. The tiles are white with very faint borders and almost no shadow.
6. A one-line promo row, **"Get Fuse Plus Membership"**, with an ✕ to dismiss and page dots (it's a small carousel).
7. Bottom: three unlabeled icon tabs (home, history, settings) on the left and a **black circular + button** on the
   right. That + button is the one primary action, and it sits apart from the tabs.

**What competes for attention:** really one thing, the balance. The tiles are quiet because each one has only one
colour (its icon), and the text in them is small.
**Colour:** white background, black text, two greys. The only colour is the four tile icons (blue, orange, purple,
black) and the tiny green chip.
**Type scale:** the hero is about 4× the body size. Everything else is in two sizes (label and caption). There's no
middle size.

### Empty state (`fuse-02-home-empty.png`)
- **Same layout, same position for everything.** The balance reads **"$0.00"** and the chip goes grey.
- The chart's spot is taken by **"There is nothing here yet"** (bold), one grey line, *"Deposit tokens to your address
  to start using Fuse wallet"*, and a **black pill button "↓ Receive"**, centred.
- The tiles stay and still say something useful (*Trade crypto*, *Get your free card*). Nothing is dashed or hollow.
- **Lesson:** the empty home is the real home with zeroes, plus one sentence and one button where the missing thing
  would be.

### Onboarding (`fuse-03` → `fuse-07`)
- `fuse-03-onboarding-welcome.png`: a vertical word wheel (*Earn / **Spend** / Invest*). The current word is black
  with an icon, and the others fade. Below it is a blue gradient, the mark, **"Your money, upgraded"**, one line of grey,
  then *Continue with Apple* and *Recover existing wallet* as two full-width pills.
- `fuse-04-onboarding-device-key.png`, `fuse-05-onboarding-2fa-key.png`, `fuse-06-onboarding-recovery-key.png`: one
  step per screen. A short checklist (*Device Key / 2FA Key / Recovery Key*) shows where you are: the current item is
  big and black with an explainer, and the others are grey rows. There's one dark button at the bottom.
- `fuse-07-onboarding-wallet-ready.png`: the same checklist with everything greyed and a green tick on **"Your wallet
  is ready!"**. It's an almost empty white screen, so the finish feels calm.

### Sheets and upsell
- `fuse-08-free-transactions-sheet.png`: a bottom sheet over the blurred home. It shows a small green card
  illustration ("Sponsored"), **"You have 5 free transactions remaining"**, and two buttons, *Got it* (light) and
  *Get Fuse+* (black). A status is shown as an object (a card), not only as text.
- `fuse-09-plus-membership.png`: a dark screen with two feature cards (icon, title, one line), "How to get Fuse Plus",
  and one CTA. This is where Fuse puts its detail cards, not on home.

### Fuse: what it does well, concretely
- One hero number, with the less important part (cents) greyed.
- Bento with **four tiles, one line each, one colour each**. Even an empty tile tells you what you'd get.
- The empty state keeps the layout and adds **one sentence and one button**.
- One primary action (black +), placed apart from navigation.
- Onboarding is one idea per screen, with a checklist as the progress indicator.

---

## 2. Apple Wallet (iOS)

**What Andrew said:** good inspiration even if it pushes us toward a finance-app look.

### Home, top to bottom (`wallet-01-home-stack.png`)
1. A large bold title, **"Wallet"** (about 2× body), on the left, with three circular grey icon buttons on the right:
   **+**, search, and ⋯. **The add action is at the top, not the bottom.**
2. **The stack**: 13 cards visible at once, each showing only its **top edge, about 45 px of a 740 px screen** (about
   6%). The bottom card shows more.
3. **Each edge has no added text.** It's the card's own art: bank logo, colour, pattern, and sometimes a balance
   (*Apple Cash $0*). You identify a card by its look, not by a label.
4. No tab bar and no other content. The stack is the whole screen.

**What competes:** nothing. It's one object type repeated.
**Colour:** a very light grey background. All colour comes from the cards themselves.

### Offers and onboarding inside the home (`wallet-02-home-offer-carousel.png`, `wallet-03-home-passes-tickets-promo.png`)
- Above the stack sits a **dismissible promo card** (✕ top right) in a two-page carousel with dots:
  1. *"See your Apple Card credit limit offer."* with an **Apply** pill.
  2. An illustration of coloured tickets (music, coffee, film, plane, gift, graduation cap) with **"Passes and
     Tickets — Find apps and start collecting your passes in one place."** and a **Get** pill.
- When the promo is showing, the stack starts lower (Apple Cash card full size under it).
- **Lesson:** Wallet's nudges (things to set up, new features) are **cards in the same visual language as the stack**,
  sitting on top of it and dismissible. They aren't banners, rows or sheets.

### Detail, one tap in (`wallet-04-card-detail.png`)
- ✕ top left, card number / search / ⋯ top right.
- The **card itself at full width** at the top (Apple Card gradient).
- **Then a bento:** *Card Balance US$12.94* (with "US$11,337.06 Available"), *Payment Due 1 Apr* with a *Pay Early*
  button, and *Yearly Activity* with a tiny bar chart.
- Then **"Latest Card Transactions"**, a list with icon, merchant, place, date and amount.
- **Lesson:** this is where Wallet uses bento and lists, **on the card's own screen, not on home.** It supports both
  "detail lives behind a tap" and Andrew's "bento in the right spot".

### Done state (`wallet-05-pay-done.png`)
- The card that was used sits at the top, a blue ✓ **Done** sits in the middle, and **the rest of the stack collapses to
  edges at the very bottom.** The stack moves out of the way rather than disappearing.

### Wallet: what it does well, concretely
- Home is **one repeated object** and nothing else. The object's own art does the identifying.
- Edges are about 6% of the screen each, so 13+ items fit with no scroll.
- Setup nudges are **cards on top of the stack**, dismissible, with page dots.
- Bento, numbers and lists appear **only after you pick a card.**
- The main add action is a small + at the top right. It isn't a big bottom button.

---

## 3. Focus Flight (iOS focus timer)

**What Andrew said:** likes a lot of what it does.

Only the onboarding flow (13 screens) and 3 key screens were free. **Its real home / flight / logbook screens were not
visible.** Everything below is from onboarding and the paywall.

### The metaphor, carried through
- `focusflight-01-onboarding-distracted.png`: black screen. Small grey *"Do you often feel"* above a **huge blue
  "distracted?"** (about 3× body). One pale pill at the bottom says **"Yes, I do."** The answer is the button label.
- `focusflight-02-onboarding-wordmark.png`: *"That's why we created"* plus a **glowing rainbow-edged "FocusFlight"**
  wordmark, and one white pill, *Let's get started!*
- `focusflight-03-onboarding-route-map.png`: a dark map with a **route line from LHR to CDG**. The airports are yellow
  badges with a plane icon. Below: *"FocusFlight turns every focus session into an exciting flight, guiding you into"*
  plus **"deep focus mode."** in large bold.
- `focusflight-04-onboarding-boarding-pass.png`: **the boarding pass.** A white rounded card with a faint dotted world
  map behind the text. **LHR London ✈ 42m ✈ CDG Paris** in big bold mono. Below that is a 2×2 of label/value pairs:
  *Seat 21A*, *Distance 348 km*, *Boarding Now*, *Date 2026/03/13*. **Values are mono, labels are small grey sans.**
  Then a dashed tear line with half-circle notches cut into both edges, then a barcode. **Behind it, tilted, is an older
  pass with a green "LANDED" badge.** The copy below reads *"Focus Boarding Pass — Every flight is a journey of deep focus,
  from takeoff to touchdown"* and *"Focus History — Every flight marks a milestone in your focus journey."*
- `focusflight-05-onboarding-scenarios.png`: *"Choose Your Focus Scenario"*, with soft pastel chips (Read, Research,
  Meditate, Code, Fly…) tumbled loosely like they were dropped. There's a **4-segment progress bar at the top** and one
  black *Continue*.
- `focusflight-06-onboarding-airplane-mode.png`: *"Airplane Mode ✈"* with a ring of distracting app icons around a
  locked hourglass. Progress is at 3 of 4, then *Continue* and a plain-text **Skip** under it.
- `focusflight-07-welcome-globe.png`: a dark 3D globe, **"Welcome to FocusFlight"** centred, and one white pill,
  *Start Journey*.
- `focusflight-08-paywall-ticket.png`: the paywall shows the boarding pass inside a phone mockup. The plans are
  **yellow mono ticket-style labels with a plane icon** (*Lifetime*, *Annually*, *Monthly*), so even pricing stays in the
  metaphor.

### Focus Flight: what it does well, concretely
- **One metaphor, everywhere:** route, airport codes, boarding pass, "landed", airplane mode, journey, and even the
  price tags.
- **Mono type for the "ticket" data** (codes, seat, date, plan names) and sans for everything human. Two fonts, each
  with one job.
- **The pass changes state** (boarding → LANDED). An old flight is the same object with a stamp, not a different object.
- Onboarding: one sentence per screen, very large type, **one full-width pill button**, segmented progress at the top,
  Skip as plain text under the button, and dark and light screens alternating.

---

## 4. Reel 1: "20 Practical Design Tips (In under 60 seconds)"

- **Link:** https://www.instagram.com/reel/DgIYTG0xNrM/
- **Account:** `charles.unemployed`
- **Caption (word for word):**

  > Comment "TIPS" and I'll send you the Claude skill for all 20
  >
  > 12 of these are from Dan Liu's "10 practical tips for improving your text layout" and "10 practical tips for
  > choosing colors" threads, and the other 8 are from Emil Kowalski's
  >
  > #designfundamentals #typographytips #uipolish #designforengineers #claudecodetips

- **Format:** 62 s. A numbered list sits at the top and fills in one tip at a time (the current one in orange). A red
  timer counts up. Burned-in subtitles. For each tip, a Before/After UI card with the CSS in a code pill under it.
- **Audio:** not captured. The subtitle fragments I recorded are quoted in the list below. The full spoken sentences
  around them are **not** transcribed.

### The 20 tips (the on-screen titles word for word, then what the demo and subtitles show)
1. **Left-align long text.** Subtitles: "Don't center" … "left align". Demo: a centred paragraph → left-aligned
  (`text-align: left`). `reel1-01`, `reel1-02`
2. **Text fills half the button.** Subtitle: "…the button's height." Demo: *Start free trial / Book a demo* buttons,
  `.btn { padding: 10px 20px }`. `reel1-03`
3. **Keep body text regular.** Subtitle: "if everything's bold". Demo: the body of a "Weekly summary" card set to
  `font-weight: 400`. `reel1-04`
4. **Tint your grays blue.** Subtitle: "Pure gray can…". Demo: a file-list UI, `--gray-100: #f4f4f4` before.
  `reel1-05`
5. **Keep Delete far from Save.** Subtitle: "Keep delete…". Demo: an *Edit project* dialog with Delete, Cancel and Save
  in a row (before). `reel1-06`
6. **Tight headline line height.** Subtitle: "…tighter line height". Demo: a two-line headline, *"The calendar that
  plans your week before you do"*. `reel1-07`
7. **Layer your shadows.** Subtitles: "One big shadow…" … "…ones instead." Demo: a *Design review* card, one shadow
  (before) → several soft ones (after). `reel1-08`, `reel1-09`
8. **Use sentence case.** Subtitle: "…not title case." Demo: an *Email notifications* settings card. `reel1-10`
9. **Tint text on color.** Subtitle: "tint your text". Demo: a yellow *Your trial ends in 3 days* notice with brown
  text, `color: #92400e`. `reel1-11`
10. **Align on the baseline.** Subtitles: "Align mixed…" … "…not the center." Demo: a price, **$24 / month**,
  `align-items: center` → `align-items: baseline`. `reel1-12`, `reel1-13`
11. **Labels, not placeholders.** Subtitle: "…so put labels". Demo: a sign-up form whose field text vanishes once
  typed. `reel1-14`
12. **One hue per color.** Subtitle: "Keep the same…". Demo: a "Visitors by device" bar chart whose two blues
  (`hsl(196 …)`, `hsl(252 …)`) are different hues. `reel1-15`
13. **More padding on the sides.** Subtitle: "Use more padding…". Demo: toasts (*Link copied to clipboard / Undo*,
  *Invite sent to 3 people / View*), `.toast { padding: 12px }` before. `reel1-16`
14. **Say what buttons do.** Subtitles: "Don't just label…" … "…actually do." Demo: a payment form's **Submit** →
  **🔒 Pay $48.00**. `reel1-17`, `reel1-18`
15. **More space above headings.** Subtitle: "…than below." Demo: a *Billing* heading, `h2 { margin: 48px 0 8px }`.
  `reel1-19`
16. **Mute colors in dark mode.** Subtitle: "…brand colors." Demo: a dark *Upcoming* list with bright blue, green and red
  event bars (before). `reel1-20`
17. **Right-align numbers.** Subtitle: "…so the digits…". Demo: an invoice table, `td.amount { text-align: right }`.
  `reel1-21`
18. **Gap = small text's height.** Subtitles: "space it by…" … "the smaller text height." Demo: stat tiles **12,480
  Visitors this week** / **$8,940 Revenue this week**, the gap between the big number and its label. `reel1-22`
19. **Add a CTA to empty states.** Subtitles: "Add a CTA … to every empty state." Demo: a *Projects* panel with **"No
  projects yet"**, a grey line *"Projects keep your docs, tasks and files in one place."*, and a black **+ New
  project** button. `reel1-23`
20. **Bigger landing page CTAs.** Subtitles: "On landing pages, make your CTA way bigger than what feels normal." Demo:
  *Plan less. Ship more.* with a tiny *Get started* button, `.cta { font-size: 20px }`. `reel1-24`

Close: "Comment 'TIPS' and … for all of this." `reel1-25`, `reel1-26` (the full list of 20 is readable in these).

---

## 5. Reel 2: "10 Niche Design Hacks"

- **Link:** https://www.instagram.com/reel/Df3Oi9Atj63/
- **Account:** `theecommguy`
- **Caption (word for word):**

  > I'm showing you 10 niche design tactics that will improve your website's UX and UI — and every single one can be
  > built by Claude.
  >
  > Watch the video for all 10, then paste the one you want into Claude and ask it to build it for your store.
  >
  > Comment PART2 and I'll post another 10.
  >
  > #ecommerce #webdesign #uxdesign #shopify #ai

- **Format:** 61 s. A white title card, "10 Niche Design Hacks", above a two-column numbered list that fills in, and
  under the speaker a Before/After demo with the CSS line under it.
- **Audio:** **not captured.** There are no burned-in subtitles and no caption track. The list below is only the
  on-screen titles and what the demos and code show. I have not guessed at what was said.

### The 10 hacks (on-screen titles word for word, then the demo and code shown)
1. **Tabular numbers.** Dollar amounts in a column ($1,321.69 / $8,297.00 / $3,235.85) line up only "After".
  `font-variant-numeric: tabular-nums;` `reel2-01`–`reel2-03`
2. **Optical centering.** A ▶ play icon in a circle, nudged right so it *looks* centred (crosshairs shown).
  `.play-icon { transform: translateX(15%); }` `reel2-04`, `reel2-05`
3. **Concentric radius.** An orange rounded box inside a dark rounded box; the inner radius = outer radius minus the
  padding. `border-radius: calc(var(--outer-r) - var(--pad));` `reel2-06`–`reel2-08`
4. **Alpha borders.** A card on a beige background with a translucent black border instead of a solid grey one.
  `border-color: rgb(0 0 0 / 0.12);` `reel2-09`, `reel2-10`
5. **Layered shadows.** A white card with three stacked faint shadows.
  `box-shadow: 0 1px 3px #0001, 0 4px 8px #0001, 0 16px 32px #0001;` `reel2-11`, `reel2-12`
6. **Balanced headlines.** *"Small details make the whole product feel considered"* wraps into even lines instead of
  leaving one word alone. `h1 { text-wrap: balance; }` `reel2-13`–`reel2-15`
7. **Origin-aware popovers.** An *Options* button whose menu grows out of the button's corner.
  `.menu { transform-origin: top left; }` `reel2-16`, `reel2-17`
8. **Strong ease out.** A toggle knob sliding with a fast-start, soft-landing curve.
  `transition: transform .4s cubic-bezier(.22, 1, .36, 1);` `reel2-18`, `reel2-19`
9. **Masked scroll edges.** A row of flavour chips (Vanilla, Chocolate, Salted c…) that fades out at both ends
  instead of being cut off. `mask-image: linear-gradient(90deg, #0000, #000 15% 85%, #0000);` `reel2-20`–`reel2-22`
10. **Tactile buttons.** *Add to cart* shrinks slightly while pressed. `.btn:active { transform: scale(.96); }`
  `reel2-23`, `reel2-24`

---

## 6. What these do that our Home doesn't

Compared against `PLAN-v2.md` ("The wallet").

### Where the plan already matches
- **One status line at the top, with a small kicker above it** (§4.1). This is Fuse's "Total Balance" label + hero
  number (`fuse-01`). It also matches Focus Flight's small grey line over one huge word (`focusflight-01`).
- **One stack of real objects, with detail behind a tap** (§4.2). This is exactly Wallet (`wallet-01`), and Wallet puts
  its bento and lists on the card's own screen (`wallet-04`), which backs up cutting "How it finished" from Home.
- **A pass for the round coming up** (§4.2). Focus Flight's boarding pass (`focusflight-04`) is the model: big codes, a
  2×2 of label/value, mono values, a tear line with notches.
- **Mono for codes and times, sans for words** (§4.1 kicker). This matches Focus Flight's split (`focusflight-04`,
  `-08`).
- **Bento used once, two tiles, one number each** (§4.3). Fuse shows how to make that work: one icon colour, a label,
  one line (`fuse-01`).
- **Onboarding: three steps, one screen each, skippable** (§5). This matches Fuse and Focus Flight.
- **"Say what buttons do"** (reel 1 #14). *Join with code* and *+ New round* already do this.

### Where the plan falls short
- **The empty state has no button in the content.** Fuse's empty home keeps the full layout and adds **one sentence
  and one black button** where the missing content would be (`fuse-02`). Reel 1 tip 19 says the same: "Add a CTA to
  empty states" (`reel1-23`). The plan's zero-card Home is a member card plus a headline ("Your first card is 18
  holes away."), with the only actions down in the bottom bar. Consider a single button on, or right under, the member
  card (e.g. *Join with code* or *Start a round*).
- **The stack's edges are labels, not art.** The plan gives older cards a 28 px edge with "course · score" text.
  Wallet's edges carry **no added text**: the card's own finish and colour identify it (`wallet-01`). Our cards already
  have finishes (Prismatic, metal edge from 036). Consider letting the edge show the finish first and the text second,
  or drop the text.
- **The hero is a sentence, not a number.** "87 at Twin Creeks." works, but Fuse's punch comes from **one big number
  with the less important part greyed** ($10**.04**). A Home equivalent: **87** big, with " at Twin Creeks" in the
  muted text colour on the same line. Also set the line with `text-wrap: balance` (reel 2 #6), which the app already
  uses elsewhere.
- **"What's new" goes to a one-time sheet.** Wallet puts nudges such as "Passes and Tickets" and offers **on top of the
  stack as dismissible cards with page dots** (`wallet-02`, `wallet-03`). That's a better home for *What's new*,
  *Add to Home Screen* and maybe *Invite your crew* than a sheet that interrupts, and it keeps the object metaphor.
- **Two bottom buttons vs one primary action.** Fuse has one black + (`fuse-01`). Wallet's add is a small + at the top
  (`wallet-01`). The plan keeps two equal pinned buttons. That's fine if both are used weekly, but it's worth asking which
  one is *the* action.
- **Uppercase mono kickers vs sentence case.** Reel 1 tip 8 says use sentence case, not title case (`reel1-10`). The
  plan's kickers (`LAST OUT · FRI NOV 20`) are all caps. They're labels, not sentences, so this may be fine, but it's
  a conscious choice to flag.

### What the references suggest that the plan hasn't considered
- **One object that changes state instead of two objects.** Focus Flight shows an older pass with a **LANDED** badge
  behind the current one (`focusflight-04`). Our upcoming round could be a pass that, once played, gets stamped and
  *becomes* the front scorecard (or the pack). Then "coming up" and "last out" are one object's story, not two kinds of
  card in the stack.
- **The rest of the stack collapses when one card is used** (`wallet-05`). When a round is live, the stack could fold
  to edges at the bottom and the live round's pass takes the top. That would be a visual reason for the live bar.
- **Onboarding details from Focus Flight:** the answer as the button label ("Yes, I do."), a **segmented progress bar
  at the top**, *Skip* as plain text under the one button, and a dark ↔ light rhythm between steps
  (`focusflight-01`, `-05`, `-06`). Fuse uses a **checklist as the progress indicator** that ends on a calm "ready"
  screen (`fuse-04` → `fuse-07`). Our step 1 ("the member card prints with the name and deals in") fits this well.
- **Polish rules from the reels that apply directly to Home:**
  - Scores in the stack and tiles: **tabular numbers** (reel 2 #1) and **right-align numbers** (reel 1 #17). Both are
    already used in the app's CSS, so make sure Home's new pieces use them too.
  - Score + to-par on the card face: **align on the baseline**, not the centre (reel 1 #10).
  - Tile number and its label: **gap = the small text's height** (reel 1 #18, which uses stat tiles as the example).
  - Stacked cards: **layered shadows** (both reels) and **concentric radius** for anything inset in a card, like the
    pass's notches or a tile inside a sheet (reel 2 #3).
  - Dark by default: **mute colours in dark mode** (reel 1 #16) and **alpha borders** on cards over the dark
    background (reel 2 #4).
  - The deal-in motion (§4.6): use a **strong ease-out** (reel 2 #8). Buttons: **scale to .96 on press** (reel 2 #10).
  - If the crew switcher ever scrolls sideways: **masked scroll edges** (reel 2 #9).
- **Bento has a proper home: one tap in.** Wallet's card detail (`wallet-04`) is a bento: balance tile, due-date tile
  with a button, activity tile, then a list. That's a ready pattern for the round's card back or the Locker card view,
  where Andrew said bento is "good in the right spot".
