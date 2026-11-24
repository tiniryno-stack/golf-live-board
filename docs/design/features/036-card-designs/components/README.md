# 036 components

Code lifted from the approved prototypes (see SPEC.md §11). Reference code: port it into the app's files.

| File | What | Source prototype |
|---|---|---|
| `stamps-data.js` | the 68-course stamp library (`STAMP_COURSES`). **Drop-in** as `js/stamps-data.js` | `stamps/courses.json` |
| `stamps.js` | pure: `matchCourse`, `stampFor`, `courseStampSvg`, `stampDate`, `passportOf`, `MILESTONE_GOALS`. **Drop-in** as `js/stamps.js` | `stamp-library.html` |
| `stamps.css` | stamp ink look (inks, rough filter use, uneven press, thump) | `stamp-library.html` |
| `card-front.css` / `.js` | landscape card, five dark-metal finishes, prismatic slick + shift + flash, metal bands, tilt loop | `five-grades.html`, `gold-prismatic.html`, `dark-metals.html` |
| `card-back.css` / `.js` | players left (ranked, row fitting) + stats right | `card-back-big-group.html`, `reveal-back-book.html` |
| `pack.css` / `.js` | horizontal chrome refractor pack, the swipe tear (cut, curl, peel, fly), the reveal stage | `chrome-packs-2.html` |
| `passport.css` / `.js` | the book (page turn), cover, holder page, milestone rubber stamps | `reveal-back-book.html`, `passport-booklet.html` |

The `.js` files other than `stamps*.js` are excerpts: they refer to helpers defined elsewhere in their prototype
(`MARK`, `card()`, `R`, `state`, `timers`, `scene()`…). Read them next to the prototype.
