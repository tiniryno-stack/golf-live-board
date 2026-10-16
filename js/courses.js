// Course catalog. v1 ships Twin Creeks only — add courses here.
// A round stores its own copy of the course, so editing this list never changes past rounds.
// Source: GolfPass scorecard listing; check against the physical card on the first tee.
// The organizer can correct any hole's par or handicap mid-round from Host.

export const COURSES = [
  {
    id: 'twin-creeks-allen-tx',
    name: 'The Golf Club at Twin Creeks',
    shortName: 'Twin Creeks',
    location: 'Allen, TX',
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
