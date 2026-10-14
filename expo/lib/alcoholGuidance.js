// What the AI is told about alcohol. The facts come from functions/EXERCISE_SCIENCE_KNOWLEDGE.md, section 8.1
// ("Alcohol"), which has the sources: Harvard's Nutrition Source and Healthline on alcohol, the Dietary
// Guidelines for Americans, and three articles on alcohol and muscle (ScienceInsights, Strengthlog, Basics of
// Bodybuilding) that cite the studies behind the muscle figures. The same facts, in a shorter form, sit in functions/src/nutritionKnowledge.js for the
// cloud function that sets calorie targets. Change a line here and its section there together.
//
// The 1-drink and 2-drink limits are the 2020-2025 Dietary Guidelines'. The 2025-2030 edition dropped the numbers
// ("consume less alcohol for better health"), and both lines say so rather than quote the old limits as current.
// The star rating (lib/foodRating.js) marks alcoholic drinks down for the same reasons.

// The AI Coach reads this on every conversation (services/coachService.js).
export const ALCOHOL_COACH_NOTE =
  'Alcohol: raise it only when it bears on what they ask or log, and never lecture. ' +
  'Facts: about 7 calories a gram (second only to fat); a US standard drink (12 oz beer, 5 oz wine or 1.5 oz spirits, 14 g of alcohol) ' +
  'is roughly 100-150 calories before mixers, which add more; it fills you up less than food, may raise hunger, slows the burning of dietary fat, ' +
  'can disrupt sleep and blocks folate absorption. ' +
  'It is a known carcinogen and the heart benefits seen in studies do not outweigh the harms, so never suggest drinking, or starting to drink, ' +
  'for health, fitness or recovery. ' +
  'Limits: the 2020-2025 US Dietary Guidelines say not drinking is fine and, if drinking, at most 1 drink a day for women and 2 for men, ' +
  'with less being better; the 2025-2030 edition only says to consume less alcohol for better health. ' +
  'Heavy drinking is more than 3 drinks a day for women and more than 4 for men. ' +
  'If someone is pregnant or trying to conceive, in recovery from alcohol use disorder, living with liver disease or taking medication that interacts with alcohol, ' +
  'say not to drink or to ask a doctor first; if someone cannot cut down, suggest a doctor. ' +
  'The app\'s food ratings mark alcoholic drinks down (beer, wine and cider to 2 stars at most; spirits and fortified wine to 1 star) when the food data shows alcohol; ' +
  'present that as nutrition, not a judgment of the person. ' +
  'Muscle, recovery and performance: a heavy night (roughly 6-10 drinks for an 80 kg person, 1-1.5 g of alcohol per kg) after hard training cut muscle protein synthesis ' +
  'by up to 37% in one small study of 8 men, and by about 24% even with whey protein; heavy drinking also lowers testosterone for 12-24 hours, raises cortisol, ' +
  'and disrupts sleep and growth-hormone timing. ' +
  'For lighter drinking the evidence is thin, so say so: there are no human muscle-protein-synthesis data at low doses, a review found about 0.5 g per kg ' +
  '(2-3 drinks for an 80 kg person) unlikely to affect recovery much, and large studies link only heavy drinking to lower muscle mass (3-6% lower in UK Biobank). ' +
  'So: light drinking is unlikely to matter much but is not proven harmless, and none is best for gains. ' +
  'Tips: not before training or right after a hard session (rest days are better); eat about 25 g of protein and some carbohydrate first, which softens the hit but does not remove it; ' +
  'alternate drinks with water; count the calories, because drinking also raises how much people eat.';

// The shorter form for the nutrition advice request (services/aiService.js generateNutritionAdvice), which
// answers in 120-180 words and has no chat.
export const ALCOHOL_NUTRITION_NOTE =
  'Alcohol: never suggest it as a food, drink or recovery aid. It is about 7 calories a gram with little else in it ' +
  '(a standard drink is roughly 100-150 calories before mixers), fills you up less than food, slows the burning of dietary fat and can disrupt sleep. ' +
  'If the person says they drink, count it in their calories and point to the guideline: not drinking is fine, and if drinking, ' +
  'at most 1 drink a day for women and 2 for men (2020-2025 US Dietary Guidelines; the 2025-2030 edition says to consume less alcohol), ' +
  'and keep it away from training: heavy drinking after hard sessions lowers muscle protein synthesis, so eat protein and carbohydrate first. ' +
  'If pregnant or trying to conceive, in recovery from alcohol use disorder, or with liver disease or interacting medication, say to ask a doctor.';
