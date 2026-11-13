// lib/tryOn/garments.js
//
// The garments that have a drape pack, and which body group each belongs to. A pack was built on made-up bodies of one group, so a scan uses the
// garments of its own group. `key` is the name used in the pack files (tryon-packs/v1/<group>/<key>_<size>.zdp) and in the sizing file.
export const GARMENTS = [
  { key: 'shorts', group: 'men', label: "Men's Shorts", icon: 'cut-outline' },
  { key: 'sweatpants', group: 'men', label: "Men's Sweatpants", icon: 'walk-outline' },
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

export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
export const sortSizes = (sizes) => [...sizes].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
