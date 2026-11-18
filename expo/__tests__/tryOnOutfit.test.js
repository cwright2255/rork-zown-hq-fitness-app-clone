// What is worn at once (lib/tryOn/outfit.js): one top and one bottom, a top over a bottom.
import { SLOTS, EMPTY_OUTFIT, slotOf, tapGarment, wornKeys, isWorn, wornOver, wornUnder } from '../lib/tryOn/outfit';
import { GARMENTS, goesAroundEars } from '../lib/tryOn/garments';

describe('slots', () => {
  it('puts every garment in the top or the bottom slot, with the hoodie a top and the shorts and sweatpants bottoms', () => {
    for (const g of GARMENTS) expect(['top', 'bottom']).toContain(g.slot);
    expect(slotOf('men', 'hoodie')).toBe('top');
    expect(slotOf('men', 'sweatpants')).toBe('bottom');
    expect(slotOf('men', 'shorts')).toBe('bottom');
    expect(slotOf('women', 'bra')).toBe('top');
    expect(slotOf('women', 'cami')).toBe('top');
  });

  it('does not know a garment of another group or one that does not exist', () => {
    expect(slotOf('women', 'hoodie')).toBeNull();
    expect(slotOf('men', 'bra')).toBeNull();
    expect(slotOf('men', 'jacket')).toBeNull();
  });

  it('is under before over, so the bottom comes first', () => {
    expect(SLOTS).toEqual(['bottom', 'top']);
  });
});

describe('tapGarment', () => {
  it('puts a garment on in its slot, and takes it off when it is tapped again', () => {
    let o = tapGarment(EMPTY_OUTFIT, 'men', 'sweatpants');
    expect(o).toEqual({ top: null, bottom: 'sweatpants' });
    o = tapGarment(o, 'men', 'hoodie');
    expect(o).toEqual({ top: 'hoodie', bottom: 'sweatpants' });
    o = tapGarment(o, 'men', 'hoodie');
    expect(o).toEqual({ top: null, bottom: 'sweatpants' });
    o = tapGarment(o, 'men', 'sweatpants');
    expect(o).toEqual({ top: null, bottom: null });
  });

  it('replaces the garment worn in the same slot: shorts instead of sweatpants, with the hoodie kept', () => {
    const o = tapGarment({ top: 'hoodie', bottom: 'sweatpants' }, 'men', 'shorts');
    expect(o).toEqual({ top: 'hoodie', bottom: 'shorts' });
  });

  it('changes nothing for a garment the group does not have, and never changes the outfit it was given', () => {
    const start = Object.freeze({ top: 'hoodie', bottom: 'shorts' });
    expect(tapGarment(start, 'women', 'hoodie')).toBe(start);
    expect(tapGarment(start, 'men', 'jacket')).toBe(start);
    tapGarment(start, 'men', 'sweatpants');
    expect(start).toEqual({ top: 'hoodie', bottom: 'shorts' });
  });
});

describe('what is worn', () => {
  it('lists the garments worn, the bottom first, and answers what is under and over what', () => {
    const o = { top: 'hoodie', bottom: 'sweatpants' };
    expect(wornKeys(o)).toEqual(['sweatpants', 'hoodie']);
    expect(wornKeys({ top: 'hoodie', bottom: null })).toEqual(['hoodie']);
    expect(wornKeys(EMPTY_OUTFIT)).toEqual([]);
    expect(isWorn(o, 'hoodie')).toBe(true);
    expect(isWorn(o, 'shorts')).toBe(false);
    expect(wornUnder(o, 'hoodie')).toEqual(['sweatpants']);
    expect(wornUnder(o, 'sweatpants')).toEqual([]);
    expect(wornOver(o, 'sweatpants')).toEqual(['hoodie']);
    expect(wornOver(o, 'hoodie')).toEqual([]);
    expect(wornUnder({ top: 'hoodie', bottom: null }, 'hoodie')).toEqual([]);
  });
});

describe('the hood', () => {
  it('is the only garment that goes round the ears, so the only one pushed off the skin by the smoothed side test', () => {
    expect(goesAroundEars('men', 'hoodie')).toBe(true);
    for (const g of GARMENTS.filter((x) => x.key !== 'hoodie')) expect(goesAroundEars(g.group, g.key)).toBe(false);
    expect(goesAroundEars('women', 'hoodie')).toBe(false);
  });
});
