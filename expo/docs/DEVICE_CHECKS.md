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

## Home widgets: Challenges & Rank (once, on the first update with it)

On Home, scroll down past the cards. It is one wide card with two halves, after Workout History and Running Log. If you had saved
your own Home layout before this update, it comes last, under the "Invite your friends" banner. To move or hide it: the menu at the
top of Home, then Edit Home Screen ("Challenges & Rank"). It only reads. It never joins you to a challenge or changes anything.

- [ ] The left half, "Friends rank", shows a place like "#3" and "of 8 by XP". Open the Leaderboard (`app/leaderboard.jsx`), pick
      the XP board and the Following filter: your row is that place, and the number of rows is the "of" number.
- [ ] Tap the left half. The Leaderboard opens.
- [ ] Follow someone who is on the leaderboard, on Friends (`app/friends.jsx`), and go back to Home. The "of" number goes up by
      one without pulling down to refresh.
- [ ] With an account that follows nobody, the left half says "Follow friends to compare", and tapping it opens Friends.
- [ ] Settings, then turn off Show in Leaderboards, and go back to Home. The left half says "Hidden from leaderboards". Turn it
      back on: the place comes back.
- [ ] The right half shows the challenge you have joined that is on now (daily, weekly, monthly or seasonal), like "3/5" with a bar,
      its title and "4 days left". Open Challenges (`app/challenges.jsx`): the same challenge shows the same count and days left.
- [ ] Do a workout that counts toward a challenge you joined, and go back to Home. The count goes up and the bar grows. When it reaches
      the goal, the right half says "Complete" and the bar turns green.
- [ ] With nothing joined, the right half says "Join" and "Tap to join" with a challenge's name. Tap it: Challenges opens, and you are
      not joined until you press Join Challenge there.
- [ ] With no live challenge at all, the right half says "Open Challenges", and tapping it opens that screen.
- [ ] Join a challenge on the Challenges screen and go back to Home. The right half shows it.
- [ ] Pull down on Home. Both halves stay filled in and do not flash empty or show an error.

## Home widgets: Macros and Weight (once, on the first update with them)

On Home, they are two more cards in the grid, right after Muscles and before the wide cards. If you saved your own Home layout before
this update, they come at the end of the cards (not at the very bottom). To move or hide them: the menu at the top of Home, then Edit
Home Screen ("Macros", "Weight"). They only read. They never log a food or a weight.

- [ ] Macros lists Protein, Carbs and Fat, each as grams out of your goal ("75/150g") with a small bar (blue, orange, purple). Open
      Nutrition (`app/nutrition.jsx`) on today: the Protein, Carbs and Fat boxes there are the first numbers on Home.
- [ ] Log a food in Nutrition and go back to Home. The grams and bars have gone up, without pulling down.
- [ ] With nothing logged today, Macros says "Nothing logged yet" and shows 0 of each goal. Food logged on another day does not count.
- [ ] Tap Macros. Nutrition opens.
- [ ] Weight shows your latest weight ("172 lbs"). Open Progress (`app/progress.jsx`): the big number under Weight there is the same,
      and so is the "from start" line under it ("4 lbs from start", with an arrow down or up).
- [ ] Tap Log Weight on Progress, enter a weight and go back to Home. The new weight is there, without pulling down. The first time,
      Progress also asks for a target weight: set one, and the bottom line of the Weight card says how far you are ("7 lbs to target").
- [ ] Settings, then Weight Units: switch to kg and go back to Home. Weight shows kg with a tenth ("78.4 kg"). Progress still shows
      pounds whatever this says. Switch it back.
- [ ] After a body scan, a "Body fat" line shows the latest scan's figure, the same as Body Fat on Progress. With two or more scans it
      ends in an arrow and how far it moved since the scan before.
- [ ] With no weight logged, Weight shows a dash and "Log your weight", and tapping it opens Progress.
- [ ] Pull down on Home. Both cards stay filled in and do not flash empty or show an error.

## The Coach

Profile, then AI Coach. Ask "What do you know about my day?"

- [ ] It mentions things the app really has: steps, water, calories burned against your burn goal, and a fast if one is running.
- [ ] With no wearable connected it says it has no recovery reading. It does not make one up.

## The Coach and your calendar (once, on the first update with the switch)

Settings (`app/profile/settings.jsx`), then the new AI Coach section, just above Connected Services: "Let the coach add to my calendar".
It is on until you turn it off, and it follows your account, so the other phone shows the same. It only decides what the Coach may
put on the Calendar. Your own events, and the Calendar itself, are not touched by it.

- [ ] The switch is there and starts on. Close Settings and open it again: it stays where you left it.
- [ ] Switch on: ask the Coach "Put leg day on my calendar Monday at 7". The Yes / No card says "Add 1 event to your calendar".
      Tap Yes. It is on the Calendar. (Delete it from the Calendar after.)
