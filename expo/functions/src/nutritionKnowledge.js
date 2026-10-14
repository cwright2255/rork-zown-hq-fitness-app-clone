// What getNutritionRecommendations (functions/src/index.js) tells the model about food, beyond the
// person's own numbers. Every line comes from functions/EXERCISE_SCIENCE_KNOWLEDGE.md, sections 6 and 8,
// which has the sources. Change a line here and its section there together.
export const NUTRITION_EVIDENCE_NOTES = [
  'Evidence to apply. Let it shape the numbers and the meal ideas; do not recite it back as a lecture.',
  '- Fiber: about 14 g per 1,000 kcal, roughly 25 g a day for women and 38 g for men. Raise it gradually and with water.',
  '- Protein: for an active adult, 1.2-2.0 g per kg a day (the sports-nutrition position stand range), spread over meals of roughly 0.25-0.4 g per kg (20-40 g) each.',
  '- Carbohydrate for training: roughly 3-10 g per kg a day depending on training load, up to 12 g per kg for extreme volumes. Fat: 20-35% of calories.',
  '- Limits (WHO): free sugars under 10% of calories (under 5% gives extra benefit), saturated fat under 10%, trans fat under 1%, salt under 5 g a day. Aim for at least 400 g of vegetables and fruit a day.',
  '- Alcohol: about 7 kcal a gram, so a standard drink (12 oz beer, 5 oz wine or 1.5 oz spirits) is roughly 100-150 kcal before mixers, with little else in it; it fills you up less than food, slows the burning of dietary fat and can disrupt sleep. Do not put alcoholic drinks in meal ideas or suggest them for health, fitness or recovery. If you mention alcohol: the 2020-2025 US Dietary Guidelines say not drinking is fine and, if drinking, at most 1 drink a day for women and 2 for men (the 2025-2030 edition says to consume less alcohol), and drinks belong away from training, because heavy drinking after hard sessions lowers muscle protein synthesis; anyone pregnant or trying to conceive, in recovery from alcohol use disorder, or with liver disease or interacting medication should not drink, or should ask a doctor first.',
  '- Prefer minimally processed foods. In an NIH trial people ate about 500 more calories a day on an ultra-processed diet than on an unprocessed one with matched nutrients.',
  '- For a very active person, never set a deficit big enough to risk low energy availability (poor recovery, constant fatigue, missed periods); if those signs are mentioned, say to see a doctor or sports dietitian.',
  '- If the dietary preference carries a note about risks or about who it is not suitable for, apply it: name the single most relevant caution in the summary, never claim a diet treats or cures a disease, and for medical conditions, medications, pregnancy or a history of eating disorders say to check with a doctor or registered dietitian.',
  '- If the preference is intuitive eating, give the numbers as a flexible rough estimate at maintenance with no deficit, and keep the wording free of rules about good and bad foods.',
].join('\n');
