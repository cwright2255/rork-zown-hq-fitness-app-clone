// lib/virtualJourneys.js
//
// Virtual journeys: pick a real-world route (the Grand Canyon Rim Trail, the road
// from Marathon to Athens, the Camino Francés) and every run and walk you record
// after joining adds to it, until you have covered the route's length. A journey
// has four milestones (a quarter, half, three quarters, the finish) and pays XP
// and a badge when you finish. There is no physical medal.
//
// This file is the catalogue and the sums; nothing here saves anything. What a
// person has joined and covered is kept by store/virtualChallengeStore.js, and the
// reward by services/journeyRewards.js. All distances are kilometres, like the rest
// of the app; what a person sees follows Settings > Distance Units
// (lib/distanceUnits.js).
//
// Route lengths are the usual published figures, rounded to the kilometre. The places
// named at the milestones are approximate: each is somewhere near that point on the
// route, not an exact mark.

import { distanceIn, distanceUnitLabel } from './distanceUnits';

/** How far along each milestone is, in per cent of the route. */
export const MILESTONE_PERCENTS = [25, 50, 75, 100];
const MILESTONE_NAMES = {
  25: 'A quarter of the way',
  50: 'Halfway',
  75: 'Three quarters',
  100: 'The finish',
};

/**
 * landmarks: a place near each milestone, in order: the quarter, the half, three
 * quarters and the finish. The first three are shown as "near <place>"; the last is
 * where the route ends.
 */
export const JOURNEYS = [
  { id: 'grand-canyon-rim', title: 'Grand Canyon Rim Trail', distanceKm: 21, region: 'Arizona, USA', blurb: 'From Hermits Rest to the South Kaibab Trailhead, along the South Rim of the Grand Canyon.', landmarks: ['Hopi Point', 'Trailview Overlook', 'Yavapai Point', 'South Kaibab Trailhead'] },
  { id: 'marathon-to-athens', title: 'Marathon to Athens', distanceKm: 42, region: 'Greece', blurb: 'The route that gave the marathon its name, from the town of Marathon to Athens.', landmarks: ['Nea Makri', 'Pikermi', 'Mesogeion Avenue', 'Panathenaic Stadium'] },
  { id: 'inca-trail', title: 'Inca Trail', distanceKm: 43, region: 'Peru', blurb: 'The classic trek to Machu Picchu.', landmarks: ['Wayllabamba', 'Runkurakay Pass', 'Phuyupatamarca', 'Machu Picchu'] },
  { id: 'great-ocean-walk', title: 'Great Ocean Walk', distanceKm: 104, region: 'Victoria, Australia', blurb: 'A coastal walk along the Great Ocean Road.', landmarks: ['Cape Otway', 'Johanna Beach', 'Moonlight Head', 'Twelve Apostles'] },
  { id: 'hadrians-wall', title: "Hadrian's Wall Path", distanceKm: 135, region: 'England, UK', blurb: 'Coast to coast across northern England, beside the Roman wall.', landmarks: ['Rudchester', 'Housesteads', 'Birdoswald', 'Bowness-on-Solway'] },
  { id: 'west-highland-way', title: 'West Highland Way', distanceKm: 154, region: 'Scotland, UK', blurb: 'From Milngavie to Fort William, through the Scottish Highlands.', landmarks: ['Rowardennan', 'Crianlarich', 'Kingshouse', 'Fort William'] },
  { id: 'tour-du-mont-blanc', title: 'Tour du Mont Blanc', distanceKm: 170, region: 'France, Italy and Switzerland', blurb: 'A loop around the Mont Blanc massif through three countries.', landmarks: ['Les Chapieux', 'Grand Col Ferret', 'Champex-Lac', 'Les Houches'] },
  { id: 'john-muir-trail', title: 'John Muir Trail', distanceKm: 340, region: 'California, USA', blurb: 'Through the Sierra Nevada, from Yosemite Valley to Mount Whitney.', landmarks: ['Devils Postpile', 'Muir Trail Ranch', 'Pinchot Pass', 'Mount Whitney'] },
  { id: 'camino-frances', title: 'Camino de Santiago (Camino Francés)', distanceKm: 780, region: 'France–Spain', blurb: 'The best known pilgrim route, from the French Pyrenees to Santiago de Compostela.', landmarks: ['Santo Domingo de la Calzada', 'Frómista', 'Ponferrada', 'Santiago de Compostela'] },
];

/** The journey with this id, or null. */
export function journeyById(id) {
  return JOURNEYS.find((journey) => journey.id === id) || null;
}

/**
 * The four milestones of a journey: { percent, name, atKm, place }, where place says
 * where on the route it is: "near Housesteads", and for the finish, the place itself.
 */
export function milestonesFor(journey) {
  if (!journey) return [];
  return MILESTONE_PERCENTS.map((percent, i) => {
    const landmark = journey.landmarks[i];
    return {
      percent,
      name: MILESTONE_NAMES[percent],
      atKm: (journey.distanceKm * percent) / 100,
      place: percent === 100 ? landmark : `near ${landmark}`,
    };
  });
}

/**
 * True for a saved record of a journey the person is on: one never left, or one joined
 * again after being left. (A left journey keeps its record, with leftAt, so the leaving
 * reaches the person's other phones; see store/virtualChallengeStore.js.)
 */
export function isActiveRecord(record) {
  return !!record && (!record.leftAt || record.startedAt > record.leftAt);
}

/**
 * Where a person is on a journey.
 * @param journey a catalogue entry
 * @param record  what the store keeps for them ({ distanceKm, completedAt, startedAt, leftAt }), or nothing if they have not joined or have left
 * @returns {{ joined, coveredKm, leftKm, fraction, percent, reached, completed, next }}
 *   fraction  0 to 1, for a progress bar
 *   percent   whole per cent (never 100 until the route is done)
 *   reached   how many of the four milestones are behind them
 *   next      the next milestone, or null once finished
 */
export function journeyProgress(journey, record) {
  const total = journey ? journey.distanceKm : 0;
  const joined = !!journey && isActiveRecord(record);
  const logged = joined ? Number(record.distanceKm) : 0;
  const covered = Number.isFinite(logged) ? Math.max(0, logged) : 0;
  const done = joined && (!!record.completedAt || covered >= total);
  // Short of the finish, covered is always under the route's length.
  const coveredKm = done ? total : covered;
  const fraction = total > 0 ? coveredKm / total : 0;
  const milestones = milestonesFor(journey);
  const reached = milestones.filter((m) => coveredKm >= m.atKm).length;
  return {
    joined,
    coveredKm,
    leftKm: total - coveredKm,
    fraction,
    percent: Math.floor(fraction * 100),
    reached,
    completed: done,
    next: milestones[reached] || null,
  };
}

/** XP for finishing a journey, by how long it is. */
export function journeyXp(distanceKm) {
  if (distanceKm < 100) return 500;
  if (distanceKm < 400) return 1000;
  return 2000;
}

/** A route length for a card: "42 km", "26.1 mi", "135 km". */
export function journeyLength(distanceKm, units) {
  const value = distanceIn(distanceKm, units);
  const digits = Number.isInteger(value) || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${distanceUnitLabel(units)}`;
}

/** The line under a journey's name on a card: "42 km · 4 milestones". */
export function journeySubtitle(journey, units) {
  return `${journeyLength(journey.distanceKm, units)} · ${MILESTONE_PERCENTS.length} milestones`;
}
