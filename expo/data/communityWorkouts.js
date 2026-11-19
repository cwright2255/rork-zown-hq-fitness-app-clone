// data/communityWorkouts.js
//
// The pre-made workouts in Community Workouts on the Workouts tab (app/workouts.jsx). Each one is a ready-made workout, the kind a person could
// have made with Quick Workout: a name, a line about it, a level, and a list of exercises with sets, reps and rest. Tapping one saves it to
// My Workouts and opens it (lib/communityWorkouts.js).
//
// They are written by hand for this app. Nothing here says who made a workout, how many people did it or how it rated, because nobody did:
// "community" is the kind of workout (something to share, to do with a friend or a group), not a claim about use.
//
// Rules, held by __tests__/communityWorkouts.test.js:
//   - every exercise is named exactly as in data/exerciseLibrary.js, so its muscles show on the preview's heat figure and its page opens
//   - `equipment` is what the person needs, in words; every exercise must be doable with it (the test checks each against the library)
//   - a beginner workout holds no advanced exercise, and an advanced one holds at least one
//   - the length is not written down: it is worked out from the sets and rest, as it is for a plan day (lib/planDayWorkout.js)
//   - holds are given as seconds ('30 sec'), everything else as reps or a range of reps
//   - the order below is a mix on purpose: "All" shows it as it is, so no category comes twice in a row and no level more than three times

/** The order the category choices come in. */
export const COMMUNITY_CATEGORIES = ['Full Body', 'Upper Body', 'Lower Body', 'Core', 'HIIT', 'Arms & Shoulders'];

// name, sets, reps, rest in seconds
const x = (name, sets, reps, restSeconds) => ({ name, sets, reps, restSeconds });

