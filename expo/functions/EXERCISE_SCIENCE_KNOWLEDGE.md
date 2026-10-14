# Exercise & Nutrition Science Knowledge Base

Curated, cited reference material backing the AI features in `functions/src/index.js`
(`generateWorkoutPlan`, `getNutritionRecommendations`, and future AI features). The goal:
ground the app's AI output in real research instead of generic "elite personal trainer"
framing with nothing actually behind it.

**How to extend this:** add a new section (or new bullets to an existing one) with the
concrete, specific claim plus its source. Prefer primary research or well-regarded
research-synthesis sources (Stronger By Science, peer-reviewed meta-analyses) over generic
fitness blogs. When a fact here gets baked into a Cloud Function prompt, note it under
"Currently wired into the app" below so the two stay in sync.

## 1. Progressive Overload & Programming Fundamentals

- Progressive overload (a small, consistent increase in volume, load, or difficulty over
  time) is the core driver of continued adaptation — the same mechanism behind
  `services/progressiveOverloadService.js`'s double-progression logic.
- Training specificity matters: practice should be purposeful, with technique prioritized
  over load early on.
- Beginners: multiple sets of lower reps, staying 3+ reps from failure, teach technique
  faster than a few heavy sets. Beginner phase typically lasts 2-6 months, ending when
  weekly progress plateaus.
- Intermediates: main lifts at 75-85% of 1RM, staying 1-2 reps shy of failure; accessory
  work becomes the primary hypertrophy driver.
- Advanced lifters: higher frequency, higher volume, lower relative intensity, with more
  exercise variation needed to keep progressing — plateaus come faster and need more
  deliberate management (periodized blocks, 4-week to 12-week cycles).
