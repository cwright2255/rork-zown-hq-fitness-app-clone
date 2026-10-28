# The public privacy policy page

The Privacy Policy is inside the app (`app/profile/privacy-policy.jsx`). It is also on the web, because three places ask for a public
address for it: the Meta app (before it can go Live), App Store Connect (the app's page), and TestFlight (when you invite people outside
your own team).

**The address:** `https://zown-3c512-legal.web.app/privacy`

## How it is made

The page is not written by hand. `lib/privacyPageHtml.js` builds `site/privacy.html` from the in-app screen, so the two always say the
same words. `__tests__/privacyPage.test.js` fails (and so does CI) if the file in the repo is not what the screen would build now, or if
a word differs. There is nothing to edit in the HTML itself.

It lives on its own Firebase Hosting site (`zown-3c512-legal`, set in `site/firebase.json`), not on the project's main site
(`zown-3c512`). The main site's setting in `firebase.json` is left as it was, and putting this page up does not replace anything on it.

## Put it online, once

You need to be logged in to Firebase in the Codespace (you are, if `firebase deploy` has worked for you).

```
cd expo/site
firebase hosting:sites:create zown-3c512-legal --project zown-3c512
firebase deploy --only hosting --project zown-3c512
```

The first command makes the site (if it says the name is taken, tell me and I will change it everywhere). The second puts the page on it.
Then open `https://zown-3c512-legal.web.app/privacy` in a browser: you should see the policy.

## Where to paste the address

- **Meta** (developers.facebook.com, your app): App settings, Basic, "Privacy Policy URL". Meta checks the address when you switch the
  app to Live.
- **App Store Connect:** the app, App Information, "Privacy Policy URL". Also under TestFlight, Test Information, "Privacy Policy URL",
  if it asks for one for external testers.

## When the policy changes

Edit `app/profile/privacy-policy.jsx` as usual (and its test), then rebuild and put up the page:

```
cd expo
WRITE_PRIVACY_PAGE=1 npx jest __tests__/privacyPage.test.js
cd site && firebase deploy --only hosting --project zown-3c512
```

The app part reaches phones with `eas update`; the web page is a separate deploy, so do both or the two will say different things.

## Later: your own address

`zownhq.com/privacy` would look better than a `.web.app` address. Firebase console, Hosting, the `zown-3c512-legal` site, "Add custom
domain", then follow the DNS steps it shows. The `.web.app` address keeps working, so nothing already pasted breaks.
