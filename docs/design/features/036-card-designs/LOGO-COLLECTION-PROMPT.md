# Prompt: collect golf club logos for the passport stamps

Paste everything below the line into a new Claude session that can drive a browser (the Claude desktop app with
its built-in browser, or Claude in Chrome). Edit the course list first.

---

I'm designing "passport stamps" for a golf app (repo `tiniryno-stack/golf-live-board`). Each golf course gets a
stamp with one emblem that stands for it, the way a Paris stamp has the Eiffel Tower. I need you to collect each
club's official logo as **reference only**, so a designer can redraw the idea as a simple one-color emblem. We
will not ship the logo files in the app.

Use the browser for this. Do not guess what a logo looks like and do not make one up.

**Courses (all Dallas–Fort Worth, Texas):**

1. The Golf Club at Twin Creeks, Allen
2. Bridlewood Golf Club, Flower Mound
3. Firewheel Golf Park, Garland (Lakes course)
4. (Andrew: add the other courses you play a lot, one per line, with the city)

**For each course:**

1. Find the official logo. Try the club's own website first (the header or footer logo). If that fails, use
   Google Images with `"<course name>" <city> golf logo`, and pick the one that matches the club's own site,
   scorecard or pro shop merchandise. Skip logos of the management company (Arcis, Invited, Troon and so on) and
   of tee time sites.
2. Save the largest clean version you can get as `docs/design/features/036-card-designs/logos/<slug>.png` (or
   `.svg` if the site has one). Slug = lowercase course name with dashes, for example `twin-creeks.png`. If you
   cannot download the file, take a tight screenshot of just the logo and save that.
3. Look at the image yourself and describe it.

**Then write `docs/design/features/036-card-designs/logos/LOGOS.md`** with one section per course:

- Course name and city
- File name you saved
- The page you got it from (full URL)
- **What the emblem is**, in plain words: the central picture (a tree, a bird, a bridge, a crest, initials, a
  flower…), what else is around it, and whether it is only lettering with no picture at all
- **The one thing to draw**: if this had to become a tiny one-color stamp emblem, what single object should it
  be? One line.
- Colors used
- How sure you are that this is the club's current official logo (sure / fairly sure / not sure), and why
- Anything on the club's site that it treats as its symbol or landmark (a signature hole, a bridge, a named
  tree, its history)

If you cannot find a logo for a course, say so in its section and describe what you tried. Do not substitute a
different club's logo.

**When you are done:**

- Commit the `logos/` folder and `LOGOS.md` to your work branch and push it. Do not push to `main` and do not
  open a pull request.
- Reply with: the branch name, a one-line summary per course ("Twin Creeks: two oak trees over a creek, sure"),
  and any courses you could not find.

Do not change anything else in the repo.
