// whatsnew.js — PURE. The one-time "What's new" card on Home (Nov 24). Newest release first. Add one entry per release
// worth telling friends about (a new id = everyone sees it once); keep it to a title and up to three short lines.
// Seen key: glb.seen.whatsnew = the id last shown on this phone (moves with Add to Home Screen, like every glb.seen.*).

export const RELEASES = [
  {
    id: '2026-11-26',
    title: 'Cards, packs and a Passport',
    lines: [
      'Every finished 18 is a card now. It arrives as a pack: swipe across the top to tear it open.',
      'Home is your wallet: your next round, your newest card and where you stand in your crew.',
      'Your Passport collects a stamp for every course you finish. Tap your picture to see it.',
    ],
  },
  {
    id: '2026-11-24',
    title: 'Round links find your app',
    lines: [
      'Tap a round link and it sends you to Golf Board on your home screen. Your round is waiting there.',
      'Rounds you’re added to show up on Home by themselves.',
      'Wrong name at the top? Tap it to fix who this phone is.',
    ],
  },
];

/**
 * What Home shows: the newest release this phone hasn't seen, or null.
 * A phone with nothing to compare (a brand-new phone: no rounds yet) sees nothing; Home marks it seen instead,
 * so the card is only ever news to someone who used the app before. 037 v2: nor does anyone whose first round
 * (`firstRound`, 'YYYY-MM-DD') is after the release: it was never new to them.
 * Returns { show: release | null, markSeen: id | null }.
 */
export function whatsNew({ seen = null, hasRounds = false, firstRound = null, releases = RELEASES } = {}) {
  const latest = releases[0];
  if (!latest || seen === latest.id) return { show: null, markSeen: null };
  if (!hasRounds || (firstRound && String(firstRound) > latest.id)) return { show: null, markSeen: latest.id };
  return { show: latest, markSeen: null };
}
