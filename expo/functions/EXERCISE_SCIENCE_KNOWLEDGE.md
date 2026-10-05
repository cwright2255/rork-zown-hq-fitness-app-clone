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

## Currently wired into the app

- `generateWorkoutPlan`'s system prompt (`functions/src/index.js`) now encodes §1, §2, §3,
  and §4 above.
- `getNutritionRecommendations`'s prompt (`functions/src/index.js`) now encodes the §6
  protein target alongside its existing Mifflin-St Jeor calorie math.
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

Note: a Gavin.FIT article on weighted vs. regular calisthenics was requested but blocks
automated fetching (robots.txt). Its ground is covered by sources 3 and 4 above, which
cite the same underlying research (Gentil et al. 2017, Schoenfeld et al. 2017, Refalo et
al. 2022).
