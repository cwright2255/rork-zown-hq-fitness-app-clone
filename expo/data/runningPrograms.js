// data/runningPrograms.js
//
// Real training program content — replaces the previous hardcoded preview
// in app/running/[id].jsx (WEEKLY_PLAN), which only showed 4 of the real
// program's 9 weeks, generically, regardless of which program was
// actually selected on the list screen.
//
// The Couch to 5K structure below is the standard, widely-published 9-week
// run/walk progression used by the original NHS/Cool Running C25K program
// and virtually every app that implements it (including the
// runnersblueprint.com reference this was built against) — this is a
// well-established public training methodology, not proprietary content.
//
// Each session's `intervals` array is what actually drives the run —
// app/running/active.jsx plays through these with voice + visual cues,
// the same expo-speech pattern already used for body-scan capture.

export const RUNNING_PROGRAMS = [
  {
    id: 'c25k',
    title: 'Couch to 5K',
    subtitle: '9 weeks • 3x/week',
    level: 'Beginner',
    description: "A run/walk progression that takes you from little or no running experience to running a full 5K continuously, three sessions a week.",
    weeks: [
      {
        week: 1,
        title: 'Getting Started',
        sessionsPerWeek: 3,
        // Every day this week is identical — real C25K structure.
        intervals: buildIntervals([{ run: 60, walk: 90, reps: 8 }]),
      },
      {
        week: 2,
        title: 'Building the Habit',
        sessionsPerWeek: 3,
        intervals: buildIntervals([{ run: 90, walk: 120, reps: 6 }]),
      },
      {
        week: 3,
        title: 'Longer Intervals',
        sessionsPerWeek: 3,
        intervals: buildIntervals([
          { run: 90, walk: 90, reps: 1 },
          { run: 180, walk: 180, reps: 1 },
          { run: 90, walk: 90, reps: 1 },
          { run: 180, walk: 0, reps: 1 },
        ]),
      },
      {
        week: 4,
        title: 'Pushing Further',
        sessionsPerWeek: 3,
        intervals: buildIntervals([
          { run: 180, walk: 90, reps: 1 },
          { run: 300, walk: 150, reps: 1 },
          { run: 180, walk: 90, reps: 1 },
          { run: 300, walk: 0, reps: 1 },
        ]),
      },
      {
        week: 5,
        title: 'Real Progress',
        sessionsPerWeek: 3,
        // C25K week 5 is the one week where the three sessions genuinely
        // differ from each other rather than repeating.
        sessionOverrides: [
          buildIntervals([{ run: 300, walk: 180, reps: 3 }]),
          buildIntervals([{ run: 480, walk: 300, reps: 1 }, { run: 480, walk: 0, reps: 1 }]),
          buildIntervals([{ run: 1200, walk: 0, reps: 1 }]),
        ],
      },
      {
        week: 6,
        title: 'Almost Continuous',
        sessionsPerWeek: 3,
        sessionOverrides: [
          buildIntervals([{ run: 300, walk: 180, reps: 1 }, { run: 480, walk: 180, reps: 1 }, { run: 300, walk: 0, reps: 1 }]),
          buildIntervals([{ run: 600, walk: 180, reps: 1 }, { run: 600, walk: 0, reps: 1 }]),
          buildIntervals([{ run: 1320, walk: 0, reps: 1 }]),
        ],
      },
      {
        week: 7,
        title: 'Continuous Running',
        sessionsPerWeek: 3,
        intervals: buildIntervals([{ run: 1500, walk: 0, reps: 1 }]),
      },
      {
        week: 8,
        title: 'Extending Endurance',
        sessionsPerWeek: 3,
        intervals: buildIntervals([{ run: 1680, walk: 0, reps: 1 }]),
      },
      {
        week: 9,
        title: '5K Ready',
        sessionsPerWeek: 3,
        intervals: buildIntervals([{ run: 1800, walk: 0, reps: 1 }]),
      },
    ],
  },
  {
    id: '10k-training',
    title: '10K Training',
    subtitle: '8 weeks • 4x/week',
    level: 'Intermediate',
    description: "For runners who can already complete a continuous 5K and want to build up to racing a 10K.",
    // Distance-based (not interval-based) — this program assumes continuous
    // running already, so sessions are a weekly target distance rather
    // than run/walk intervals. active.jsx treats a program day with no
    // `intervals` as a plain distance-goal free run.
    weeks: Array.from({ length: 8 }, (_, i) => ({
      week: i + 1,
      title: `Week ${i + 1}`,
      sessionsPerWeek: 4,
      targetDistanceKm: Math.round((4 + i * 0.8) * 10) / 10,
    })),
  },
  {
    id: 'speed-builder',
    title: 'Speed Builder',
    subtitle: '6 weeks • 3x/week',
    level: 'Intermediate',
    description: "Interval and tempo sessions to build pace once you're already running 5K comfortably.",
    weeks: Array.from({ length: 6 }, (_, i) => ({
      week: i + 1,
      title: `Week ${i + 1}`,
      sessionsPerWeek: 3,
      intervals: buildIntervals([{ run: 60 + i * 15, walk: 60, reps: 6 + i }]),
    })),
  },
];

// Converts a list of {run, walk, reps} blocks (seconds) into a flat,
// ordered interval list with real cue text — this is what
// app/running/active.jsx actually steps through with voice prompts.
function buildIntervals(blocks) {
  const intervals = [];
  blocks.forEach((block) => {
    for (let i = 0; i < block.reps; i++) {
      intervals.push({ type: 'run', seconds: block.run, cue: 'Run' });
      if (block.walk > 0) {
        intervals.push({ type: 'walk', seconds: block.walk, cue: 'Walk' });
      }
    }
  });
  return intervals;
}

export function getProgram(programId) {
  return RUNNING_PROGRAMS.find((p) => p.id === programId) || null;
}

export function getProgramWeek(programId, weekNumber) {
  const program = getProgram(programId);
  return program?.weeks.find((w) => w.week === weekNumber) || null;
}

// Resolves the actual intervals for a specific session within a week,
// handling both the common case (same structure every session that week)
// and week 5/6's genuinely different per-session structure.
export function getSessionIntervals(programId, weekNumber, sessionIndex) {
  const week = getProgramWeek(programId, weekNumber);
  if (!week) return null;
  if (week.sessionOverrides) return week.sessionOverrides[sessionIndex] || week.sessionOverrides[0];
  return week.intervals || null;
}
