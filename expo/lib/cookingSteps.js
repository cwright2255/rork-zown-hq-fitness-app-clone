// lib/cookingSteps.js
//
// A recipe's instructions as the list of steps that cooking mode shows one at a
// time. Saved recipes keep them as a list of text, but an import can leave the
// step number in the text ("1. Mix", "Step 2: Bake"); cooking mode has its own
// "Step 2 of 6", so that number is taken off. A single block of text is split
// at its line breaks.

const NUMBERING = /^(?:step\s*)?\d+\s*[.):]\s+/i;

export function cookingSteps(instructions) {
  const list = typeof instructions === 'string' ? instructions.split('\n') : instructions;
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => typeof s === 'string')
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(NUMBERING, ''))
    .filter(Boolean);
}
