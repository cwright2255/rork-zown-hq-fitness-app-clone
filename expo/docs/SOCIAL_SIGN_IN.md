# Signing in with Apple, Google and Meta

The login screen has three more ways in beside email and password: the Sign in with Apple button, and Google and Meta buttons.
All three end the same way: the provider proves who the person is, and Firebase Authentication signs them in (and creates the
account the first time). A new account goes to onboarding, like one made with email. An account that already existed goes home.

The code is `services/socialAuth.js` (the provider steps), `authService.loginWithProvider` (turns the result into the app's
user) and `app/auth/login.jsx` (the buttons). The app holds no secrets for any of this. The two ids it needs are public.

| Provider | How it signs in | What the app needs |
|---|---|---|
| Apple | The phone's own Sign in with Apple sheet. Not shown on a phone that cannot do it. | The Sign in with Apple capability in the build (done in `app.json`) |
| Google | The system's sign-in page, with PKCE, using the app's iOS OAuth client | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` |
| Meta | The system's sign-in page for the Meta (Facebook Login) app | `EXPO_PUBLIC_FACEBOOK_APP_ID` |

Until the id for Google or Meta is set, its button is still there. Tapping it says "Google sign-in isn't set up yet." (or
"Meta sign-in isn't set up yet.") and nothing else happens. Apple needs no id.

## Set up, once

### 1. Firebase: turn on the three providers

Firebase console, project `zown-3c512`, Authentication, Sign-in method, Add new provider.

- **Apple.** Turn it on and save. For signing in on an iPhone nothing else is needed here (the Services ID and the key fields in this
  panel are for the web). Revoking the token when an account is deleted uses its own key, kept as a Cloud Functions secret: step 6.
- **Google.** Turn it on, pick the project support email, save. This also creates the iOS OAuth client the app uses.
- **Facebook.** Needs the Meta app first (step 3). Turn it on, paste the Meta App ID and App Secret **here only**. They never go in
  the app, in a file in the repo or in a chat. Firebase then shows an OAuth redirect URI: copy it for step 3.

### 2. The Google iOS client id

It looks like `431690627943-xxxxxxxx.apps.googleusercontent.com`. Two places show it:

- Firebase console, Project settings, Your apps, the iOS app, download `GoogleService-Info.plist` again. The `CLIENT_ID` key in it is
  the id. (The file already in the repo was downloaded before Google was on, so it has no `CLIENT_ID`. The app does not read it for
  this; you only need the id.)
- Or Google Cloud console, APIs & Services, Credentials, "iOS client for zown-3c512 (auto created by Google Service)".

Check that its bundle id is `com.zownhq.app`.

### 3. Meta: the app

1. developers.facebook.com, My Apps, Create App. Choose the use case for authenticating with Facebook Login.
2. Settings, Basic: note the **App ID** (a number) and the **App Secret** (goes only into Firebase, step 1). Add the Privacy Policy URL
   (`https://zown-3c512-legal.web.app/privacy`, see `docs/PRIVACY_PAGE.md`) and an App icon (the new 1024 one) here. Add iOS as a platform with bundle id `com.zownhq.app`.
3. Products, Facebook Login, Settings:
   - Client OAuth Login: on. Web OAuth Login: on.
   - Valid OAuth Redirect URIs: add both
     `fb<APP_ID>://authorize` (with the real number, for example `fb123456789://authorize`) and the address Firebase showed in
     step 1 (`https://zown-3c512.firebaseapp.com/__/auth/handler`).
4. **Development mode:** until the Meta app is switched to Live, only people with a role on the app can sign in with Meta. Add each
   alpha tester under App roles, Roles (as Tester); they accept in their Facebook account. `public_profile` and `email` need no
   App Review. Switching to Live needs the privacy policy URL and a category.

### 4. Give the app the two ids

They are public identifiers, so plain text is right:

```
cd expo
eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value <the Google iOS client id> --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_FACEBOOK_APP_ID --value <the Meta App ID> --visibility plaintext
```

(If the name already exists, `eas env:update` instead. `eas env:list --environment production` shows what is set.) A value is
copied into the app when it is built or updated, so set both **before** the next build.

### 5. Build the app

This change needs a new native build, not only `eas update`: the Sign in with Apple capability is part of the app, and so is the
new 1024 icon.

```
cd expo
eas build --platform ios --profile production
eas submit --platform ios --latest
```

EAS adds the Sign in with Apple capability to the app's identifier and makes a new provisioning profile. If it asks to sync
capabilities, say yes. Do not `eas update` an older build first and expect Apple to work: it will not until the build is replaced.
(Google and Meta would work from an update once the ids are set, but the build is what you are about to make anyway.)

### 6. Apple: disconnect the app when an account is deleted (needed before the App Store)

Apple requires an app that offers Sign in with Apple to revoke the person's Apple token when they delete their account (App Review
guideline 5.1.1(v)). TestFlight does not check this; App Store review does.