export const COMMUNITY_WORKOUTS = [
  {
    slug: 'living-room-reset', name: 'Living Room Reset', category: 'Full Body', difficulty: 'beginner', equipment: 'No equipment',
    description: 'Five simple moves, no gear and no gym. Do it at home, or take turns with a friend and cheer each other through the sets.',
    exercises: [x('Bodyweight Squat', 3, '12', 45), x('Knee Push-Up', 3, '8-10', 45), x('Glute Bridge', 3, '12', 45), x('Bird Dog', 3, '8', 30), x('Plank', 3, '30 sec', 30)],
  },
  {
    slug: 'sweat-equity', name: 'Sweat Equity', category: 'HIIT', difficulty: 'intermediate', equipment: 'No equipment',
    description: 'Burpees, jumps and climbers with half a minute to catch your breath. A good one to do with a friend, so nobody quits early.',
    exercises: [x('Burpee', 4, '10', 30), x('Jump Squat', 4, '12', 30), x('Mountain Climber', 4, '30 sec', 30), x('Push-Up', 4, '12', 30), x('Plank', 3, '45 sec', 30)],
  },
  {
    slug: 'goblet-gang', name: 'Goblet Gang', category: 'Lower Body', difficulty: 'beginner', equipment: 'Dumbbells and a bench',
    description: 'A leg day that needs one pair of dumbbells and a bench. Pick a weight you can control and trade sets with a partner.',
    exercises: [x('Goblet Squat', 4, '10', 60), x('Dumbbell Romanian Deadlift', 3, '10', 60), x('Dumbbell Reverse Lunge', 3, '10', 45), x('Dumbbell Step-Up', 3, '10', 45), x('Sumo Squat', 3, '12', 45), x('Dumbbell Calf Raise', 3, '15', 30)],
  },
  {
    slug: 'bar-crawl', name: 'Bar Crawl', category: 'Upper Body', difficulty: 'intermediate', equipment: 'A pull-up bar',
    description: 'Everything on one bar: pull-ups, chin-ups, rows and leg raises. Count each other\'s reps and chase one more.',
    exercises: [x('Pull-Up', 4, '6', 75), x('Chin-Up', 3, '6-8', 75), x('Inverted Row', 3, '10', 60), x('Scapular Pull-Up', 3, '8', 45), x('Hanging Knee Raise', 3, '10', 45)],
  },
  {
    slug: 'core-in-ten', name: 'Core in Ten', category: 'Core', difficulty: 'beginner', equipment: 'No equipment',
    description: 'Four slow, steady core moves with short rests. Good on its own or tacked on after any other workout.',
    exercises: [x('Plank', 3, '30 sec', 20), x('Dead Bug', 3, '8', 20), x('Bird Dog', 3, '8', 20), x('Bicycle Crunch', 3, '15', 20)],
  },
  {
    slug: 'boulder-shoulders', name: 'Boulder Shoulders', category: 'Arms & Shoulders', difficulty: 'intermediate', equipment: 'Dumbbells',
    description: 'Press, raise and shrug for rounder shoulders. Keep the weight honest and the reps slow.',
    exercises: [x('Arnold Press', 4, '10', 60), x('Dumbbell Lateral Raise', 4, '12', 45), x('Rear Delt Fly', 3, '12', 45), x('Dumbbell Front Raise', 3, '12', 45), x('Dumbbell Shrug', 3, '15', 45)],
  },
  {
    slug: 'dumbbell-duo', name: 'Dumbbell Duo', category: 'Full Body', difficulty: 'beginner', equipment: 'Dumbbells',
    description: 'A full-body session with one pair of dumbbells. Built for two: one lifts while the other rests, then swap.',
    exercises: [x('Goblet Squat', 3, '10', 60), x('Dumbbell Floor Press', 3, '10', 60), x('Dumbbell Bent-Over Row', 3, '10', 60), x('Dumbbell Romanian Deadlift', 3, '10', 60), x('Standing Dumbbell Shoulder Press', 3, '10', 60), x("Farmer's Walk", 2, '40 sec', 60)],
  },
  {
    slug: 'redline', name: 'Redline', category: 'HIIT', difficulty: 'advanced', equipment: 'No equipment',
    description: 'Hard, fast and with barely any rest. For people who already move well and want to find the limit.',
    exercises: [x('Burpee', 5, '15', 30), x('Archer Push-Up', 4, '6', 45), x('Jump Squat', 5, '15', 20), x('Mountain Climber', 5, '45 sec', 20), x('V-Up', 4, '15', 30)],
  },
  {
    slug: 'squat-rack-social', name: 'Squat Rack Social', category: 'Lower Body', difficulty: 'intermediate', equipment: 'Barbell, rack and bench',
    description: 'Squats, hinges and thrusts under the bar, with long rests. Rotate through the rack with a lifting partner.',
    exercises: [x('Barbell Back Squat', 5, '5', 120), x('Romanian Deadlift', 4, '8', 90), x('Barbell Hip Thrust', 3, '10', 75), x('Good Morning', 3, '10', 75), x('Walking Lunge', 3, '12', 45), x('Bodyweight Calf Raise', 3, '15', 30)],
  },
  {
    slug: 'press-and-pull-party', name: 'Press & Pull Party', category: 'Upper Body', difficulty: 'beginner', equipment: 'Dumbbells and a bench',
    description: 'Every push is matched with a pull, so the chest, back and shoulders all get their turn. Easy to run as a pair.',
    exercises: [x('Dumbbell Bench Press', 3, '10', 60), x('Chest-Supported Dumbbell Row', 3, '10', 60), x('Seated Dumbbell Shoulder Press', 3, '10', 60), x('One-Arm Dumbbell Row', 3, '10', 60), x('Dumbbell Lateral Raise', 3, '12', 45), x('Overhead Dumbbell Triceps Extension', 2, '12', 45)],
  },
  {
    slug: 'midsection-mission', name: 'Midsection Mission', category: 'Core', difficulty: 'intermediate', equipment: 'No equipment',
    description: 'Holds, twists and raises that hit the abs from every angle. Set a timer and go round with a friend.',
    exercises: [x('Hollow Hold', 3, '30 sec', 30), x('V-Up', 3, '12', 30), x('Russian Twist', 3, '20', 30), x('Side Plank', 3, '30 sec', 30), x('Lying Leg Raise', 3, '12', 30), x('Mountain Climber', 3, '30 sec', 30)],
  },
  {
    slug: 'sleeve-busters', name: 'Sleeve Busters', category: 'Arms & Shoulders', difficulty: 'beginner', equipment: 'Dumbbells and a bench',
    description: 'Curls, extensions and raises with a light pair of dumbbells. Pump it out together and compare who gets the last rep.',
    exercises: [x('Dumbbell Curl', 3, '12', 45), x('Hammer Curl', 3, '12', 45), x('Overhead Dumbbell Triceps Extension', 3, '12', 45), x('Dumbbell Triceps Kickback', 3, '12', 45), x('Dumbbell Lateral Raise', 3, '12', 45), x('Dumbbell Front Raise', 2, '12', 45)],
  },
  {
    slug: 'barbell-club', name: 'Barbell Club', category: 'Full Body', difficulty: 'intermediate', equipment: 'Barbell, rack and bench',
    description: 'The big barbell lifts in one session: squat, press, row and hinge. Bring a spotter and take your time between sets.',
    exercises: [x('Barbell Back Squat', 4, '6-8', 90), x('Barbell Bench Press', 4, '6-8', 90), x('Barbell Row', 4, '8', 90), x('Romanian Deadlift', 3, '8', 90), x('Barbell Overhead Press', 3, '8', 75), x('Plank', 3, '45 sec', 45)],
  },
  {
    slug: 'ten-minute-sweat', name: 'Ten-Minute Sweat', category: 'HIIT', difficulty: 'beginner', equipment: 'No equipment',
    description: 'Short rests and steady effort. A quick one for a busy day, or a warm-up round before a group workout.',
    exercises: [x('Mountain Climber', 4, '30 sec', 15), x('Bodyweight Squat', 4, '15', 15), x('Knee Push-Up', 3, '10', 15), x('Walking Lunge', 3, '12', 15)],
  },
  {
    slug: 'pin-pals', name: 'Pin Pals', category: 'Lower Body', difficulty: 'beginner', equipment: 'Gym machines',
    description: 'A leg day on the machines, from quads to calves. A friendly first step if the gym floor feels new.',
    exercises: [x('Leg Press', 4, '12', 75), x('Seated Leg Curl', 3, '12', 60), x('Leg Extension', 3, '12', 60), x('Hip Abduction Machine', 3, '15', 45), x('Hip Adduction Machine', 3, '15', 45), x('Standing Calf Raise', 4, '15', 45)],
  },
  {
    slug: 'push-up-pyramid', name: 'Push-Up Pyramid', category: 'Upper Body', difficulty: 'intermediate', equipment: 'No equipment',
    description: 'Climb from the easy push-up to the hard ones and back down, on the floor and nothing else.',
    exercises: [x('Knee Push-Up', 3, '12', 45), x('Push-Up', 3, '10', 45), x('Diamond Push-Up', 3, '8', 60), x('Pike Push-Up', 3, '8', 60), x('Plank', 3, '45 sec', 45)],
  },
  {
    slug: 'brace-yourself', name: 'Brace Yourself', category: 'Core', difficulty: 'intermediate', equipment: 'Gym machines and cables',
    description: 'Crunches, chops and presses on the cable stack. Hold the brace and breathe through it.',
    exercises: [x('Cable Crunch', 3, '12', 45), x('Pallof Press', 3, '12', 45), x('Cable Wood Chop', 3, '12', 45), x('Ab Crunch Machine', 3, '15', 30), x('Plank', 3, '45 sec', 30)],
  },
  {
    slug: 'arm-wrestle', name: 'Arm Wrestle', category: 'Arms & Shoulders', difficulty: 'intermediate', equipment: 'Barbell, rack and bench',
    description: 'Curls and presses with the barbell for both sides of the arm. Pick a weight you can curl cleanly for ten.',
    exercises: [x('Barbell Curl', 4, '10', 60), x('Close-Grip Bench Press', 4, '8', 75), x('Preacher Curl', 3, '10', 60), x('Reverse Curl', 3, '12', 45)],
  },
  {
    slug: 'band-together', name: 'Band Together', category: 'Full Body', difficulty: 'beginner', equipment: 'A resistance band',
    description: 'Gentle, joint-friendly work with a single band. Easy to pack, easy to share, easy on the body.',
    exercises: [x('Banded Glute Bridge', 3, '15', 45), x('Band Pull-Apart', 3, '15', 30), x('Banded Lateral Walk', 3, '12', 45), x('Bodyweight Squat', 3, '12', 45), x('Knee Push-Up', 3, '10', 45), x('Dead Bug', 3, '8', 30)],
  },
  {
    slug: 'jump-start', name: 'Jump Start', category: 'HIIT', difficulty: 'intermediate', equipment: 'A bench or box',
    description: 'Box jumps, squat jumps and burpees in short bursts. Land softly, reset, and go again.',
    exercises: [x('Box Jump', 4, '8', 45), x('Jump Squat', 4, '10', 30), x('Burpee', 4, '8', 30), x('Mountain Climber', 4, '30 sec', 30)],
  },
  {
    slug: 'bridge-club', name: 'Bridge Club', category: 'Lower Body', difficulty: 'intermediate', equipment: 'A resistance band',
    description: 'Glutes and hips, with one band and a mat. Slow reps and a squeeze at the top of every bridge.',
    exercises: [x('Banded Glute Bridge', 4, '15', 45), x('Single-Leg Glute Bridge', 3, '10', 45), x('Banded Lateral Walk', 3, '12', 45), x('Curtsy Lunge', 3, '10', 45), x('Glute Kickback', 3, '15', 30), x('Side-Lying Hip Abduction', 3, '15', 30)],
  },
  {
    slug: 'cable-car', name: 'Cable Car', category: 'Upper Body', difficulty: 'beginner', equipment: 'Gym machines and cables',
    description: 'Chest, back, shoulders and arms on the machines and cables. Smooth and steady, with no spotter needed.',
    exercises: [x('Machine Chest Press', 3, '10', 60), x('Lat Pulldown', 3, '10', 60), x('Machine Shoulder Press', 3, '10', 60), x('Seated Cable Row', 3, '10', 60), x('Pec Deck Fly', 3, '12', 45), x('Face Pull', 3, '15', 45), x('Triceps Pushdown', 3, '12', 45), x('Cable Curl', 3, '12', 45)],
  },
  {
    slug: 'core-meltdown', name: 'Core Meltdown', category: 'Core', difficulty: 'advanced', equipment: 'A pull-up bar, an ab wheel and a bench',
    description: 'Hanging raises, rollouts and long holds. The hardest core session here, so go slowly and stop if your form goes.',
    exercises: [x('Hanging Leg Raise', 4, '8', 60), x('Toes-to-Bar', 3, '6', 75), x('Ab Wheel Rollout', 3, '8', 60), x('Copenhagen Plank', 3, '20 sec', 45), x('Hollow Hold', 3, '40 sec', 45), x('Side Plank', 3, '45 sec', 30)],
  },
  {
    slug: 'rope-burn', name: 'Rope Burn', category: 'Arms & Shoulders', difficulty: 'intermediate', equipment: 'Gym machines and cables',
    description: 'Biceps and triceps on the cables and machines, with face pulls to keep the shoulders happy.',
    exercises: [x('Cable Curl', 4, '12', 45), x('Rope Triceps Pushdown', 4, '12', 45), x('Overhead Cable Triceps Extension', 3, '12', 45), x('Machine Bicep Curl', 3, '12', 45), x('Machine Triceps Extension', 3, '12', 45), x('Face Pull', 3, '15', 45)],
  },
  {
    slug: 'desk-break-reset', name: 'Desk Break Reset', category: 'Full Body', difficulty: 'beginner', equipment: 'A resistance band',
    description: 'A short, gentle reset for a long day sitting down: open the chest, wake the glutes, steady the core.',
    exercises: [x('Wall Push-Up', 2, '15', 30), x('Band Pull-Apart', 3, '15', 30), x('Bird Dog', 2, '8', 30), x('Dead Bug', 2, '8', 30), x('Glute Bridge', 2, '12', 30)],
  },
  {
    slug: 'dumbbell-blitz', name: 'Dumbbell Blitz', category: 'HIIT', difficulty: 'intermediate', equipment: 'Dumbbells',
    description: 'Strength moves with short rests, so your heart rate stays up. Moderate weights and no stopping.',
    exercises: [x('Goblet Squat', 4, '12', 30), x('Dumbbell Reverse Lunge', 3, '10', 30), x('Dumbbell Bent-Over Row', 3, '12', 30), x('Standing Dumbbell Shoulder Press', 3, '12', 30), x("Farmer's Walk", 3, '40 sec', 30), x('Burpee', 3, '8', 30)],
  },
  {
    slug: 'couch-to-quads', name: 'Couch to Quads', category: 'Lower Body', difficulty: 'beginner', equipment: 'No equipment',
    description: 'A leg workout that needs nothing but a bit of floor and a wall. Slow down on the way back up.',
    exercises: [x('Bodyweight Squat', 3, '15', 45), x('Bodyweight Reverse Lunge', 3, '10', 45), x('Glute Bridge', 3, '15', 45), x('Lateral Lunge', 3, '10', 45), x('Bodyweight Calf Raise', 3, '20', 30), x('Wall Sit', 3, '30 sec', 45)],
  },
  {
    slug: 'press-gang', name: 'Press Gang', category: 'Upper Body', difficulty: 'intermediate', equipment: 'Barbell, rack and bench',
    description: 'Heavy pressing and rowing with the bar. Bring friends to spot, and take full rests.',
    exercises: [x('Barbell Bench Press', 4, '6', 90), x('Barbell Row', 4, '6', 90), x('Barbell Overhead Press', 3, '8', 75), x('Close-Grip Bench Press', 3, '8', 75), x('Barbell Curl', 3, '10', 60)],
  },
  {
    slug: 'heavy-metal-hour', name: 'Heavy Metal Hour', category: 'Full Body', difficulty: 'advanced', equipment: 'Barbell, rack, bench and a pull-up bar',
    description: 'Heavy deadlifts, squats, presses, rows and pull-ups, with long rests. The longest session here: warm up well and bring a spotter.',
    exercises: [x('Deadlift', 5, '3-5', 120), x('Front Squat', 4, '5', 120), x('Barbell Bench Press', 4, '5', 120), x('Barbell Row', 4, '6', 90), x('Pull-Up', 4, '6-8', 90), x('Barbell Overhead Press', 3, '6', 90), x('Hanging Leg Raise', 3, '10', 60)],
  },
  {
    slug: 'one-leg-at-a-time', name: 'One Leg at a Time', category: 'Lower Body', difficulty: 'advanced', equipment: 'A bench',
    description: 'Single-leg strength: pistols, Nordics and split squats. Slow, balanced and humbling.',
    exercises: [x('Pistol Squat', 4, '5', 90), x('Nordic Hamstring Curl', 3, '5', 90), x('Bodyweight Bulgarian Split Squat', 3, '10', 60), x('Single-Leg Glute Bridge', 3, '12', 45), x('Single-Leg Calf Raise', 3, '12', 30), x('Jump Squat', 3, '10', 45)],
  },
  {
    slug: 'bar-and-floor', name: 'Bar & Floor', category: 'Full Body', difficulty: 'intermediate', equipment: 'A pull-up bar',
    description: 'Pull-ups, push-ups, lunges and burpees: a whole-body bodyweight session with one bar.',
    exercises: [x('Pull-Up', 4, '6-8', 75), x('Push-Up', 4, '12-15', 60), x('Inverted Row', 3, '10-12', 60), x('Bodyweight Reverse Lunge', 3, '10', 45), x('Hanging Knee Raise', 3, '10', 45), x('Burpee', 3, '8', 60)],
  },
];
