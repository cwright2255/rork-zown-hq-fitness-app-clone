// lib/tryOn/garments.js
//
// The garments that have a drape pack, and which body group each belongs to. A pack was built on made-up bodies of one group, so a scan uses the
// garments of its own group. `key` is the name used in the pack files (tryon-packs/v1/<group>/<key>_<size>.zdp) and in the sizing file.
// `waistband: true` marks the garments worn from the waist down: their band is set just under the navel (lib/tryOn/waistline.js).
export const GARMENTS = [
  { key: 'shorts', group: 'men', label: "Men's Shorts", icon: 'cut-outline', waistband: true },
  { key: 'sweatpants', group: 'men', label: "Men's Sweatpants", icon: 'walk-outline', waistband: true },
  { key: 'bra', group: 'women', label: "Women's Sports Bra", icon: 'shirt-outline' },
  { key: 'cami', group: 'women', label: "Women's Cami", icon: 'shirt-outline' },
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

/** True when the garment is worn from the waist down, so its band goes under the navel. */
export function hasWaistband(group, key) {
  return GARMENTS.some((g) => g.group === group && g.key === key && g.waistband === true);
}

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
export const sortSizes = (sizes) => [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
