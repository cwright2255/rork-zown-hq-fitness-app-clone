# Firestore rules tests

These run the real `firestore.rules` in the Firestore emulator and try reads and writes as different people (alice, bob, a
visitor who is not signed in, an admin) to check who is let in and who is turned away. The normal `npm test` does not run
them: they need the emulator.

## Run them

```
npm run test:rules
```

That starts the emulator, runs every `*.test.js` file here against it, and stops it again. It needs:

- Java (the emulator is a Java program): `java -version` should print a version.
- The Firebase CLI: `npm install -g firebase-tools`.

No login and no real project is used (the project is `demo-zown-rules`). The first run downloads the emulator.

GitHub runs the same command in the "Firestore rules" job of the Tests workflow.

## Adding to the rules

Every path in `firestore.rules` (every `match`) has to have a `describe` in one of these files, named with the path exactly as it
is written in the rules, for example `describe('/duels/{duelId}', ...)`. `__tests__/firestoreRulesTests.test.js` (part of the
normal `npm test`) fails and names the path if one is missing, so a new rule cannot be added without a test.

A good set for a path is: the person it is for can do what they should; someone else who is signed in cannot; a visitor who is
not signed in cannot; and anything the rule limits (a field that must match, a value in a range, a write-once document) is tried
just inside and just outside the limit.

## Files

- `helpers.js`: loads the rules and gives each test `as(uid)`, `anon()` and `seed(docs)`.
- `config.js`: the project id and the rules file, shared with the test that checks the wiring.
- one test file per area: `users`, `owned-docs`, `social`, `competitions`, `admin-content`, `default-deny`.