How it works: the person taps Delete Account and confirms twice. Apple's own sheet then asks them to confirm. The app sends the one-time
code Apple gives to the `deleteMyAccount` function, which signs in to Apple with the key below, trades the code for a token and revokes
it. That happens **before anything is erased**: if Apple says no, nothing is deleted and the person can try again. An account that never
used Apple is unaffected, and sees no Apple sheet.

**a. Make the key.** developer.apple.com, Account, Certificates, Identifiers & Profiles, Keys, the + button.

1. Name it `ZOWN HQ Sign in with Apple` and tick **Sign in with Apple**, then Configure.
2. Primary App ID: `ZOWN HQ (com.zownhq.app)`. Save, Continue, Register.
3. Write down the **Key ID** (10 letters and digits) shown on the next page.
4. Download the `.p8` file. Apple lets you download it **once**. Open it in a text editor: you will paste what is inside in step b.

Do not commit the file or paste its text into a chat. (`*.p8` is already in `.gitignore`.) The Team ID, `GLFKG8342N`, is already in the code
(`functions/src/appleRevoke.js`); it is the same one shown under Membership on developer.apple.com.

**b. Keep the key as Firebase secrets.** In the Codespace:

```
cd expo
firebase functions:secrets:set APPLE_KEY_ID
firebase functions:secrets:set APPLE_PRIVATE_KEY --data-file -
```

The first asks for a value: type the Key ID and press Enter. The second waits for input: paste the whole text of the `.p8` file (from
`-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----`), press Enter, then press Ctrl+D. If it asks whether to redeploy functions that
use the secret, say no for now. (If you ever lose the file, make a new key in step a and set both secrets again.)

**c. Put it live, app first.**

```
cd expo
eas update --branch main --environment production
firebase deploy --only functions:deleteMyAccount
```

The app goes first on purpose. The function insists on an Apple code for any account that signed in with Apple, and an app made before this
change does not send one: with the new function and the old app, deleting an Apple account would just say "Sign in with Apple again first"
until the app updates. Close and reopen the app twice after the update. (A build made after this change has it already.)

**d. Check it on a phone:** the section "Deleting an account that signed in with Apple" in `docs/DEVICE_CHECKS.md`.

## If something does not work

| What the person sees | What it means |
|---|---|
| "Google sign-in isn't set up yet." / "Meta sign-in isn't set up yet." | That build was made without the id (step 4). Set it and make a new build or update. |
| "This sign-in method isn't turned on yet." | The provider is off in Firebase (step 1). |
| Google's page says `redirect_uri_mismatch` | Google did not accept the redirect `com.zownhq.app:/oauthredirect`. Check the client id is the **iOS** one for `com.zownhq.app`. If it still happens, the redirect in `services/socialAuth.js` (`GOOGLE_REDIRECT_URI`) has to become the reversed client id (`com.googleusercontent.apps.<the number part>:/oauthredirect`). |
| Meta's page says the URL is blocked, or the redirect is not allowed | The `fb<APP_ID>://authorize` address is not among Valid OAuth Redirect URIs (step 3), or Client OAuth Login is off. |
| Meta signs a tester in, but another person gets "App not active" or similar | The Meta app is in Development mode and that person has no role on it (step 3.4). |
| "An account with that email already exists. Sign in the way you first did…" | The email already belongs to an account made another way, and Firebase would not sign in with a second method for it. The app does not join accounts itself. |
| "Apple sign-in is not available in Expo Go…" | These need the real app (TestFlight). Email and password still work in Expo Go. |
| "We couldn't disconnect ZOWN HQ from your Apple ID" when deleting | The key is wrong or not set (step 6). `firebase functions:log --only deleteMyAccount` shows "could not revoke the Apple token: not-configured". Check the Key ID matches the key, the key has Sign in with Apple on for `com.zownhq.app`, and set both secrets again. |
| "Apple didn't accept the confirmation" when deleting | The one-time code was used or had expired. Try again; nothing was deleted. |
| "That isn't the Apple ID you signed in to ZOWN HQ with" | The phone is signed in to a different Apple ID than the one used to sign in. Nothing was deleted. |
| No Sign in with Apple button | The phone cannot offer it (not signed in to an Apple ID, or a simulator without one). |

Closing the sign-in page or sheet shows nothing; the person is back on the login screen.

## Not done yet (known, and not part of this change)

- **The register screen** has no Apple, Google or Meta buttons. A new account made by one of them is created from the login screen.
- **One person, two sign-in methods.** What happens when someone signs in with Apple, Google or Meta using an email that already
  has an account is Firebase's rule (the setting "One account per email address", on by default), not the app's. Depending on
  whether Firebase counts that email as verified, it either signs them into the existing account or refuses with the
  "already exists" message above. The app does not link accounts itself.