- [ ] Switch off: ask the same thing. The Coach says it cannot while the setting is off and where to turn it on. There is no Yes /
      No card for the calendar, and nothing new on the Calendar.
- [ ] Switch off: ask for a workout ("Build me a 3 exercise leg workout and save it"). It still offers to save it to My Workouts, and
      Yes puts it there. Ask for a goal: that still works too.
- [ ] Switch off: ask for a meal plan with calorie targets. It can offer the daily targets, but no meals for the Calendar, and the
      chat says so.
- [ ] Switch on, ask for a workout and a schedule, and do not tap yes yet. Turn the switch off in Settings, come back and tap Yes.
      The workout saves and the Calendar stays empty, and the Coach says it left the calendar alone.
- [ ] Turn the switch back on and the Coach can use the Calendar on the next message, without closing the app.

## Calendar invitations (once, after the rules and the function are deployed, then the update)

Needs two accounts, A and B, on two phones (or one phone and Expo Go), and A follows B (Friends, `app/friends.jsx`). Following is one
way: B can only invite A if B follows A as well. Order matters: first `firebase deploy --only firestore:rules` and the functions deploy
(it holds the account-erasure change), then `eas update`. Without the rules deployed, every invite says "You can only invite people you follow".

- [ ] A: Calendar, add an event for tomorrow ("Park run", Run, 7:00 AM) and open it. There is an Invites section with "Invite a
      friend". On a brand new event that is not saved yet, there is no Invites section.
- [ ] A: tap "Invite a friend". The list shows the people A follows, close friends first. Tap Invite beside B. It says Sending...,
      then Waiting. Done closes the list. Opening the event again shows B with Waiting and "Cancel invite".
- [ ] B (within a few seconds, with the app open, no refresh needed): Calendar shows an Invitations card: "A invited you",
      Park run, Run, tomorrow at 7:00 AM. On Home, Next Up says "1 invite waiting".
- [ ] B: tap Accept. The Calendar opens on tomorrow, Park run is on that day with "Invited by A", the Invitations card is gone,
      and Next Up on Home no longer says an invite is waiting. B's phone asks for notification permission the first time.
- [ ] A: open the event. B now says Going and there is no Cancel invite for B any more.
- [ ] A: invite B again to the same event. B shows Going in the list, with no Invite button.
- [ ] A: add another event, invite B, then tap "Cancel invite" before B answers. B's Invitations card goes away, and Next Up stops
      saying it is waiting. A's event shows no row for B.
- [ ] A: invite B to a third event. B taps Decline. Nothing is added to B's Calendar. A's event shows B as Declined, and A can tap
      Invite for B again.
- [ ] B: open Park run from the Calendar. The sheet says "Invited by A" and there is no Invites section (it is A's event to share).
      B can still change its time or remove it, and that does not change A's.
- [ ] B has the reminder on: Park run buzzes B's phone at 7:00 AM the day of the run.
- [ ] A cannot invite someone A does not follow: there is no way to type a name. A person A has unfollowed disappears from the list.
- [ ] With airplane mode on, A taps Invite: it says "That did not go through. Check your connection and try again." and B gets nothing.
- [ ] Delete B's test account (or a spare one that was invited): its invitations are gone from A's event, and A's own account is
      unaffected. (This one needs the functions deploy.)

## Plans: Free, Pro and Legend (once, after the rules and the functions are deployed, then the update)

Order matters. First `firebase deploy --only firestore:rules`, then
`firebase deploy --only functions:postLLM,functions:generateWorkoutPlan,functions:generateBodyCompositionInsight,functions:deleteMyAccount`,
then `eas update`. Without the rules, the phone cannot read its plan and shows the locks to everyone. Without the functions, nothing
is limited, because the old ones do not count messages or look at the plan.

The moment this is live, everyone is on Free, you included (Analytics and the body scan lock, the Coach stops at 5 a day). So before
the functions go out, give your own account Legend as described next. Anyone else you want to keep on a paid plan while buying is
not open (a tester, a friend) needs the same document.

Nobody can buy a plan yet (the buttons say "Coming soon"). To try a plan, set it by hand: in the Firebase console, Firestore, the
`entitlements` collection, add a document whose id is the account's uid (it is the id of the account's document in `users`) with
`tier` (text: `pro` or `legend`) and `status` (text: `active`). Leave `expiresAt` out, or set a date in the future as text, such
as `2027-01-01T00:00:00.000Z`. Change `tier` to switch plans and delete the document to go back to Free. The phone follows the
document within a few seconds, with no restart. See `lib/entitlements.js` for what each plan includes and the daily limits.

