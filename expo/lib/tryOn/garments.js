// lib/tryOn/garments.js
//
// The garments that have a drape pack, and which body group each belongs to. A pack was built on made-up bodies of one group, so a scan uses the
// garments of its own group. `key` is the name used in the pack files (tryon-packs/v1/<group>/<key>_<size>.zdp) and in the sizing file.
// `waistband` marks the garments whose band is set just under the navel (lib/tryOn/waistline.js), so a belly hangs over the band instead of being tucked
// inside it: `true` squashes the whole garment about its hem (the shorts), 'tilt' moves only the part above the seat and only at the front (the sweatpants:
// their legs and crotch stay as simulated, and the band is lower in front than behind).
// `slot` is where on the body the garment is worn: 'top' or 'bottom'. One garment of each slot can be worn at once (a hoodie over sweatpants or shorts); a top is drawn
// over a bottom (lib/tryOn/outfit.js), and the bottom's own fit is never changed by it.
// `aroundEars: true` marks the garment that goes round the ears (the hood): a point out beside an ear is judged to be outside it rather than pulled in against the
// ear's rim (lib/tryOn/pushOut.js, smoothSide).
// `relax` (metres) gives the garment that much more room round the body, out from the skin, with the waistband, hem and crotch left alone (lib/tryOn/relax.js):
// the sweatpants hang a little looser than the snug fit the simulation gave them. Raise it for looser, lower it (0 = as simulated) for closer.
// `ankleHem: true` marks the garments whose hem is brought to the wearer's ankle bone (lib/tryOn/legLength.js): none now, because the sweatpants packs built
// from the v2.2 pattern come with the hem at the ankle.
export const GARMENTS = [
  { key: 'shorts', group: 'men', label: "Men's Shorts", icon: 'cut-outline', slot: 'bottom', waistband: true },
  { key: 'sweatpants', group: 'men', label: "Men's Sweatpants", icon: 'walk-outline', slot: 'bottom', waistband: 'tilt', relax: 0.015 },
  { key: 'hoodie', group: 'men', label: "Men's Hoodie", icon: 'shirt-outline', slot: 'top', aroundEars: true },
  { key: 'bra', group: 'women', label: "Women's Sports Bra", icon: 'shirt-outline', slot: 'top' },
  { key: 'cami', group: 'women', label: "Women's Cami", icon: 'shirt-outline', slot: 'top' },
];

/** The body group a scan belongs to: the scan's gender is 'male' or 'female'. null when it is neither. */
export function groupForGender(gender) {
  if (gender === 'male') return 'men';
  if (gender === 'female') return 'women';
  return null;
}

export function garmentsForGroup(group) {
  return GARMENTS.filter((g) => g.group === group);
}

/** True when the garment's hem is brought to the wearer's ankle bone (no garment is at present). */
export function hasAnkleHem(group, key) {
  return GARMENTS.some((g) => g.group === group && g.key === key && g.ankleHem === true);
}

/** How the garment's band is set under the navel: 'hem' (squash about the hem), 'tilt' (lowered at the front, above the seat), or null when it is not. */
export function waistbandKind(group, key) {
  const g = GARMENTS.find((x) => x.group === group && x.key === key);
  if (!g) return null;
  if (g.waistband === true) return 'hem';
  return g.waistband === 'tilt' ? 'tilt' : null;
}

/** True when the garment goes round the wearer's ears (the hood), so the push off the skin must not pull it in against them. */
export function goesAroundEars(group, key) {
  return GARMENTS.some((g) => g.group === group && g.key === key && g.aroundEars === true);
}

/** How much more room, in metres, the garment is given round the body (lib/tryOn/relax.js); 0 for a garment that is worn as simulated. */
export function relaxAmount(group, key) {
  const g = GARMENTS.find((x) => x.group === group && x.key === key);
  return g && typeof g.relax === 'number' && g.relax > 0 ? g.relax : 0;
}

/** True when the garment's band is set under the navel (the shorts and the sweatpants). */
export function hasWaistband(group, key) {
  return waistbandKind(group, key) !== null;
}

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
export const sortSizes = (sizes) => [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
