# Phone checks

The tests run on a computer with stand-ins for Firebase and the phone's own features, so they cannot tell you the app works
in your hand. This is the short list to run on the phone after each update. Do the first section every time; do the others
when that kind of change went out.

**After `eas update`:** close the app completely and open it twice. The first open downloads the update; the second runs it.

## Every update (2 minutes)

- [ ] The app opens with no red error screen, and you are still signed in.
- [ ] Home, Workouts, Nutrition and Profile each open.
- [ ] Pull down to refresh on Home. Nothing errors.

## Your own day, in the evening

After about 8 PM your time (7 PM once the clocks go back). The old code switched to "tomorrow" at that hour.

- [ ] The water glasses on Home are not reset at 8 PM. They reset at midnight.
- [ ] A workout or run you finish in the evening is listed as today's, and Home's Calories card counts it today.

## Eat goal and burn goal are separate

- [ ] On Home, the Calories card shows "Burn goal". With none set it offers "Set a daily burn goal", which opens Daily Burn Goal.
      Set it. The eat goal on Nutrition (and on Recipes) does not change.
- [ ] Change the eat goal on Nutrition. The burn goal on Home does not change.

## Runs and hikes count everywhere

Finish a short run or hike (or look at one you already did).

- [ ] Home Calories card includes it. Swipe the card to Trends to see it on its day.
- [ ] Calorie history (tap through from the Calories card) lists it.
- [ ] Battle Pass missions and Analytics include it.

## Streak and steps

- [ ] Profile shows a Streak number. It is the days in a row with a workout, a run or a hike. Today or yesterday keeps it going.
      The "Streak" rows on the Home Calories and Steps cards are a different count: days in a row you reached your burn goal or
      your steps goal. They show 0 when no goal is set. The two numbers are not supposed to match.
- [ ] Settings, then Show in Leaderboards: switch it off and on. The Streak on Profile does not change.
- [ ] Home Steps card: today's count appears once Apple Health has synced. History starts from the first day on this update, so
      swipe to Trends and Lifetime and expect them to fill in a day at a time, not all at once.

- [ ] Profile, then Streak Calendar (`app/profile/streak.jsx`). The last 30 days are drawn in three rows of ten, with every
      day on the screen and today at the end of the bottom row, ringed. Days with a workout, a run or a hike are filled in.
      "Current streak" is the same number as Streak on Profile.
- [ ] Finish a short workout or run, then open Streak Calendar again. Today is filled in and the streak went up by one, or
      started at 1.

## Home widgets: Workout Streak and Next Up (once, on the first update with them)

On Home, scroll to the end of the cards. They come after Music. To hide or move them: the menu at the top of Home, then Edit Home Screen.

- [ ] Workout Streak shows the same number as Streak on Profile, and the last 7 days as dots, today last and ringed. Days with a
      workout, a run or a hike are filled in. Tap it: Streak Calendar (`app/profile/streak.jsx`) opens.
- [ ] Finish a short workout, go back to Home. The streak went up (or started at 1) and today's dot is filled in, without
      pulling down to refresh.
- [ ] Next Up shows the next event on your calendar, with Today, Tomorrow or the day, and the time. Tap it: the Calendar opens
      on that day. With nothing planned it says "Nothing planned" and opens the Calendar.
- [ ] Ask the Coach to add a workout to your calendar and say yes. Back on Home, Next Up shows it if it is the next one.

## Home widgets: Battle Pass, Training Load and Muscles (once, on the first update with them)

On Home, scroll to the end of the cards. They come after Next Up. To hide or move them: the menu at the top of Home, then Edit Home Screen.

- [ ] Battle Pass shows your level (Lv and a number) with a thin bar under it, and "0/3 missions today" up to "All missions done".
      Open the Battle Pass screen (`app/battlepass.jsx`) from the card: the level is the same, and the number of daily missions that
      show full progress there is the number on the card.
- [ ] Log a meal on the Nutrition screen, or finish a short workout, and go back to Home. The mission count went up without
      pulling down to refresh. (Three meals with foods in them make the meals mission.)
