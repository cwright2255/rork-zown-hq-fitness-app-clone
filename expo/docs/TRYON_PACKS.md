# Try-on drape packs and sizing files

What these files are, where they live, how the app uses them, and what you do to put them (or new ones) in place. The files themselves are **not in this
repo, which is public**. They are in private Firebase Storage.

## What the try-on does

A garment was simulated on a few hundred made-up bodies (the Anny body model, the same one the Body Scan mesh service makes). From those simulations the
builder keeps, per garment and size, a small **drape pack**: the garment's average shape plus the few ways it changes with the body. On the phone the
app takes your scan's body, works out a handful of numbers that describe its shape, and blends the garment for it. That is a sum over a few dozen
tables, not a simulation, so it takes a few milliseconds. Then a short pass keeps the garment 4 mm off the skin. **The fitting is
done on the phone** and Try-On itself downloads only the garment files, the same files for everyone. The 3D body it fits to is the one the Body Scan screen
builds from your latest scan (`lib/loadScanMesh.js`): once made it is kept on the phone and used with no network, and the first time it is requested from
the mesh service with the scan's saved numbers (height, weight, gender, body fat, and the waist and hip it has), signed in, exactly as Body Scan does.

Garments in this set (`lib/tryOn/garments.js`):

| Group | Garment | Sizes |
|---|---|---|
| men | Men's Shorts | XS, S, M, L, XL, 2XL, 3XL |
| men | Men's Sweatpants | XS, S, M, L, XL, 2XL, 3XL |
| men | Men's Hoodie (Scallop-Bottom Performance Hoodie, hood up) | XS, S, M, L, XL, 2XL, 3XL |
| women | Women's Sports Bra | S, M, L, XL, 2XL, 3XL, 4XL |
| women | Women's Cami | S, M, L, XL, 2XL, 3XL |

The phone picks the group from the account's gender setting (`groupForGender`). A garment is drawn in **one colour**: a pack holds shapes only, no
pictures or fabric.

**Two garments at once.** One top and one bottom can be worn together (`slot` in `lib/tryOn/garments.js`: the hoodie is a top; the shorts and the
sweatpants are bottoms). Tapping a garment puts it on in its slot, replacing what was there; tapping it again takes it off. The bottom is fitted first,
exactly as when it is worn alone, and **nothing that goes over it changes it**. The top is then fitted to the body as it would be bare, and kept off the
garment underneath in two steps (`lib/tryOn/layers.js`): the skin under the bottom is moved out to the bottom's surface (the "dressed body"), so the same
4 mm push that keeps a top off the skin keeps it outside the bottom too, and then any point of the top that the bottom's waistband or hem still stands
proud of is raised over it, with a smooth falloff and never at the top's own hem, cuffs or neck. The dressed body can fold where a bottom bridges a crease
of the body (the cleft of the seat), so a last pass checks the top against the **real skin** again and moves anything that ended up inside or against it
out, lifting it over the bottom once more. (The skin is moved out along directions smoothed over a few centimetres, so that across the cleft of the seat the dressed body
bridges it, as the garment does, instead of folding into spikes.) The top's own size is chosen from the body, not from the bottom. The hoodie's pack is the same kind of file
as the pants packs and is blended the same way; only the fitting over a bottom is new.

## Where the files are

Firebase Storage, bucket `zown-3c512.firebasestorage.app`:

```
tryon-packs/v1/manifest.json
tryon-packs/v1/men/sizing.json
tryon-packs/v1/men/shorts_XS.zdp ... shorts_3XL.zdp, sweatpants_XS.zdp ... sweatpants_3XL.zdp, hoodie_XS.zdp ... hoodie_3XL.zdp
tryon-packs/v1/women/sizing.json
tryon-packs/v1/women/bra_S.zdp ... bra_4XL.zdp, cami_S.zdp ... cami_3XL.zdp
```