- [ ] Free: Settings, Account has a "Your plan" row that says "Free. See what each plan includes". Tap it: Plans shows Free, Pro
      and Legend, "Your plan" on Free, and "Coming soon" (greyed out) on the Pro and Legend buttons. The back arrow works.
- [ ] Free: Home, tap the calendar icon at the top right (it opens Analytics, `app/analytics.jsx`). The screen says "Analytics is
      part of Pro" with "See plans" and "Not now". "See plans" opens Plans with "Analytics is part of Pro." at the top. "Not now"
      goes back to Home.
- [ ] Free: Health or Progress, start a body scan. It says "Body scan and 3D body is part of Legend". An old scan that was saved
      before is still open to view from the scan list.
- [ ] Free: the Coach. Send 5 messages. The sixth gets an answer from the coach saying you have used your 5 free messages for today
      and that Pro gives 100 a day, with a "See plans" button under it. Close and reopen the Coach: that message is not in the history.
- [ ] Free: Workouts, tap to get a recommendation (or Quick Workout, Generate Workout). It opens Plans with "AI workout plans is part
      of Pro." at the top, and does not say something went wrong.
- [ ] Free: the AI Help chat and the meal photo scan share 5 requests a day. After the 5th, Help falls back to its built-in FAQ
      answers, and a meal photo says "Daily limit reached" with "See plans".
- [ ] Set `tier` to `pro`: within seconds Settings says "Pro", Analytics opens, the Coach answers past the 5th message, and
      Workouts, Generate makes a plan. The body scan is still locked ("part of Legend"). Plans shows "Your plan" on Pro and only a
      Legend button.
- [ ] Set `tier` to `legend`: the body scan opens (camera permission as before) and Plans has no upgrade buttons.
- [ ] Set `status` to `expired` (or `expiresAt` to a past date): within seconds Settings says "Free" again and the locks are back.
- [ ] Day reset: the count starts over at midnight Eastern. In the console, the `aiUsage` documents are named `<uid>_<day>` and
      hold `coach`, `assist` and `insight` counts; deleting today's resets that person's count (you cannot do this from the app).
- [ ] Sign out and sign in as someone else: they see their own plan, not the first person's.

## Health page, the training-load comment and removing a glass of water (once, on the first update with them)

JavaScript only: no rules, no functions and no new build. After CI is green, `eas update --branch main --environment production`.

- [ ] Health: the "Your Health Score" circle, "Updated today at 9:15 AM", the Heart Rate / Blood Oxygen / Stress Level tiles and the
      "AI Coach" tip about a 10-minute stretch are gone. Nothing on the page is a number the app did not read or work out.
- [ ] Health, Recovery: with Apple Health allowed (or a device connected under Wearable Sync) the tiles show your real resting heart
      rate (bpm) and HRV (ms), and the line under them says "Latest readings from Apple Health" (or the device). Apple Health tiles say
      "HRV (SDNN)", a connected device says "HRV (RMSSD)": they are different measures, so do not compare them with each other.
- [ ] Health, Recovery: with no reading yet, the tiles show a dash and the line says "No readings yet. Connect a device under
      Wearable Sync below." (Delete the app's Health permission in iOS Settings to see this.)
- [ ] Health, Training Load (needs about a week of workouts, runs or hikes): a one or two sentence comment appears under the bar a
      moment after the page opens. Leave the page and come back, force-close the app and open it again: the same comment is there
      straight away, and the Coach's daily count is not used (the comment has its own allowance). In Firebase, `aiUsage`, today's
      `<uid>_<day>` document has `insight` at 1, not more, however many times you opened the page.
- [ ] Health, Training Load: log a workout, then open Health. The numbers change, so a new comment is asked for (`insight` goes to 2).
      If you are offline the card still shows its numbers, with no comment.
- [ ] Health, Body Composition: on Free or Pro the card says "Legend" next to its title, "Body scan is part of Legend" under it
      (or the last scan, if you have one), and the green button says "See plans" and opens Plans with the body scan at the top. On
      Legend there is no label, and the button says "Scan now" or "New scan". A scan taken earlier still opens from the card on any plan.
      Set your own account to Free (see Plans above) to see the label, then back to Legend.
- [ ] Home, Hydration: open the Hydration card. Under +250ml and +500ml there is a "-250ml" button. Tap +250ml twice, then -250ml: the
      glass count goes down by one (the bar and the number). At 0 the button is greyed out and does nothing.
- [ ] Nutrition tab, water card: "Remove Glass" sits next to "Add Glass" and works the same way; it is greyed out at 0.
- [ ] Water and XP: add glasses until you pass a reward step (the XP shows), remove one, add it again: the XP is not paid a second
      time that day, and removing a glass does not take XP away.