- [ ] Training Load shows one number with a few words under it, and a small dot on a bar. With under about a week of training it
      says "Needs more history". Tap it: the Health screen (`app/health.jsx`) opens, and its Training Load card shows the same number.
- [ ] Muscles lists up to three muscles, the most worked first, each with a coloured dot, and "Last 5 days" under them. After a
      leg workout the legs are at the top. Tap it: the Health screen opens, and its Muscle Fatigue heatmap has those muscles as the
      hottest. With nothing in the last five days it says "No recent load".

## Home widgets: Workout History and Running Log (once, on the first update with them)

On Home, scroll down past the cards. They are wide cards that come after the last card, one under the other (Workout History, then
Running Log). To hide or move them: the menu at the top of Home, then Edit Home Screen. Their switches there did nothing before.

- [ ] Workout History shows three numbers (Workouts, Calories, Time) under "Last 7 days". Swipe sideways: "This month", then "All
      logged", and the dots under the card follow. The card does not change height as you swipe.
- [ ] Tap View Full Log. Workout History (`app/profile/workout-history.jsx`) opens. The Workouts, Calories and Total Time at its
      top are the "All logged" page on Home. Set its filter to Week, then Month: the number of workouts listed is the Workouts
      number on the "Last 7 days" and "This month" pages.
- [ ] "Latest:" under the dots is the workout you did last, with "Today", "Yesterday" or the day.
- [ ] Running Log shows Distance, Time and Avg pace, and "2 runs" (or "activities" once you have saved a walk) at the right of each
      page. Open it with View Full Log (`app/profile/running-log.jsx`): its top numbers are the "All logged" page, and its Week and
      Month filters list the number of runs on the other two pages.
- [ ] Settings, then Distance Units: switch between miles and kilometres and go back to Home. Distance and pace on the Running Log card
      change with it (mi and /mi, or km and /km).
- [ ] With no workouts or no runs saved, the card says so in a line ("No workouts yet", "No runs yet") and the button still opens the
      full log.

## The Coach

Profile, then AI Coach. Ask "What do you know about my day?"

- [ ] It mentions things the app really has: steps, water, calories burned against your burn goal, and a fast if one is running.
- [ ] With no wearable connected it says it has no recovery reading. It does not make one up.

## After changing a key or a Cloud Function

One of each. A message like "request failed", or nothing at all, means that key or function is not working.

- [ ] Exercise search, and a muscle picture (RapidAPI key).
- [ ] Nearby trails (TrailAPI key).
- [ ] Nearby places and a place photo (Google Places key).
- [ ] Spotify playlists (the `getSpotifyAppToken` function): in a workout, open the music search (`app/music-search.jsx`) and look for
      a playlist. Results load. If the other searches work and this one shows nothing, this function is the cause.
- [ ] Browse recipes (Spoonacular key).
- [ ] Search a food in Nutrition (Calorie API key).

## Analytics (once, on the first build made after analytics was added)

Needs a new native build, not only `eas update`. An older build ignores the new code and sends nothing. Use a real device with
that build, signed in. Open the Realtime report: in the Firebase console, Analytics, Realtime, or in the linked Google Analytics
property, Reports, then Realtime. Event names show within a minute or two. The Events table can take a day to fill in, and the
values on an event (the workout name, the coach's `feature_type`) only show in reports once they are registered as custom
definitions in Google Analytics. Realtime lists the event names.

- [ ] Open the app. `first_open` and `session_start` show up. They come from Firebase itself, so if these are missing, the
      build or the Firebase config is the cause, not the app's own events.
- [ ] Start a workout (the screen where the exercises begin). `workout_started` shows up.
- [ ] Finish it all the way. `workout_completed` shows up. Start another, save and leave early: no `workout_completed`.
- [ ] Send the Coach a message. `ai_coach_used` shows up.
- [ ] Connect Spotify (Settings). `spotify_connected` shows up.

## Links into the app (once, after the update that removed the admin links)

- [ ] On the phone, open `zownhq://admin?cmd=logout` from Safari's address bar, and let it open the app. You are still signed
      in. Before this update, that link signed you out.
