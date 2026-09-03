// data/communityGroups.js
//
// Real starter catalog for store/groupStore.js — same fallback role
// data/runningPrograms.js plays for store/runningStore.js: used only if
// Firestore's communityGroups collection is empty or unreachable, so
// the app never shows nothing just because a migration hasn't run yet.
// memberCount starts at 0, not a fabricated number — these groups
// genuinely have no members until real people join them.

export const COMMUNITY_GROUPS = [
  {
    id: 'zown-runners',
    name: 'Zown Runners',
    description: 'For anyone building a running habit, first mile to marathon.',
    icon: 'fitness-outline',
    memberCount: 0,
  },
  {
    id: 'strength-collective',
    name: 'Strength Collective',
    description: 'Progressive overload, real PRs, and lifting accountability.',
    icon: 'barbell-outline',
    memberCount: 0,
  },
  {
    id: 'consistency-club',
    name: 'Consistency Club',
    description: 'Show up, log it, keep the streak alive.',
    icon: 'flame-outline',
    memberCount: 0,
  },
];