- [ ] Remove a glass, force-close the app and open it again: the count is the lower one.
- [ ] Home, Hydration: tap +250ml, then in the Firebase console open Firestore, `users`, your uid, `data`, `health`: `hydration.glasses`
      matches the number on the card (before this change Home's buttons only saved it on the phone). +500ml adds two.
- [ ] Health page with Apple Health allowed: open it, then check the same `health` document: `steps` and `stepsDate` are today's, and
      the steps XP shows in your XP total (the Health page used to read the steps without saving them to your account).

## Trend charts and the daily record (once, on the first update with them)

JavaScript only: no rules, no functions and no new build. After CI is green, `eas update --branch main --environment production`.
Needs a phone with Apple Health allowed and a few weeks of Apple Watch (or phone) readings, and ideally a weight logged on Progress.

- [ ] First open of Health after the update: iOS asks once for permission to read sleep (the other readings were allowed already).
      Allow it. If you decline, the Sleep chart says "No readings" and the other charts still work.
- [ ] Health, Trends (below Health Metrics): four cards in this order: Sleep, HRV (SDNN), Resting heart rate, Weight. A switch above
      them reads "7 days" and "28 days"; 7 days is picked first. Tapping 28 days changes all four cards at once.
- [ ] Right after the first open, the 28 days already show the readings Apple Health had (the phone reads the last 28 days at once).
- [ ] Sleep: pick a recent night. The chart's reading for that day (tap the chart near its dot) matches the total in the Health app
      for that night, within a few minutes. Naps are not counted as a night, and a night is filed under the day you woke up.
- [ ] Tap the chart near a dot: the line under the average reads that day, for example "Oct 17: 62 bpm", and the dot grows and is
      ringed in black. Tap the same dot again: it goes back to "Latest, ...". A tap between two dots picks the nearer one.
- [ ] A day with no reading is a gap in the line, never a dot at zero. A card with no readings at all says "No readings in the last 7
      days" ("No weigh-ins" for Weight) and draws nothing.
- [ ] Weight follows Settings > Weight Units (lb or kg). Log a weight on Progress, come back to Health: it shows in the chart.
- [ ] A line like "-4 bpm vs the 7 days before" appears under a card only once both periods have at least 3 readings.
- [ ] Health Metrics, Sleep row: shows last night's sleep (for example "7.4h") with Apple Health, not a dash.
- [ ] A connected device (WHOOP, Oura and so on): the HRV card says "HRV (RMSSD)", and its readings start building from the day it is
      first opened (nothing before that: there is no history to fetch). Do not compare it with Apple's SDNN.
- [ ] In Firebase, `users`, your uid, `data`, `health` now has `readingsHistory`: one entry per day with `restingHeartRate`, `hrv`
      and `sleepHours`. It holds at most the last 400 days.
- [ ] Privacy Policy (Profile > Privacy Policy), "Information We Collect", Fitness activity: mentions sleep and the daily record.

## Readiness score (once, on the first update with it)

JavaScript only: no rules, no functions and no new build. After CI is green, `eas update --branch main --environment production`.
Needs Apple Health with a few weeks of readings (or a connected device that has been read for about two weeks).

- [ ] Health, between Recovery and Training Load: a Readiness card with a number out of 100, a word (High, Moderate or Low) with a
      coloured dot, and "Out of 100, made from N of 4 readings".
- [ ] Under the number there are four rows: HRV, Resting heart rate, Sleep, Training load. Each says what was read ("55 ms today,
      50 ms usual (+10%)"), its own score on the right and its weight under it (x35, x25, x25, x15). The formula in words is at the bottom.
- [ ] Check the sum by hand: multiply each row's score by its weight, add them up, divide by the weights of the rows that have a score.
      It matches the number on the card (rounded).
- [ ] "Usual" is your own average of the last 4 weeks, not including today. Open the Trends chart for HRV or resting heart rate over
      28 days: the "usual" in the row is close to that average.
- [ ] A row with no reading yet today says "Waiting for today's reading" (resting heart rate often arrives later in the day than HRV and
      sleep) and shows a dash; the number is worked out from the other rows and changes when the reading arrives.
- [ ] Sleep: 8 hours or more scores 100; 7 scores 75; 6 scores 50.
- [ ] After a hard training week the Training load row scores lower (above 1.3 it starts to fall) and the Readiness number goes down with it.
- [ ] With nothing read at all (no Apple Health permission, no device) there is no Readiness card. With some readings but not enough, the
      card says what it is waiting for and how many earlier readings it has ("6 of 10 so far") and shows no number.
- [ ] The card never shows a number made from fewer than two of HRV, resting heart rate and sleep.

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