- *Source: [Stronger By Science — Complete Strength Training Guide](https://www.strongerbyscience.com/complete-strength-training-guide/)*

## 2. Training Volume, Frequency, Intensity

- **Volume is the #1 driver of hypertrophy.** Target roughly **10-20 hard sets per muscle
  group per week**, in the **6-15 rep range**, taken close to failure (0-3 reps in reserve).
- **Frequency**: training a muscle group **twice a week beats once a week**; returns
  diminish beyond 3-4x/week. Practical target: 2-3 sessions per muscle group per week,
  4-6 sets (or ~40-70 total reps) per session.
- **Intensity**: the optimal zone for most work is **70-85% of 1RM** (~RPE 8). Low
  intensity (≤65% 1RM) builds muscle but not much strength; very high intensity (90%+)
  builds strength efficiently but limits the volume (and therefore hypertrophy) a session
  can accumulate.
- Training to true failure (RPE 10) adds fatigue without a proportional fitness return
  compared to stopping at RPE 8-9.
- Muscle protein synthesis stays elevated longer in beginners (36-48 hours) than in
  trained lifters (12-24 hours) — part of why beginners can get away with lower frequency
  and still progress, while experienced lifters benefit more from hitting a muscle group
  again sooner.
- *Sources: [The Science of Lifting (summary)](https://cdn.bookey.app/files/pdf/book/en/the-science-of-lifting.pdf), [Stronger By Science — Complete Strength Training Guide](https://www.strongerbyscience.com/complete-strength-training-guide/)*

## 3. Deloads & Fatigue Management

- Plan a deload (reduced volume, or 1-2 weeks of complete rest) roughly every **4-8 weeks**
  of consistent hard training — it costs far less effort to maintain current strength/size
  than to keep building it, so a deliberate dip in stress improves responsiveness to the
  training that follows.
- Two common approaches: a full 1-2 week rest, or 2-3 weeks at reduced volume (e.g.,
  2-3 sets per exercise instead of the usual working set count).
- *Source: [The Science of Lifting (summary)](https://cdn.bookey.app/files/pdf/book/en/the-science-of-lifting.pdf)*

## 4. Calisthenics & Bodyweight Training

- Muscle growth has three drivers — **mechanical tension, metabolic stress, and muscle
  damage** — and none require external weight; bodyweight training produces all three
  when effort is high enough.
- Controlled research backs this directly: push-up training produced similar gains in
  muscle thickness and strength as bench press training over 8 weeks when load/effort was
  equated (Gentil et al., 2017); a broader meta-analysis found low-load and high-load
  training produce comparable hypertrophy when volume is matched (Schoenfeld et al.,
  2017). **Training close to failure is the variable that matters, not whether the
  resistance is a barbell or body weight** (Refalo et al., 2022).
- Without added weight, progress a bodyweight exercise by: moving to a harder variation
  (push-up → archer push-up → one-arm push-up), slowing the eccentric (lowering) phase to
  4-5 seconds, increasing range of motion (e.g., a deficit push-up), adding sets/frequency,
  or reducing leverage (foot elevation, grip changes).
- Practical parameters: 6-30 reps per set produces similar hypertrophy to lower-rep
  weighted training as long as sets are taken close to failure; 10-20 sets/muscle/week;
  3-4 sessions/week — same targets as weighted training above.
- Real limitation: pure bodyweight training caps out for lower-body hypertrophy and for
  isolating smaller muscle groups — a weighted vest, resistance bands, or actual weighted
  calisthenics (adding external load to a bodyweight movement) is the honest next step
  once bodyweight-only progressions run out, not a sign calisthenics "stopped working."
- *Sources: [Calisthenics Association — Hypertrophy Evidence](https://calisthenicsassociation.org/blog/calisthenics-muscle-hypertrophy-science), [IJCRT — Calisthenics literature review](https://ijcrt.org/papers/IJCRT2505016.pdf)*

## 5. Stretching & Flexibility

- **Before training**: dynamic stretching (active movements mimicking the coming
  activity) raises heart rate, body temperature, and neuromuscular readiness. Static
  stretching right before intense effort can temporarily reduce strength and power — save
  it for after.
- **After training**: static stretches held **30-60 seconds** reduce stiffness, aid
  recovery, and encourage relaxation.
- Mechanism: stretching lengthens muscle fibers and (with consistent practice)
  desensitizes the protective stretch reflex, gradually increasing tolerated range of
  motion; it also improves tendon/fascia hydration and increases local blood flow.
- Stretching reduces injury *risk* but is not a guarantee, and should never be painful —
  a gentle pull is normal, sharp pain means stop.
- *Source: [OTB Physical Therapy — The Science Behind Stretching](https://www.otbphysicaltherapy.com/post/the-science-behind-stretching-what-happens-to-your-body-and-why-it-matters)*

## 6. Protein & Nutrition

- Baseline RDA (0.8 g/kg/day) prevents deficiency but **does not maximize muscle gain**
  from resistance training.
- For adults under 65 doing resistance training, **≥1.6 g protein/kg body weight/day**
  shows a real (moderate-evidence) benefit for lean mass gain over lower intakes —
  roughly double the baseline RDA. Returns diminish quickly above that; it's a target,
  not a "more is always better" scale.
- For adults 65+, 1.2-1.59 g/kg/day shows a smaller, lower-confidence effect in the same
  direction.
- These effects show up specifically **alongside resistance training** — protein
  increases alone, without training, didn't move the needle in the same review.
- Caloric intake is the real foundation underneath all of this: without enough total
  calories, no amount of correct protein or training fixes a muscle-building or
  recomposition goal; a caloric surplus speeds muscle gain but adds more fat with it,
  while a small, deliberate surplus or deficit is what allows recomposition (simultaneous
  muscle gain + fat loss).
- *Sources: [PMC systematic review/meta-analysis — protein intake & lean mass](https://pmc.ncbi.nlm.nih.gov/articles/PMC8978023/), [The Science of Lifting (summary)](https://cdn.bookey.app/files/pdf/book/en/the-science-of-lifting.pdf)*

## 7. Sleep & Recovery

- A single night of poor/no sleep does **not** meaningfully reduce strength output or
  disrupt the cortisol/testosterone balance on its own.
- **Chronic** short sleep (multiple consecutive nights) is where the real risk shows up:
  mixed but concerning evidence of reduced multi-joint strength performance, and a
  hormonal environment that's less favorable for adapting to training.
- Practical target: **7-9 hours**; going much past 9 hasn't shown added benefit and may
  correlate with other health risks.
- When sleep is genuinely short for a stretch: a pre-session nap, training later in the
  day, smart pre-workout caffeine (not too late, to protect that night's sleep), and
  temporarily lighter loads all help more than pushing through as normal.
- *Sources: [Science for Sport — How Sleep Impacts Strength Gains](https://www.scienceforsport.com/how-sleep-impacts-strength-gains-and-what-we-can-do-about-it/), [The Science of Lifting (summary)](https://cdn.bookey.app/files/pdf/book/en/the-science-of-lifting.pdf)*

## 8. Diet approaches

Added October 2026 from a list of nutrition books (BookAuthority, "best nutrition books"). The page gives
titles and one-line blurbs only, so none of the book text was read or used. What follows rests on
independent sources (position statements, trials, reviews), with the books kept as pointers to topics (§8.3).
Where evidence is limited the notes say so, because the app's AI is told to say so too.

### 8.1 What holds across diets

- **WHO healthy-diet limits**: at least 400 g of vegetables and fruit a day; free sugars under 10% of
  energy (under 5% gives extra benefit); total fat at most 30%; saturated fat under 10%; trans fat under 1%;
  salt under 5 g a day. *Source: [WHO — healthy diet](https://www.who.int/westernpacific/health-topics/healthy-diet)*
- **US Dietary Guidelines 2025-2030** (released January 2026): protein 1.2-1.6 g/kg/day; limit highly
  processed foods and added sugar (no amount recommended, and if eaten at most about 10 g per meal);
  saturated fat at most 10% of calories; 2-4 servings of whole grains. Harvard's Nutrition Source criticizes
  the saturated-fat messaging (full-fat dairy, butter, beef tallow listed as options) and the process behind
  the document, so the app follows the protein, sugar and processed-food points, which agree with WHO and
  the trials below, and not the saturated-fat ones. *Sources: [AAFP summary](https://www.aafp.org/afp/2026/0700/practice-guidelines-dietary-guidelines),
  [Harvard Nutrition Source](https://nutritionsource.hsph.harvard.edu/2026/01/09/dietary-guidelines-for-americans-2025-2030/)*
- **Fiber**: about 14 g per 1,000 kcal, roughly 25 g a day for women and 38 g for men; raise it gradually and
  with water. *Source: [Academy of Nutrition and Dietetics — fiber](https://eatright.org/health/essential-nutrients/carbohydrates/fiber)*
- **Ultra-processed food**: in an NIH inpatient trial (20 adults, two weeks on each diet, matched for calories,
  sugar, fiber, fat and carbohydrate on offer, eating as much as they wanted) people ate about 500 more
  calories a day on the ultra-processed diet and gained about 0.9 kg, then lost about as much on the
  unprocessed one. Small trial; the cause is not pinned down (protein differences could explain up to half).
  *Source: [NIH news release](https://www.nih.gov/news-events/news-releases/nih-study-finds-heavily-processed-foods-cause-overeating-weight-gain)*
- **Plant variety and gut health**: in the American Gut Project people eating more than 30 different plant
  foods a week had more diverse gut microbiomes than people eating 10 or fewer, whatever their diet (an
  association; groups of 41 and 44; fiber can be harmful in inflammatory bowel disease). In a 10-week Stanford
  trial of 36 adults, a fermented-food diet raised microbiome diversity and lowered 19 inflammatory proteins,
  while a high-fiber diet did not change diversity on average (small, short, no clinical outcomes).
  *Sources: [ScienceDaily — American Gut](https://www.sciencedaily.com/releases/2018/05/180515092931.htm),
  [Stanford Medicine](https://med.stanford.edu/news/all-news/2021/07/fermented-food-diet-increases-microbiome-diversity-lowers-inflammation)*
- **Sports nutrition**: carbohydrate roughly 3-10 g/kg/day by training load, up to 12 g/kg for extreme
  volume; protein 1.2-2.0 g/kg/day in modest doses of about 0.3 g/kg (ISSN: 20-40 g) every 3-4 hours; fat 20-35% of
  energy; vitamin and mineral supplements are generally unnecessary when energy and variety are adequate; 30-60 g
  of carbohydrate an hour in hard sessions over an hour. *Sources: [Joint position statement summary (Academy of
  Nutrition and Dietetics, Dietitians of Canada, ACSM)](https://www.myhealthcareer.com.au/dietetics/joint-position-statement-sport-nutritions),
  [ISSN sports nutrition position stand](https://doaj.org/article/8044581e83354ad88642b8124c51b956)*
- **Low energy availability / RED-S**: energy available after training of about 45 kcal per kg of fat-free mass
  a day is adequate, and hormone signalling starts to change below about 30 (a threshold for disruption, not a
  diagnosis). It affects female and male athletes; body weight can stay stable because metabolic rate drops, so
  weight is a poor warning sign. The nutrition function therefore never sets a deficit big enough to risk it, and
  points to a doctor or sports dietitian when fatigue, poor recovery or missed periods come up.
  *Sources: [IOC consensus statement on REDs, 2023](https://pubmed.ncbi.nlm.nih.gov/37752011/),
  [Aspetar — practical approaches to energy availability in RED-S](https://journal.aspetar.com/en/journals/volume-10-targeted-topic-sports-nutrition/practical-approaches-to-improving-nutrition-and-energy-availability-in-red-s)*

- **Alcohol** — a US standard drink is 12 oz beer, 5 oz wine or 1½ oz spirits, about 14 g of alcohol (Harvard;
  Healthline gives 0.6 fl oz / 14 g). Alcohol is about 7 kcal a gram, second only to fat; one drink averages
  100-150 kcal and juice, tonic or syrup mixers add more. It does not promote fullness as well as solid food and
  may increase hunger, it slows the oxidation of dietary fat, and eating tends to rise during a drinking
  episode, though research on alcohol and body weight is inconsistent (Healthline; Harvard's cohort of about 15,000
  men found only minor gain). It can disrupt sleep and blocks folate absorption (Harvard). It is a known
  carcinogen: convincing evidence for breast cancer, rising with the amount (2-5 drinks a day was linked to up to
  41% higher risk), and heavy drinking is linked to cancers of the mouth, throat, oesophagus, liver, colon and
  rectum; more than 4 drinks a day raises the risk of high blood pressure, abnormal heart rhythm and stroke.
  Observational studies show 25-40% fewer cardiovascular events at light to moderate intake, but Healthline
  concludes the benefits "generally do not outweigh the negative effects", the AHA says people who do not drink
  should not start, and Harvard says there is no need to start because exercise or healthier eating gives similar
  heart benefits. Limits: the 2020-2025 Dietary Guidelines say not drinking is fine and, if drinking, 1 drink or
  less a day for women and 2 or less for men, less being better (moderate = those amounts; heavy = more than 3 a
  day for women and more than 4 for men, per Healthline). The 2025-2030 Guidelines say only "consume less alcohol
  for better health", with no numbers; Harvard's critique calls that hard to act on. People who should not
  drink or should ask a doctor first (Harvard, CDC via Healthline): anyone pregnant or trying to conceive, in
  recovery from alcohol use disorder, with liver disease, or taking medication that interacts with alcohol
  (acetaminophen, antidepressants, anticonvulsants, painkillers, sedatives); a family history of alcoholism
  calls for care.
  **Muscle, recovery and performance** (three web articles, not the studies themselves; they cite the studies
  below and disagree in places, so the prompts use only what at least two of them support, or one supports with the study named):
  in a small study of 8 active men (*PLoS One* 2014), about 12 drinks (1.5 g of alcohol per kg) after hard
  training cut muscle protein synthesis by up to 37% and by 24% even with whey protein (ScienceInsights and
  Strengthlog agree on 24%; they describe the arm that gave 37% differently, so the prompt does not say what that
  arm ate). In 19 trained people, about 1.09 g per kg of fat-free mass after squats blunted mTOR signalling in men
  3 hours later but not in women (*J Strength Cond Res* 2017; synthesis itself was not measured, one small study).
  Heavy intake (about 1.2-1.5 g per kg) lowered testosterone for 12-24 hours and the testosterone-to-cortisol
  ratio for at least 24 hours, and heavy or binge drinking raises cortisol; light intake did not change cortisol,
  and a brief rise in testosterone after about 2 drinks (0.4 g per kg) was seen in one study, which Strengthlog
  says does not matter for gains. At about 1 g per kg (5-7 drinks for a 180 lb person) strength loss 36 hours
  after hard exercise was 39% against 29% for isometric and 44% against 27% for eccentric strength (ScienceInsights,
  study not named). Glycogen 8 hours after prolonged exercise was about 24 against 45 mmol per kg with alcohol,
  closing by 24 hours with enough carbohydrate, mostly because drinkers eat less of it (ScienceInsights).
  Alcohol disrupts sleep and the timing of growth-hormone release during it (ScienceInsights, Basics of
  Bodybuilding; *Sleep Med Rev* 2025 per Strengthlog). Each gram of alcohol adds about 10 mL of urine and drinks above 4% suppress
  antidiuretic hormone (ScienceInsights), but a 2021 *IJSNEM* systematic review of 12 studies found moderate beer
  had no negative effect on body composition, performance or recovery, and light beer worked fine for
  rehydration (Strengthlog). Fat burning is reduced while the liver clears alcohol (*NEJM* 1992), and a
  38-trial meta-analysis (*Br J Nutr* 2019) found alcohol raises food intake, more so at larger doses
  (Strengthlog). The honest gap: no human study has measured muscle protein synthesis at low doses (about 0.5 g
  per kg, 2-3 drinks for an 80 kg person); a 2014 *Sports Med* review judged that dose unlikely to affect recovery
  much, and the strongest data come from small studies at high doses. Large observational studies point the same
  way: in UK Biobank (about 200,000 people, 2023) heavy drinkers had 3-6% less muscle mass and low to moderate
  intake showed no such effect; a Japanese study of 19,900 adults found less muscle only above 60 g of alcohol
  a day; a Korean cohort of about 62,000 linked more drinking with more body fat, not less muscle (association
  only). Practical advice the articles share, and the prompts use: not before training or right after a hard
  session (rest days are better; Strengthlog says to leave at least 6 hours after training; its FAQ says 3-6), eat about 25 g of
  protein and some carbohydrate first (softens the dip, does not remove it), alternate drinks with water, count
  the calories, and expect no alcohol to be best for gains. The articles' own dose thresholds ("1-2 drinks
  undetectable", "4-6 starts to matter", "3-4 drinks lowers testosterone") are their inferences or uncited, so
  the prompts do not state them. A fourth article, Men's Health UK, could not be opened by the tool and was not used.
  The same reasoning is behind the food star
  rating: beer, wine and cider (3 g of alcohol per 100 g or more) are held to 2 stars at most, spirits and
  fortified wine (15 g or more) to 1 (`lib/foodRating.js`).
  *Sources: [Harvard Nutrition Source — Alcohol: balancing risks and benefits](https://nutritionsource.hsph.harvard.edu/healthy-drinks/drinks-to-consume-in-moderation/alcohol-full-story/),
  [Healthline — Alcohol and health](https://www.healthline.com/nutrition/alcohol-good-or-bad),
  [Harvard Nutrition Source — Dietary Guidelines 2025-2030](https://nutritionsource.hsph.harvard.edu/2026/01/09/dietary-guidelines-for-americans-2025-2030/)
  (for the 2025-2030 wording; the 2020-2025 limits are as both alcohol pages quote them),
  [ScienceInsights — Does alcohol ruin gains?](https://scienceinsights.org/does-alcohol-ruin-gains-effects-on-muscle-growth/),
  [Strengthlog — Alcohol and muscle growth](https://www.strengthlog.com/alcohol-and-muscle-growth/),
  [Basics of Bodybuilding — Alcohol and muscle growth and recovery](https://basicsofbodybuilding.com/the-influence-of-alcohol-on-muscle-growth-and-recovery/)*

### 8.2 The patterns in the app's diet list

Strength of evidence is stated as plainly as the sources allow. "Note" is what `lib/dietProfile.js` tells the AI.

- **Mediterranean** — vegetables, fruit, legumes, whole grains, nuts, extra-virgin olive oil as the main fat, fish
  at least twice a week, little red or processed meat. PREDIMED (7,447 adults at high cardiovascular risk,
  median 4.8 years) found fewer heart attacks, strokes and cardiovascular deaths: hazard ratio 0.69 with
  olive oil and 0.72 with nuts against a low-fat advice group. (From general knowledge, not the page cited: the
  paper was retracted and republished in 2018 after randomization irregularities at some sites, and the
  re-analysis gave similar results.) Observational cohorts agree. Calorie-dense
  (oil, nuts), so portions still matter. *Sources: [ACC — PREDIMED](https://www.acc.org/latest-in-cardiology/clinical-trials/2014/08/08/15/35/predimed),
  [Harvard Nutrition Source](https://nutritionsource.hsph.harvard.edu/mediterranean-diet/)*
- **Vegetarian and vegan** — the Academy of Nutrition and Dietetics position: appropriately planned vegetarian,
  including vegan, diets are healthful and nutritionally adequate for every stage of life, including pregnancy,
  infancy, old age and athletes, and are linked with lower rates of heart disease, type 2 diabetes, high blood
  pressure and some cancers. The one nutrient that needs a dependable source is vitamin B12 (fortified foods or a
  supplement for vegans); iron with vitamin C, calcium, iodine, zinc, omega-3 and vitamin D need planning.
  *Source: [Position of the Academy of Nutrition and Dietetics: Vegetarian Diets](https://digitalcommons.andrews.edu/pubs/648)*
- **Pescatarian** — a vegetarian pattern plus fish; fatty fish about twice a week is part of the Mediterranean
  pattern above.
- **Whole foods** — the practical form of the ultra-processed-food findings in §8.1. Frozen produce and canned
  beans count; cost and time are the real obstacles, which the NIH authors also note.
- **Paleo** — short trials (6 months or less, under 40 people each) show greater weight loss, lower blood
  pressure and better insulin sensitivity than guideline diets; a two-year trial of 70 postmenopausal women found
  the extra fat loss faded by two years. Excluding dairy, grains and legumes risks calcium, vitamin D and fiber
  gaps. Harvard: strong recommendations cannot be made. *Source: [Harvard Nutrition Source — Paleo](https://nutritionsource.hsph.harvard.edu/healthy-weight/diet-reviews/paleo-diet/)*
- **Pegan** — Mark Hyman's blend of paleo and vegan: about 75% vegetables and fruit (low-glycemic), the rest
  pasture-raised meat, fish or eggs; dairy, gluten, most grains (about half a cup cooked per meal), legumes
  (about a cup a day) and added sugar are limited. No studies of the pegan diet itself; its benefits come from
  its fruit-and-vegetable, healthy-fat base, and some restrictions look unnecessary. In the Recipes tab it is
  filtered as Paleo, which is a safe subset. *Source: [Healthline — pegan diet](https://www.healthline.com/nutrition/pegan-diet)*
- **Keto and low carb** — keto is usually under 50 g carbohydrate a day with 70-80% of calories from fat.
  A meta-analysis of 13 trials found about 2 lb more weight loss than low-fat diets at one year and no
  difference at two; triglycerides and blood pressure fell more, but HDL and LDL cholesterol both rose more.
  Possible long-term concerns are kidney stones, bone loss and raised uric acid. Ketoacidosis occurs most often in
  type 1 diabetes (diabetes medication may also need adjusting, which is general knowledge, not from the page cited);
  people with kidney or liver disease, the elderly, and anyone pregnant, breastfeeding or an adolescent should have a
  doctor's guidance. Harvard's
  view: a modified low-carbohydrate pattern built on the Healthy Eating Plate probably gives most of the benefit.
  *Source: [Harvard Nutrition Source — Ketogenic diet](https://nutritionsource.hsph.harvard.edu/healthy-weight/diet-reviews/ketogenic-diet/)*
- **High protein** — see the sports-nutrition and Dietary Guidelines ranges in §8.1 (1.2-2.0 g/kg/day, and the
  existing §6 target of at least 1.6 g/kg for resistance training with a muscle goal). Kidney disease is the
  standard reason to ask a doctor first.
- **Carnivore** — a 2026 scoping review of nine human studies (case reports, surveys, modelled meal plans, small
  exploratory studies, no clinical endpoints) found self-reported weight loss, satiety and better mood or sleep,
  but fiber under 1 g a day, saturated fat well above the WHO limit in modelled plans, rising LDL cholesterol
  in several studies, and modelled intakes below reference values for vitamins C and D, calcium, magnesium,
  thiamin, iodine and potassium. The authors conclude long-term adherence cannot be recommended. The app still
  lets people pick it, and tells the AI to be candid, not to call it proven, and to suggest regular blood work.
  *Source: [Lietz et al., Carnivore Diet scoping review, Nutrients 2026](https://mdpi-res.com/d_attachment/nutrients/nutrients-18-00348/article_deploy/nutrients-18-00348.pdf)*
- **Intermittent fasting** — in a 12-month trial of 139 adults with obesity, adding an 8am-4pm eating window to
  calorie restriction gave 8.0 kg weight loss against 6.3 kg with calorie restriction alone, a difference that
  was not statistically significant (-1.8 kg, 95% CI -4.0 to 0.4); metabolic markers followed the same pattern.
  Harvard's review reaches the same place: no proven edge over other methods. Not for people on diabetes
  medication, with a history of eating disorders, who are pregnant or breastfeeding, or adolescents.
  *Sources: [NEJM 2022 trial (PubMed)](https://pubmed.ncbi.nlm.nih.gov/35443107/),
  [Harvard Nutrition Source — Intermittent fasting](https://nutritionsource.hsph.harvard.edu/intermittent-fasting)*
- **Whole30** — a 30-day elimination (no added sugar, alcohol, grains, legumes or dairy) followed by structured
  reintroduction. *No source was fetched for this entry; it describes the program's published rules and the general
  absence of controlled trials. Check before relying on it.*
- **Low FODMAP** — Monash University's three phases: swap high- for low-FODMAP foods for 2-6 weeks, reintroduce
  each FODMAP group separately for about 6-8 weeks, then personalize long term. The goal is the least restrictive
  diet that controls symptoms; phases 1 and 2 are meant to be guided by a dietitian. *Source: [Monash — the 3 steps](https://monashfodmap.com/blog/3-phases-low-fodmap-diet/)*
- **Gluten-free** — needed for celiac disease (about 1-2% of Americans) and may help non-celiac gluten
  sensitivity; no evidence it helps weight loss or general health in others, and processed gluten-free foods can
  be lower in fiber, iron, calcium and B vitamins. *Source: [Harvard Nutrition Source — Gluten-free](https://nutritionsource.hsph.harvard.edu/gluten-free-diet-weight-loss)*
- **Intuitive eating** — eating by hunger and fullness cues rather than rules or calorie targets. Small, short
  studies link it with less binge and restrained eating, better body image and less depression and anxiety;
  trials on weight conflict (none to modest loss) and it is not designed for weight loss. It may suit people
  harmed by restrictive dieting; it may not suit people who mainly want weight loss or who have strong cravings
  for highly processed foods. When chosen, the AI is told not to push deficits, tracking or good/bad food labels.
  *Source: [Harvard Nutrition Source — Intuitive eating](https://nutritionsource.hsph.harvard.edu/intuitive-eating/)*

### 8.3 The book list, and what the app takes from it

Titles and "best for" lines are from the BookAuthority page (22 of the 23 entries were readable; the page title
credits Richard Branson and Tony Robbins, but in the part read only Branson is named, for one book).
"Evidence" is what the independent sources above say about the book's topic, not a review of the book.

| Book (author) | Topic | Evidence behind the topic | What the app takes |
|---|---|---|---|
| Real Food for Fertility (Nichols, Hendrickson-Jack) | Preconception nutrition | Not checked | Nothing; the app has no fertility feature |
| Unprocessed (Chef AJ) | Whole-food, minimally processed eating | Supported in direction by the NIH trial | Whole Foods option |
| Nutrition Mastery Blueprint; 30-Day Nutrition Reset (TailoredRead AI) | AI-generated books | Not applicable | Nothing |
| Nourish (Shah, Davis, Katz) | Family plant-based nutrition | Academy position: adequate when planned | Vegetarian and vegan notes |
| Super Gut (Davis) | Gut microbiome | Early; fermented foods and plant variety have small trials | Fiber, fermented foods, plant variety (§8.1), not the book's protocol |
| The Carnivore Code (Saladino) | Carnivore | Very limited (scoping review) | Carnivore option kept; the AI is candid about limits |
| The Case for Keto (Taubes) | Keto | Mixed; no clear edge after a year | Keto note with LDL and medical cautions |
| The Complete Guide to Sports Nutrition (Bean) | Athletes' nutrition | Position statements agree on the ranges | Sports-nutrition ranges in the nutrition function |
| Gentle Nutrition (Hartley) | Intuitive eating | Small studies; good for body image, not weight loss | Intuitive Eating option |
| Eat to Beat Your Diet (Li) | Metabolic health | Not checked | Nothing specific |
| How Not to Die (Greger, Stone) | Disease prevention, plant-forward | Observational, plus the plant-based position | General plant-forward guidance only |
| The China Study (Campbell, Campbell) | Plant-based eating | Observational and contested | Not used as evidence; the plant-based notes rest on the Academy position |
| The Mediterranean Diet Cookbook for Beginners (Paravantes) | Mediterranean | Strongest of the patterns: PREDIMED | Mediterranean note |
| The Pegan Diet (Hyman) | Pegan | No studies of the diet itself | Pegan option, labelled as such |
| Food for Life (Spector) | Gut microbiome, variety | Association studies and small trials | Plant variety and fermented foods (§8.1) |
| Get Off Your Sugar (Gioffre) | Cutting sugar | WHO and Dietary Guidelines limits | Sugar limits (§8.1); not the book's addiction framing |
| ROAR (Sims, Yeager) | Female athletes | Low energy availability is well established | LEA safeguards (§8.1); cycle-based eating not used (not checked) |
| Spoon-Fed (Spector) | Nutrition myths | Not applicable | The habit of saying when evidence is limited |
| Vegan for Life (Norris, Messina) | Vegan | Academy position | Vegan note (B12 and others) |
| Super Easy Organic Low Carb Diet for Beginners (Ferraldeschi) | Low carb | Harvard: modified low carb is reasonable | Low Carb note |
| Plant-Based Sports Nutrition (Larson-Meyer, Ruscigno) | Plant-based athletes | Academy position plus sports-nutrition ranges | Vegan note plus sports-nutrition ranges |

## Currently wired into the app

- `generateWorkoutPlan`'s system prompt (`functions/src/index.js`) now encodes §1, §2, §3,
  and §4 above.
- `getNutritionRecommendations`'s prompt (`functions/src/index.js`) now encodes the §6
  protein target alongside its existing Mifflin-St Jeor calorie math.
- §8 is wired in three places. `lib/dietProfile.js` gives every diet a short `aiNote` (what it is, what to watch,
  who needs a doctor), which the AI Coach reads through `describeDietForAI`, the client nutrition prompts in
  `services/aiService.js` read as `DietGuidance`, and `getNutritionRecommendations` receives inside
  `profile.nutritionPreference` (`lib/userProfileData.js`). `functions/src/nutritionKnowledge.js` adds the §8.1
  rules (fiber, protein spread, carbohydrate range, WHO limits, ultra-processed food, low energy availability,
  how to treat a diet's cautions) to the `getNutritionRecommendations` prompt, and the Coach prompt
  (`services/coachService.js`) tells the model to be honest where a diet's evidence is limited.
- The alcohol entry in §8.1 is wired in four places: `lib/alcoholGuidance.js` holds the Coach's note
  (`services/coachService.js`) and a shorter one for the client nutrition advice (`services/aiService.js`,
  `generateNutritionAdvice`); `functions/src/nutritionKnowledge.js` carries the same facts for
  `getNutritionRecommendations`; and the topic check and scope rule in `functions/src/scope.js` name alcohol and
  health as in scope, so a question about drinks and training is answered, not refused. The food star rating
  (`lib/foodRating.js`) applies the same reasoning to the foods people log.
- Three diets were added from §8.3: Whole Foods, Pegan and Intuitive Eating.
- §5 (stretching) and §7 (sleep) aren't wired into a prompt yet. §7 is a natural fit for
  `services/progressiveOverloadService.js`'s existing `readiness` input (it already backs
  off the prescription on "low" readiness — this section is the evidence that this is
  real, not just a nice idea) and for the recovery/readiness work already in progress.
  §5 would fit a future "cool-down" step at the end of a workout.

## Sources

1. Stronger By Science — [Complete Strength Training Guide](https://www.strongerbyscience.com/complete-strength-training-guide/); [article index](https://www.strongerbyscience.com/articles/)
2. [The Science of Lifting (book summary)](https://cdn.bookey.app/files/pdf/book/en/the-science-of-lifting.pdf)
3. [Calisthenics Association — Calisthenics & Muscle Hypertrophy](https://calisthenicsassociation.org/blog/calisthenics-muscle-hypertrophy-science)
4. [IJCRT2505016 — calisthenics literature review](https://ijcrt.org/papers/IJCRT2505016.pdf)
5. [OTB Physical Therapy — The Science Behind Stretching](https://www.otbphysicaltherapy.com/post/the-science-behind-stretching-what-happens-to-your-body-and-why-it-matters)
6. [PMC — systematic review/meta-analysis, protein intake & lean mass in healthy adults](https://pmc.ncbi.nlm.nih.gov/articles/PMC8978023/)
7. [Science for Sport — How Sleep Impacts Strength Gains](https://www.scienceforsport.com/how-sleep-impacts-strength-gains-and-what-we-can-do-about-it/)

8. [WHO — healthy diet](https://www.who.int/westernpacific/health-topics/healthy-diet)
9. [AAFP — Dietary Guidelines 2025-2030 summary](https://www.aafp.org/afp/2026/0700/practice-guidelines-dietary-guidelines) and [Harvard Nutrition Source critique](https://nutritionsource.hsph.harvard.edu/2026/01/09/dietary-guidelines-for-americans-2025-2030/)
10. [Academy of Nutrition and Dietetics — fiber](https://eatright.org/health/essential-nutrients/carbohydrates/fiber)
11. [NIH — ultra-processed food trial](https://www.nih.gov/news-events/news-releases/nih-study-finds-heavily-processed-foods-cause-overeating-weight-gain)
12. [ScienceDaily — American Gut Project](https://www.sciencedaily.com/releases/2018/05/180515092931.htm); [Stanford Medicine — fermented foods](https://med.stanford.edu/news/all-news/2021/07/fermented-food-diet-increases-microbiome-diversity-lowers-inflammation)
13. [Sports nutrition joint position statement summary](https://www.myhealthcareer.com.au/dietetics/joint-position-statement-sport-nutritions); [ISSN sports nutrition position stand](https://doaj.org/article/8044581e83354ad88642b8124c51b956)
14. [IOC REDs consensus 2023](https://pubmed.ncbi.nlm.nih.gov/37752011/); [Aspetar — energy availability in RED-S](https://journal.aspetar.com/en/journals/volume-10-targeted-topic-sports-nutrition/practical-approaches-to-improving-nutrition-and-energy-availability-in-red-s)
15. [Academy of Nutrition and Dietetics — Vegetarian Diets position](https://digitalcommons.andrews.edu/pubs/648)
16. [ACC — PREDIMED](https://www.acc.org/latest-in-cardiology/clinical-trials/2014/08/08/15/35/predimed)
17. Harvard Nutrition Source: [Mediterranean](https://nutritionsource.hsph.harvard.edu/mediterranean-diet/), [Ketogenic](https://nutritionsource.hsph.harvard.edu/healthy-weight/diet-reviews/ketogenic-diet/), [Paleo](https://nutritionsource.hsph.harvard.edu/healthy-weight/diet-reviews/paleo-diet/), [Intermittent fasting](https://nutritionsource.hsph.harvard.edu/intermittent-fasting), [Intuitive eating](https://nutritionsource.hsph.harvard.edu/intuitive-eating/), [Gluten-free](https://nutritionsource.hsph.harvard.edu/gluten-free-diet-weight-loss)
18. [NEJM 2022 time-restricted eating trial (PubMed)](https://pubmed.ncbi.nlm.nih.gov/35443107/)
19. [Lietz et al., Carnivore Diet scoping review, Nutrients 2026](https://mdpi-res.com/d_attachment/nutrients/nutrients-18-00348/article_deploy/nutrients-18-00348.pdf)
20. [Monash — the 3 steps of the low FODMAP diet](https://monashfodmap.com/blog/3-phases-low-fodmap-diet/)
21. [Healthline — pegan diet](https://www.healthline.com/nutrition/pegan-diet)
22. [BookAuthority — best nutrition books](https://bookauthority.org/books/best-nutrition-books) (titles and blurbs only)
23. [Harvard Nutrition Source — Alcohol: balancing risks and benefits](https://nutritionsource.hsph.harvard.edu/healthy-drinks/drinks-to-consume-in-moderation/alcohol-full-story/)
24. [Healthline — Alcohol and health](https://www.healthline.com/nutrition/alcohol-good-or-bad)
25. [ScienceInsights — Does alcohol ruin gains? Effects on muscle growth](https://scienceinsights.org/does-alcohol-ruin-gains-effects-on-muscle-growth/) (names few studies)
26. [Strengthlog — Alcohol and muscle growth](https://www.strengthlog.com/alcohol-and-muscle-growth/) (names the studies and journals)
27. [Basics of Bodybuilding — Alcohol and muscle growth and recovery](https://basicsofbodybuilding.com/the-influence-of-alcohol-on-muscle-growth-and-recovery/) (mostly uncited; client anecdote)
28. Men's Health UK — [What drinking alcohol really does to your muscle gains](https://www.menshealth.com/uk/building-muscle/a69902922/alcohol-effects-on-muscle-growth/): the fetch tool was blocked from this site, so it was not read or used.

Note: a Gavin.FIT article on weighted vs. regular calisthenics was requested but blocks
automated fetching (robots.txt). Its ground is covered by sources 3 and 4 above, which
cite the same underlying research (Gentil et al. 2017, Schoenfeld et al. 2017, Refalo et
al. 2022).
