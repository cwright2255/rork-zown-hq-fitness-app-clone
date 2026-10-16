# Rolling back an update

An update that went out wrong is undone in a few minutes, with no new build, by publishing the last good update again. This
page is that procedure, plus a practice run so the first time is not on a bad day. Run every command from the `expo/` folder.

## What this can and cannot undo

It undoes what `eas update` publishes: the app's code and assets. That is what the "Expo Publish" workflow publishes and
what `eas update --branch main --environment production` publishes.

It does not undo:

- **A build** (TestFlight, the App Store, anything with native code or an `app.json` change). Ship a new build.
- **Cloud Functions.** Check out the commit that was good and run `firebase deploy --only functions`.
- **Firestore rules.** Check out the commit that was good and run `firebase deploy --only firestore:rules`.
- **Data the bad version already wrote.**

An update only reaches builds with the same runtime version. Here that is the app version (`runtimeVersion` is the
`appVersion` policy in `app.json`), so an update reaches every installed build whose version matches `app.json`.

## Which branch do the builds read?

A build reads a channel, and a channel points at a branch. Read it from EAS instead of trusting your memory:

```
eas channel:view production
eas channel:view development
```

The manual production command publishes to the branch `main`, so `production` should show `main`. The workflow publishes
with `--channel development`.

## Roll back

1. **Find the last good update.** Each row is an update group, with the time, the message and the commit it was built from:

   ```
   eas update:list --branch main --limit 10
   ```

   Pick the newest group from before the bad one. `eas update:view <GROUP_ID>` shows one group in full, and adding
   `--insights` shows how many launches and crashes it had.

2. **Publish it again, so it becomes the newest update on the branch.**

   ```
   eas update:republish --group <GOOD_GROUP_ID> --message "Roll back to <what it was>"
   ```

   This copies that exact update, the same code and assets, to the front of the branch it came from, for the platforms it was
   published for. `eas update:rollback` walks you through the same choices with questions. (To put a group on a different
   branch, add `--destination-branch <name>`.)

3. **Wait for the phones.** The app checks for an update when it starts, downloads it in the background, and runs it the next
   time it is started from closed. Close the app completely and open it twice, as in `DEVICE_CHECKS.md`. A phone that never got
   the bad update ends up on the good code too.

4. **Check.** Do "Every update" in `DEVICE_CHECKS.md`, and the check that was failing.

5. **Fix forward.** Fix it on `main`. A push to `main` publishes to `development` only, once the tests pass, and does not touch
   production until you run the production command yourself.

Do not use `eas update:delete` to roll back. Deleting an update does not take it off phones that already have it.
Do not count on the app rescuing itself either: expo-updates only falls back in rare cases when an update fails to start,
never for a bug on one screen.

## Back to the code inside the build

```
eas update:roll-back-to-embedded --branch main --runtime-version <the version in app.json> --message "Back to the build"
```

This tells apps to stop using downloaded updates and run the code that was inside the installed build. Use it only when no
good update exists, for example when the very first update was the bad one. That code may be much older than anything you
have shipped since, so check what it still expects from Firestore and the Cloud Functions.

## Practice

Do this once while nothing is wrong. The first drill does not change what any phone runs. The second goes back and forth, so do
it while you are the only one on that build.

**Drill 1: republish the current update (same code)**

- [ ] `eas whoami` prints your account. If it does not, run `eas login`.
- [ ] `eas channel:view production` shows which branch the production channel reads. This page says `main`; if it shows another
      name, use that name wherever this page says `main`.
- [ ] `eas update:list --branch main --limit 5`. The newest group is **A**, the one before it is **B**. Write both IDs down.
- [ ] `eas update:republish --group <A> --message "Rollback drill, same code"`
- [ ] `eas update:list --branch main --limit 3` shows a new group at the top with that message.
- [ ] On the phone, close the app and open it twice. "Every update" in `DEVICE_CHECKS.md` passes.

**Drill 2: go back to B, then forward to A**

Pick B so that you can tell A and B apart on the phone, a screen or a message that differs.

- [ ] `eas update:republish --group <B> --message "Rollback drill, back to B"`
- [ ] On the phone, close the app and open it twice. You see B's behaviour.
- [ ] `eas update:republish --group <A> --message "Rollback drill, forward to A"`
- [ ] On the phone, close the app and open it twice. You see A's behaviour again.

If a command is not found, update the tool with `npm install --global eas-cli@latest`. The commands on this page are from the
eas-cli reference; `eas update:republish --help` shows the current options.
