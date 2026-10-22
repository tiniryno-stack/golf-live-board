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
  },
];