36 files besides the manifest (34 packs and 2 sizing files), 57.9 MB in all. A phone downloads only what it opens: the manifest, its group's `sizing.json` (men's about 145 KB, women's about 150 KB) and the one pack for the garment
and size on screen (1.1 to 2.5 MB). Files are kept on the phone (the app's document folder, `tryon-packs/v1/`), so the second time a garment opens
there is no network.

`storage.rules` has the rule for the folder: **read if signed in, write for nobody**. Nobody can change these files from the app; only you can, from
the Firebase console or `gsutil`, which are not bound by the rules.

**manifest.json** lists every other file with its size in bytes and its SHA-256. The app checks every file against it, whether it was just downloaded
or kept from before. A file that does not match is thrown away and downloaded again, and if it still does not match the screen says the garment
could not be read. That is how a half-finished upload or a replaced file is caught. The app asks for the manifest once each time it opens, and uses the
kept copy when there is no network.

## Putting them in place (once)

Order matters: the rule first, then the files, then the update.

1. **Rule.** From `expo/` : `firebase deploy --only storage`. (Without it, Storage refuses every read of these files, and the Try-On screen says the
   garment is not available yet.)
2. **Files.** Unzip the two zips into one folder so you have `tryon-packs/v1/...` (each zip holds the same `manifest.json`; the second can overwrite the
   first). Upload the folder `tryon-packs` to the **top** of the bucket, either
   - in the Firebase console: Storage, Files, drag the `tryon-packs` folder in; or
   - with gsutil: `gsutil -m cp -r tryon-packs gs://zown-3c512.firebasestorage.app/`
3. **Check.** Storage, Files, `tryon-packs/v1/`: `manifest.json`, `men/`, `women/`. There should be 37 files in all: the manifest, 2 sizing files and 21 + 13 packs.
4. **Update.** After CI is green: `eas update --branch main --environment production` (from inside `expo/`), then the check in `DEVICE_CHECKS.md`,
   "Try-on on your own body".

**Adding the hoodie to a set that is already in Storage.** The hoodie came after the first upload, so it is an update, and the order matters because the app only offers a
garment that is in `men/sizing.json`, and checks every file against `manifest.json`: (1) in `tryon-packs/v1/men/` upload the seven `hoodie_*.zdp` files; (2) replace
`men/sizing.json` (it now holds the chest measure and the hoodie, and the shorts' and sweatpants' measures are the same as before); (3) replace `manifest.json` **last**.
The shorts and sweatpants packs and everything for women are not touched. Do the OTA update only after all three are in.

Do not put the files in the repo, and do not commit the unzipped folder. `.gitignore` does not cover it.

## Replacing a file or adding a version

- **Same version, one file changed** (a corrected pack): upload the new file over the old one, then make `manifest.json` again (below) and upload it too.
  Upload the manifest **last**: until it changes, a phone that already has the old file keeps using it, which is fine; a phone that fetches the new manifest
  first would otherwise throw away a file that is still correct.
- **New garments or sizes**: add the files, make the manifest again, add the garment to `lib/tryOn/garments.js` and the sizing file, and send an update.
- **A change to the file format or the sizing model**: use a new folder (`v2/`), change `PACK_ROOT` in `lib/tryOn/packStore.js` and the storage rule
  already covers any `{version}`. Phones on the old app keep reading `v1/`, so leave it in place until nobody is on the old build.

Making the manifest again, from the folder that holds `manifest.json` (that is `tryon-packs/v1/`), with Node:

```
node -e "
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const files={};
const walk=(d)=>{for(const n of fs.readdirSync(d).sort()){const p=path.join(d,n);if(fs.statSync(p).isDirectory())walk(p);else if(n!=='manifest.json'){const b=fs.readFileSync(p);files[path.relative('.',p)]={bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};}}};
walk('.');
fs.writeFileSync('manifest.json',JSON.stringify({files,version:1},null,1));
console.log(Object.keys(files).length+' files');
"
```

(It gives the same bytes as the manifest that was built with the packs.)

## The pack format (ZDP1)

A pack is one file: the four letters `ZDP1`, a 4-byte little-endian length, a JSON header of that length (plain ASCII), then the raw arrays one after the
other in the order the header lists them (`arrays`: name, type, shape). `lib/tryOn/pack.js` reads it; there is no dependency.

Header: `ell` (width of the smooth correction), `ybar_scale`, `n_vertices` (the garment's), `r` (shape changes kept), `k` (body numbers), `n_train`
(bodies it was built from), and the garment, group and size.

Arrays: `zone_idx` (which of the body's 13,718 vertices are read: the zone the garment sits on), `basis_mean` / `basis_comps` / `basis_std` (turn those
vertices into `k` body numbers), `mu_z` / `sd_z` / `Ztrain` (how the training bodies were spread), `W` (the straight-line part of the body numbers to
shape changes), `alpha` (the smooth correction from the training bodies, a Gaussian kernel of width `ell`), `V_scale` / `V_int16` (the `r` shape changes,
stored as 16-bit numbers), `ybar_int16` (the average garment), `faces` (the triangles, 16-bit).

The blend: body vertices, soles moved to the origin, projected on the basis, standardized, then `W` plus the kernel sum over `Ztrain` give `r` numbers,
which weight `V`. The result is the garment's vertices in the **body model's own axes** (Z up, metres). The Try-On screen puts the garment in the
same place and turning as the body mesh, which the viewer rotates and moves. `__tests__/tryOnPack.test.js` checks the phone's blend against the builder's
numbers on a small made-up pack (`__tests__/fixtures/tryon/tiny.zdp`; its numbers are invented, no product data is in the repo); on the real packs
the two agreed to 0.0001 mm.

**Unusual bodies.** `bodyDistance` compares the body's numbers with the training bodies. More than twice the typical spacing from the nearest one
(`OUTSIDE_RATIO` in `pack.js`) and the screen says the body is unusual for this garment and the drape may be off. That threshold was set from very few far
test bodies; treat it as a first guess.

## The sizing file and the size window

`men/sizing.json` and `women/sizing.json` hold, for the group:

- **A tape measure for the body mesh.** A waist and hip (men), or a bust, underbust and waist (women), in cm, as one weighted sum over the body's
  vertices in the garment zone (`zoneIdx`, weights `w`, offset `b0`). Fitted by ridge regression on the bank of made-up bodies, checked leaving one body out
  each time: men waist 0.30 cm, hip 0.39 cm, chest 0.11 cm (the hoodie's measure); women bust 0.05, underbust 0.27, waist 0.29 cm (average error). The phone and the builder agree to rounding.
- **Per garment and size**: the range of measures it was simulated on (`lo`, `hi`), a typical good fit (`centre`, `sd`), and two logistic models, the
  chance the garment comes out too tight and the chance it comes out too loose, from the measures (fitted to the simulation's verdicts: "too tight" and
  "too loose"). `fitRate` is how often the size came out good or snug among the bodies it was tried on.

How a size is picked (`lib/tryOn/sizing.js`): among the sizes whose tested range (1.5 cm either side) contains the body, take the highest
`(1 - P(tight)) x (1 - P(loose))`, weighted toward the size whose typical good fit is nearest (`sigma` 1.5). If no size contains the body, the nearest is
shown with "outside". The verdict words on the screen: good (chance of fitting 80 % or more), likely (55 % or more), tight, loose, outside.

Honest limits, as measured on the bank of made-up bodies (cross-validated; the recommended size was one that fitted in 88 to 98 % of the cases):

- Shorts and sweatpants drape to about 6 to 9 mm of the simulation. A body between two training bodies can show a crease (thighs, between the breasts) up
  to about 27 mm out in a mismatched size, for under 1 % of the garment's points.
- The hoodie drapes less exactly than the pants: leaving one body out of its pack, the prediction is off by 15 to 25 mm RMS (XS 16.7, S 14.8, M 17.1, L 18.2, XL 21.9, 2XL 20.5, 3XL 25.3),
  against 6 to 9 mm for the pants, because loose fabric folds in ways that change from one body to the next. It is smooth and keeps off the skin, but its wrinkles are
  approximate. Of the bodies each size was tried on, it came out good or snug on 100 % (XS), 96 % (S), 79 % (M), 75 % (L), 71 % (XL), 71 % (2XL) and 38 % (3XL). The 3XL was built
  from only 9 usable bodies (most of the bank is too small for it), so heavy bodies in 3XL are the least tested part of the set.
- The hood is simulated, hood up, as the updated Scallop Hoodie (tech pack SBH-001 v1.1: raised neck, three-piece hood with a centre insert, quarter zip) is cut: it is part of
  the same cloth simulation as the body and sleeves, so each body gets the hood the cloth settles into, and the pack blends those. It frames the face on most bodies, but the larger
  sizes have a bigger hood, and on some bodies its opening falls forward over the forehead and eyes. Measured on the packs' predictions for all 128 men, in the size the app picks, the share
  of the face the hood covers is 4.5 % in the median, 15 % at the 90th percentile and 53 % at worst, and it is over 30 % on 7 of the 128 (in the simulations themselves, 10 of 163, all in
  L, 2XL and 3XL). Leaving those drapes out of the packs brought the worst down to 28 %, but made the bodies near them fit worse (skin showing through the sleeves and torso on two
  of the test bodies), so they are in. The raised neck covers the chin by design. The hoodie in the simulation is zipped up, so the collar in front is the zip's collar; there is no
  open V at the throat as on a pullover. In the simulations the seams close to within 7.4 mm (median of each simulation's largest gap; 12.7 mm at worst).
- Skin check of the hoodie in the app, with the hoodie over the shorts on all 128 men (each in the size the app would pick): a few points of the hoodie end up inside the skin after the push, 29 points on 7 of the 128 bodies, 3.9 mm deep at the very worst. 26 of them are on the hood's opening
  where it rests against the face, and 3 are on a cuff where it meets the hand. The hood-down hoodie that was in this set before had
  2 points on 2 bodies. It is the least clean part of the fit; it is small enough not to show at the size of the phone's screen.
- A hoodie over the shorts was checked on all 128 of the bank's men, and over the sweatpants on 18 of them (each body in the size and bottom the app would pick; the sweatpants gave
  the same kind of result). In the 128 outfits over the shorts, points of the hoodie sit under the shorts' surface (up to 8.3 mm, 224 points on 35 of the bodies, out of about 2,200 near the shorts in each outfit),
  which is the hoodie's hem and the shorts' waistband meeting; the hood-down hoodie had 227 such points on 31 bodies, up to 6.6 mm. The fit takes about 1.6 s (median) and up to 3.4 s on a computer
  for the hoodie over a bottom. On bodies with a deep seat crease the hoodie follows the crease; it does not hang straight across it.
- The bra's 4XL was built from only 16 bodies that were usable; the cami has no 4XL.
- The bank bodies come from Anny's population sampler. A body from the real mesh service is made from typed numbers through the service's own slider
  mapping (known: it makes the body about 10 % taller, and ignores a typed waist and hip), so the measure model and the blend have **not yet been checked
  on bodies made by the service**. The Try-On screen shows how long a fit took and the verdict, so a first run on real scans is the test.

## More room in the sweatpants

The packs hold the fit as it was simulated, which on the legs was close to the skin. `lib/tryOn/relax.js` gives the sweatpants (and only them: `relax` in
`lib/tryOn/garments.js`, 15 mm now) a little more room: each point of the garment is moved out from the skin, along the skin's direction there, by up to that amount, after
the band and hem are set and before the 4 mm push. The waistband (measured from its own top edge, so the tilted band is as it was), the hem (half the ease), and the crotch and
the seam up the middle (nothing within 2 cm of the garment's middle, all of it from 9 cm out) are left alone, and a point already more than 3 cm off the skin is moved less
(nothing beyond 6 cm), all changing smoothly so no crease appears. The folds the simulation made stay where they are. To make them looser or closer, change `relax` (0 = as
simulated); nothing in Storage changes.

## How the packs were built

On a computer, outside the app and outside this repo (garment data and the simulation output are not for the public repo):

1. **Bodies.** A bank of made-up grown-up bodies (age 20 to 45) from the Anny model's own population sampler (calibrated on WHO growth data): 128 men
   and 223 women, each measured on its mesh with a tape-style method. None is anyone's scan.
2. **Simulation.** Each garment in each size was simulated on each body, and the garment's vertices after it settled were kept. Every run got a verdict:
   too tight, snug, good or too loose.
3. **Packs.** For each garment and size, the bodies whose drape came out good or snug are the usable ones; some of them are held out and never used to
   build the pack, so the error can be measured on bodies it has not seen. The rest give the pack: the body reduced to `k` numbers (PCA on the zone's
   vertices), the garment reduced to `r` shape changes, then the straight-line part and the smooth correction.
4. **Sizing.** The tape-measure model and, from the verdicts, the too-tight and too-loose models are fitted and written to `sizing.json`. Each pack is
   written as ZDP1, then the manifest (above).
5. **The hoodie.** 163 simulations (7 sizes, 19 to 24 bodies each, from the bank, with chests spanning the range each size could fit) of the updated raglan hoodie (hood v1.1)
   with the hood up and the zip closed, simulated whole: the hood is part of the simulation, nothing is laid down afterwards. Every good or snug drape goes into its size's pack.
   The hoodie's own measure is the chest.

The phone uses the same formulas as the builder. On the real files this was checked once on a computer: the phone code's measures matched the builder's to
rounding for all 351 bodies, it picked the same size for every one, and its blend matched to 0.0001 mm. The hoodie packs were checked the same way on the 128 men's
bodies (measures to 2e-11 cm, the same size every time, blend to 0.0003 mm). That check needs the private files, so it is not in the repo's tests; the tests use the small made-up pack.

## Things the app does with them (so you know what to look for)

- `lib/tryOn/packStore.js`: downloads with `GET https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media` and the header
  `Authorization: Firebase <the signed-in person's ID token>`, keeps files as base64 text in the document folder, checks each SHA-256 against the manifest.
  Errors the screen tells apart: no network, not there (403/404), not matching the manifest.
- `lib/tryOn/tryOnSession.js`: pack, blend, the extra room for the sweatpants, push-out, and timings (`pack`, `blend`, `push`, `total`, in ms).
- `lib/tryOn/pushOut.js`: keeps the garment at least 4 mm off the skin. A fine grid (2 cm) around the body, and a coarse grid (8 cm, 3 rings) made only
  when a point is deep inside. About 0.1 to 0.8 s on a computer for the real packs, **not yet timed on a phone**.
- `app/shop/try-on.jsx`: the screen. `components/TryOnScene.jsx`: the drawing.

## If something goes wrong

- **"Try-On garments are not available yet."** The files are not in Storage at `tryon-packs/v1/`, or the storage rule has not been deployed, or the person
  is signed out (the server answered 401, 403 or 404). Check the console listing, then `firebase deploy --only storage`.
- **"A garment file did not download correctly."** A file's SHA-256 differs from the manifest: an upload was cut short, or a file was replaced without making
  the manifest again. Make the manifest again, upload it last.
- **"Connect to the internet and try again."** There is no network and nothing kept on the phone yet for that file.
- **Going back.** Delete nothing in Storage. `git revert` the commit and send an update: the screen goes back to "Coming soon" and the files are not used.
