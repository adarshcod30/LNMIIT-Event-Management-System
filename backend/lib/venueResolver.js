// ================================================================
// lib/venueResolver.js: Venue Alias Resolution Engine
// ================================================================
// This is the backbone of the conflict detection system.
// It resolves any user-typed venue name to its canonical form
// using exact matching, alias matching, and fuzzy matching.
//
// How it works:
//   1. Normalize input (lowercase, strip hyphens/spaces/special chars)
//   2. Check exact match against canonical names
//   3. Check against all known aliases
//   4. Fuzzy match using Levenshtein distance (threshold ≤ 2)
//   5. If ambiguous, return suggestions for user confirmation
// ================================================================

// ---- Full Venue Database ----
// Each venue has a canonical name, list of aliases, capacity, and category
const VENUE_DATABASE = [
  // ---- Lecture Theatres (LT-1 through LT-19) ----
  ...Array.from({ length: 19 }, (_, i) => {
    const n = i + 1;
    return {
      canonical: `LT-${n}`,
      category: 'lecture_theatre',
      capacity: n <= 10 ? 120 : 90,
      aliases: [
        `LT-${n}`, `LT${n}`, `LT ${n}`,
        `Lecture Theatre ${n}`, `Lecture Theater ${n}`, `Lecture Hall ${n}`,
        `LH-${n}`, `LH${n}`, `LH ${n}`,
        `lecture hall ${n}`, `lt ${n}`, `lt-${n}`, `lt${n}`,
        `lh-${n}`, `lh${n}`, `lh ${n}`,
      ],
    };
  }),

  // ---- Seminar Halls ----
  {
    canonical: 'Seminar Hall 1',
    category: 'seminar_hall',
    capacity: 100,
    aliases: [
      'Seminar Hall 1', 'SH-1', 'SH1', 'SH 1', 'Seminar Room 1',
      'seminar hall 1', 'mini auditorium 1', 'sh1', 'sh-1', 'SemHall1',
      'semhall1', 'seminar1',
    ],
  },
  {
    canonical: 'Seminar Hall 2',
    category: 'seminar_hall',
    capacity: 100,
    aliases: [
      'Seminar Hall 2', 'SH-2', 'SH2', 'SH 2', 'Seminar Room 2',
      'seminar hall 2', 'mini auditorium 2', 'sh2', 'sh-2', 'SemHall2',
      'semhall2', 'seminar2',
    ],
  },

  // ---- OAT (Open Air Theatre) ----
  {
    canonical: 'OAT',
    category: 'outdoor',
    capacity: 800,
    aliases: [
      'OAT', 'Open Air Theatre', 'Open Air Theater', 'Open-Air Theatre',
      'Open-Air Theater', 'OAT ground', 'oat', 'outdoor theatre',
      'outdoor theater', 'openair theatre', 'open air theater',
      'open air theatre', 'oat ground',
    ],
  },

  // ---- SAC (Student Activity Centre) ----
  {
    canonical: 'SAC',
    category: 'auditorium',
    capacity: 400,
    aliases: [
      'SAC', 'Student Activity Centre', 'Student Activity Center',
      'SAC Hall', 'SAC Multi-Utility Hall', 'SAC Auditorium',
      'sac hall', 'multi-utility hall', 'multi utility hall',
      'sac', 'sac auditorium', 'student activity centre',
    ],
  },
  // SAC Sub-venues
  {
    canonical: 'SAC Badminton Court 1',
    category: 'sports',
    capacity: 30,
    aliases: ['SAC Badminton Court 1', 'sac badminton 1', 'badminton court 1 sac'],
  },
  {
    canonical: 'SAC Badminton Court 2',
    category: 'sports',
    capacity: 30,
    aliases: ['SAC Badminton Court 2', 'sac badminton 2', 'badminton court 2 sac'],
  },
  {
    canonical: 'SAC Badminton Court 3',
    category: 'sports',
    capacity: 30,
    aliases: ['SAC Badminton Court 3', 'sac badminton 3', 'badminton court 3 sac'],
  },
  {
    canonical: 'SAC Squash Court',
    category: 'sports',
    capacity: 10,
    aliases: ['SAC Squash Court', 'squash court', 'sac squash'],
  },
  {
    canonical: 'SAC Table Tennis Room',
    category: 'sports',
    capacity: 20,
    aliases: ['SAC Table Tennis Room', 'TT room', 'table tennis', 'sac tt', 'tt room sac'],
  },
  {
    canonical: 'SAC Gym',
    category: 'sports',
    capacity: 40,
    aliases: ['SAC Gym', 'gym', 'sac gym', 'gymnasium'],
  },
  {
    canonical: 'SAC Dance Studio',
    category: 'cultural',
    capacity: 30,
    aliases: ['SAC Dance Studio', 'dance studio', 'sac dance', 'dance room'],
  },
  {
    canonical: 'SAC Music Studio',
    category: 'cultural',
    capacity: 20,
    aliases: ['SAC Music Studio', 'music studio', 'sac music', 'music room'],
  },
  {
    canonical: 'SAC Boxing Arena',
    category: 'sports',
    capacity: 30,
    aliases: ['SAC Boxing Arena', 'boxing arena', 'sac boxing', 'boxing ring'],
  },
  {
    canonical: 'SAC Karate Arena',
    category: 'sports',
    capacity: 30,
    aliases: ['SAC Karate Arena', 'karate arena', 'sac karate', 'martial arts room'],
  },
  {
    canonical: 'SAC Chess and Carom Room',
    category: 'indoor',
    capacity: 20,
    aliases: ['SAC Chess and Carom Room', 'chess room', 'carom room', 'sac chess', 'chess and carom'],
  },

  // ---- Labs: CSE Department ----
  {
    canonical: 'Computer Lab 1',
    category: 'lab',
    capacity: 60,
    aliases: [
      'Computer Lab 1', 'CL-1', 'CL1', 'CL 1', 'CSE Lab 1',
      'comp lab 1', 'cl-1', 'cl1', 'cse lab 1', 'computer lab 1',
    ],
  },
  {
    canonical: 'Computer Lab 2',
    category: 'lab',
    capacity: 60,
    aliases: [
      'Computer Lab 2', 'CL-2', 'CL2', 'CL 2', 'CSE Lab 2',
      'comp lab 2', 'cl-2', 'cl2', 'cse lab 2', 'computer lab 2',
    ],
  },
  {
    canonical: 'Computer Lab 3',
    category: 'lab',
    capacity: 60,
    aliases: [
      'Computer Lab 3', 'CL-3', 'CL3', 'CL 3', 'CSE Lab 3',
      'comp lab 3', 'cl-3', 'cl3', 'cse lab 3', 'computer lab 3',
    ],
  },

  // ---- Labs: ECE/EE Department ----
  {
    canonical: 'Electronics Lab',
    category: 'lab',
    capacity: 40,
    aliases: ['Electronics Lab', 'ECE Lab', 'EE Lab', 'elec lab', 'electronics lab', 'ece lab', 'ee lab'],
  },
  {
    canonical: 'Microwave and Optical Communication Lab',
    category: 'lab',
    capacity: 30,
    aliases: [
      'Microwave and Optical Communication Lab', 'Microwave Lab', 'Optical Comm Lab',
      'MOC Lab', 'microwave optical lab', 'moc lab', 'microwave lab',
    ],
  },
  {
    canonical: 'Digital Signal Processing Lab',
    category: 'lab',
    capacity: 40,
    aliases: ['Digital Signal Processing Lab', 'DSP Lab', 'dsp lab', 'dsp'],
  },
  {
    canonical: 'Communication Lab',
    category: 'lab',
    capacity: 40,
    aliases: ['Communication Lab', 'Comm Lab', 'commlab', 'comm lab', 'communication lab'],
  },
  {
    canonical: 'National Instruments Lab',
    category: 'lab',
    capacity: 30,
    aliases: ['National Instruments Lab', 'NI Lab', 'ni lab', 'national instruments'],
  },
  {
    canonical: 'Texas Instruments Lab',
    category: 'lab',
    capacity: 30,
    aliases: ['Texas Instruments Lab', 'TI Lab', 'ti lab', 'texas instruments'],
  },
  {
    canonical: 'Electrical Characterization Lab',
    category: 'lab',
    capacity: 30,
    aliases: ['Electrical Characterization Lab', 'ECL', 'elec char lab', 'ecl'],
  },

  // ---- Labs: Other ----
  {
    canonical: 'Physics Lab',
    category: 'lab',
    capacity: 40,
    aliases: ['Physics Lab', 'Phy Lab', 'phyLab', 'physics lab', 'phy lab', 'phylab'],
  },
  {
    canonical: 'CAD Lab',
    category: 'lab',
    capacity: 40,
    aliases: ['CAD Lab', 'Computer Aided Design Lab', 'cad lab', 'computer aided design lab'],
  },
  {
    canonical: 'Graphics Lab',
    category: 'lab',
    capacity: 40,
    aliases: ['Graphics Lab', 'gfx lab', 'graphics', 'graphics lab', 'gfx'],
  },
  {
    canonical: 'IBM Laboratory',
    category: 'lab',
    capacity: 30,
    aliases: ['IBM Laboratory', 'IBM Lab', 'ibm lab', 'ibm laboratory'],
  },
  {
    canonical: 'Design Lab',
    category: 'lab',
    capacity: 30,
    aliases: ['Design Lab', 'design lab'],
  },
  {
    canonical: 'Language Lab',
    category: 'lab',
    capacity: 40,
    aliases: ['Language Lab', 'lang lab', 'language lab'],
  },
  {
    canonical: 'Mechanical Lab',
    category: 'lab',
    capacity: 40,
    aliases: ['Mechanical Lab', 'MME Lab', 'mme lab', 'mechanical lab', 'mme'],
  },
  {
    canonical: 'Materials Synthesis Lab',
    category: 'lab',
    capacity: 20,
    aliases: ['Materials Synthesis Lab', 'materials lab', 'materials synthesis lab'],
  },
  {
    canonical: 'Advanced Instrumentation Lab',
    category: 'lab',
    capacity: 30,
    aliases: ['Advanced Instrumentation Lab', 'AI Lab', 'instrumentation lab', 'ai lab'],
  },

  // ---- Sports Venues ----
  {
    canonical: 'Cricket Ground',
    category: 'sports',
    capacity: 500,
    aliases: ['Cricket Ground', 'cricket field', 'cricket ground', 'cricket'],
  },
  {
    canonical: 'Football Ground',
    category: 'sports',
    capacity: 500,
    aliases: ['Football Ground', 'football field', 'soccer ground', 'football ground', 'football'],
  },
  {
    canonical: 'Basketball Court 1',
    category: 'sports',
    capacity: 100,
    aliases: ['Basketball Court 1', 'basketball court 1', 'basketball 1'],
  },
  {
    canonical: 'Basketball Court 2',
    category: 'sports',
    capacity: 100,
    aliases: ['Basketball Court 2', 'basketball court 2', 'basketball 2'],
  },
  {
    canonical: 'Volleyball Court 1',
    category: 'sports',
    capacity: 100,
    aliases: ['Volleyball Court 1', 'volleyball court 1', 'volleyball 1'],
  },
  {
    canonical: 'Volleyball Court 2',
    category: 'sports',
    capacity: 100,
    aliases: ['Volleyball Court 2', 'volleyball court 2', 'volleyball 2'],
  },
  {
    canonical: 'Lawn Tennis Court',
    category: 'sports',
    capacity: 50,
    aliases: ['Lawn Tennis Court', 'tennis court', 'LTC', 'ltc', 'lawn tennis court', 'tennis'],
  },
  {
    canonical: 'Kabaddi Ground',
    category: 'sports',
    capacity: 100,
    aliases: ['Kabaddi Ground', 'kabaddi court', 'kabaddi ground', 'kabaddi'],
  },
  {
    canonical: 'Jogging Track',
    category: 'sports',
    capacity: 200,
    aliases: ['Jogging Track', 'running track', 'cycling track', 'track', 'jogging track'],
  },

  // ---- Outdoor & Common Areas ----
  {
    canonical: 'Main Lawn',
    category: 'outdoor',
    capacity: 300,
    aliases: ['Main Lawn', 'Central Lawn', 'main lawn', 'central lawn'],
  },
  {
    canonical: 'Academic Block Lawn',
    category: 'outdoor',
    capacity: 200,
    aliases: ['Academic Block Lawn', 'academic block lawn', 'academic lawn'],
  },
  {
    canonical: 'Front Lawn',
    category: 'outdoor',
    capacity: 200,
    aliases: ['Front Lawn', 'front lawn'],
  },
  {
    canonical: 'Canteen Area',
    category: 'common',
    capacity: 200,
    aliases: ['Canteen Area', 'canteen', 'mess area', 'dhaba area', 'canteen area'],
  },
  {
    canonical: 'Mess 1',
    category: 'common',
    capacity: 300,
    aliases: ['Mess 1', 'mess 1', 'mess1'],
  },
  {
    canonical: 'Mess 2',
    category: 'common',
    capacity: 300,
    aliases: ['Mess 2', 'mess 2', 'mess2'],
  },

  // ---- Library ----
  {
    canonical: 'Central Library',
    category: 'library',
    capacity: 200,
    aliases: ['Central Library', 'library', 'lib', 'central library'],
  },
  {
    canonical: 'Library Hall 1',
    category: 'library',
    capacity: 50,
    aliases: ['Library Hall 1', 'library hall 1', 'lib hall 1'],
  },
  {
    canonical: 'Library Hall 2',
    category: 'library',
    capacity: 50,
    aliases: ['Library Hall 2', 'library hall 2', 'lib hall 2'],
  },
  {
    canonical: 'Library Hall 3',
    category: 'library',
    capacity: 50,
    aliases: ['Library Hall 3', 'library hall 3', 'lib hall 3'],
  },

  // ---- Hostels and Residential Areas ----
  {
    canonical: 'Boys Hostel 1',
    category: 'residential',
    capacity: 0,
    aliases: ['Boys Hostel 1', 'BH-1', 'BH1', 'hostel 1', 'boys hostel 1', 'bh-1', 'bh1'],
  },
  {
    canonical: 'Boys Hostel 2',
    category: 'residential',
    capacity: 0,
    aliases: ['Boys Hostel 2', 'BH-2', 'BH2', 'hostel 2', 'boys hostel 2', 'bh-2', 'bh2'],
  },
  {
    canonical: 'Boys Hostel 3',
    category: 'residential',
    capacity: 0,
    aliases: ['Boys Hostel 3', 'BH-3', 'BH3', 'hostel 3', 'boys hostel 3', 'bh-3', 'bh3'],
  },
  {
    canonical: 'Boys Hostel 4',
    category: 'residential',
    capacity: 0,
    aliases: ['Boys Hostel 4', 'BH-4', 'BH4', 'hostel 4', 'boys hostel 4', 'bh-4', 'bh4'],
  },
  {
    canonical: 'Girls Hostel',
    category: 'residential',
    capacity: 0,
    aliases: ['Girls Hostel', 'GH-1', 'GH1', 'girls hostel', 'gh-1', 'gh1'],
  },

  // ---- Conference & Meeting Rooms ----
  {
    canonical: 'Conference Hall 1 (Guest House)',
    category: 'conference',
    capacity: 50,
    aliases: ['Conference Hall 1', 'conference hall 1', 'conf hall 1', 'guest house conf 1'],
  },
  {
    canonical: 'Conference Hall 2 (Guest House)',
    category: 'conference',
    capacity: 50,
    aliases: ['Conference Hall 2', 'conference hall 2', 'conf hall 2', 'guest house conf 2'],
  },
  {
    canonical: 'Conference Hall 3 (Guest House)',
    category: 'conference',
    capacity: 50,
    aliases: ['Conference Hall 3', 'conference hall 3', 'conf hall 3', 'guest house conf 3'],
  },
  {
    canonical: "Director's Conference Room",
    category: 'conference',
    capacity: 30,
    aliases: ["Director's Conference Room", 'directors conference room', 'dcr', "director's room"],
  },
  {
    canonical: 'Board Room',
    category: 'conference',
    capacity: 20,
    aliases: ['Board Room', 'boardroom', 'board room'],
  },

  // ---- Medical & Other ----
  {
    canonical: 'Medical Centre',
    category: 'other',
    capacity: 0,
    aliases: ['Medical Centre', 'clinic', 'health centre', 'dispensary', 'medical centre', 'health center'],
  },
  {
    canonical: 'Temple',
    category: 'other',
    capacity: 50,
    aliases: ['Temple', 'temple', 'mandir'],
  },
  {
    canonical: 'Shopping Complex',
    category: 'other',
    capacity: 0,
    aliases: ['Shopping Complex', 'shopping complex', 'shops', 'market'],
  },
  {
    canonical: 'Guest House',
    category: 'other',
    capacity: 0,
    aliases: ['Guest House', 'guest house', 'guesthouse'],
  },
];

