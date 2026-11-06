// Built-in courses: scorecards already checked against the real card. Any other course comes
// from course search (js/coursedata.js, OpenGolfAPI). `ogaId` links a built-in course to its
// OpenGolfAPI listing so search results use this checked copy instead.
// A round stores its own copy of the course, so editing this list never changes past rounds.
// Twin Creeks: GolfPass scorecard listing, matched OpenGolfAPI and the Oct 16 round exactly.
// The organizer can correct any hole's par or handicap mid-round from Host.

export const COURSES = [
  {
    id: 'twin-creeks-allen-tx',
    ogaId: '45bc4e3e-1174-4dac-b3c8-6d58a3be2116',
    source: 'builtin',
    name: 'The Golf Club at Twin Creeks',
    shortName: 'Twin Creeks',
    location: 'Allen, TX',
    lat: 33.1083737,
    lng: -96.7180757,
    tees: [
      { name: 'Gold', yards: 6840, rating: 73.2, slope: 131 },
      { name: 'Blue', yards: 6288, rating: 70.5, slope: 123 },
      { name: 'White', yards: 5651, rating: 67.3, slope: 111 },
      { name: 'Red', yards: 4602, rating: 66.5, slope: 107 },
    ],
    par: [5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 3, 4, 5, 4, 3, 5, 4, 4],
    strokeIndex: [5, 9, 15, 1, 17, 11, 3, 7, 13, 18, 16, 6, 14, 10, 12, 4, 8, 2],
    // yards per hole by tee: the scorecard fingerprint used to tell greens apart (GPS yardages stage 3b)
    yards: [
      { gold: 555, blue: 516, white: 463, red: 388 }, { gold: 383, blue: 349, white: 309, red: 252 }, { gold: 189, blue: 176, white: 156, red: 121 },
      { gold: 470, blue: 437, white: 396, red: 304 }, { gold: 346, blue: 315, white: 272, red: 237 }, { gold: 530, blue: 485, white: 436, red: 369 },
      { gold: 215, blue: 190, white: 170, red: 116 }, { gold: 413, blue: 378, white: 357, red: 303 }, { gold: 407, blue: 374, white: 331, red: 259 },
      { gold: 336, blue: 313, white: 274, red: 218 }, { gold: 162, blue: 149, white: 136, red: 96 }, { gold: 439, blue: 405, white: 384, red: 303 },
      { gold: 505, blue: 458, white: 405, red: 366 }, { gold: 352, blue: 330, white: 277, red: 232 }, { gold: 157, blue: 133, white: 116, red: 89 },
      { gold: 548, blue: 514, white: 491, red: 369 }, { gold: 412, blue: 381, white: 348, red: 291 }, { gold: 421, blue: 385, white: 330, red: 289 },
    ],
  },
];