// ---- Helper Functions ----

/**
 * Normalize a string for comparison:
 * - Convert to lowercase
 * - Remove hyphens, extra spaces, and special characters
 * - Trim whitespace
 */
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[-_]/g, '') // Remove hyphens and underscores
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching when exact/alias matches fail.
 * Lower distance = more similar strings.
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ---- Main Resolution Functions ----

/**
 * Resolve a user-typed venue name to its canonical form.
 * Returns { resolved: true/false, canonical, venue, suggestions, error }
 *
 * @param {string} input - The raw venue name typed by the user
 * @returns {Object} Resolution result
 */
function resolveVenue(input) {
  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    return { resolved: false, error: 'Venue name is required' };
  }

  const normalizedInput = normalize(input);

  // Step 1: Exact match on canonical name (case-insensitive, normalized)
  for (const venue of VENUE_DATABASE) {
    if (normalize(venue.canonical) === normalizedInput) {
      return {
        resolved: true,
        canonical: venue.canonical,
        venue,
        matchType: 'exact',
      };
    }
  }

  // Step 2: Check against all aliases (normalized)
  for (const venue of VENUE_DATABASE) {
    for (const alias of venue.aliases) {
      if (normalize(alias) === normalizedInput) {
        return {
          resolved: true,
          canonical: venue.canonical,
          venue,
          matchType: 'alias',
        };
      }
    }
  }

  // Step 3: Fuzzy matching with Levenshtein distance. The allowed distance
  // grows with the length of the input, up to 2: a fixed 2 lets any three-letter
  // string "match" some short alias, so "xyz" would have booked the SAC Gym.
  const maxDistance = Math.min(2, Math.floor(normalizedInput.length / 4));
  const suggestions = [];

  for (const venue of VENUE_DATABASE) {
    // Check canonical name
    const canonicalDist = levenshteinDistance(normalizedInput, normalize(venue.canonical));
    if (canonicalDist <= maxDistance && canonicalDist > 0) {
      suggestions.push({ venue, distance: canonicalDist, matchedOn: venue.canonical });
    }

    // Check aliases
    for (const alias of venue.aliases) {
      const aliasDist = levenshteinDistance(normalizedInput, normalize(alias));
      if (aliasDist <= maxDistance && aliasDist > 0) {
        // Avoid duplicate suggestions for the same venue
        const existing = suggestions.find(s => s.venue.canonical === venue.canonical);
        if (!existing || existing.distance > aliasDist) {
          if (existing) {
            existing.distance = aliasDist;
            existing.matchedOn = alias;
          } else {
            suggestions.push({ venue, distance: aliasDist, matchedOn: alias });
          }
        }
      }
    }
  }

  // Sort suggestions by distance (closest match first)
  suggestions.sort((a, b) => a.distance - b.distance);

  if (suggestions.length === 1) {
    // Single close match: auto-resolve with suggestion
    return {
      resolved: true,
      canonical: suggestions[0].venue.canonical,
      venue: suggestions[0].venue,
      matchType: 'fuzzy',
      suggestion: true,
    };
  }

  if (suggestions.length > 1) {
    // Ambiguous: return suggestions for user to choose
    return {
      resolved: false,
      ambiguous: true,
      suggestions: suggestions.slice(0, 5).map(s => ({
        canonical: s.venue.canonical,
        category: s.venue.category,
        capacity: s.venue.capacity,
        distance: s.distance,
      })),
      error: 'Ambiguous venue name. Please select from the suggestions.',
    };
  }

  // No match found at all
  return {
    resolved: false,
    error: `Venue "${input}" not found. Please check the spelling or choose from the venue list.`,
  };
}

/**
 * Get all venues, optionally filtered by category.
 */
function getAllVenues(category = null) {
  if (category) {
    return VENUE_DATABASE.filter(v => v.category === category);
  }
  return VENUE_DATABASE;
}

/**
 * Get a venue by its canonical name.
 */
function getVenueByCanonical(canonical) {
  return VENUE_DATABASE.find(v => v.canonical === canonical) || null;
}

/**
 * Search venues by partial name match.
 */
function searchVenues(query) {
  const normalizedQuery = normalize(query);
  return VENUE_DATABASE.filter(venue => {
    if (normalize(venue.canonical).includes(normalizedQuery)) return true;
    return venue.aliases.some(alias => normalize(alias).includes(normalizedQuery));
  });
}

module.exports = {
  resolveVenue,
  getAllVenues,
  getVenueByCanonical,
  searchVenues,
  VENUE_DATABASE,
  normalize,
};
