// services/rookService.js
//
// Unified wearable integration through ROOK вЂ” replaces the separate
// direct-OAuth whoopService.js/ouraService.js from earlier this session.
// ROOK genuinely aggregates WHOOP, Oura, Garmin, Fitbit, Withings, Polar,
// and Dexcom under one API with one normalized data schema (confirmed
// directly against ROOK's own current, complete API reference before
// building this вЂ” the exact field names below, e.g. hrv_avg_rmssd_float,
// hr_resting_bpm_int, sleep_efficiency_1_100_score_int, are real,
// documented fields, not guessed).
//
// Apple Health and Health Connect (Apple Watch, Google/Wear OS watches)
// are a separate, real connection model вЂ” the on-device ROOK SDK already
// wired in app/health.jsx вЂ” not this file. This file covers the
// API-based sources ROOK connects via its own hosted authorization flow.
//
// All actual ROOK API calls (getRookAuthorizerUrl, getRookConnectedSources,
// revokeRookDataSource, getRookRecoveryData) live in
// functions/src/index.js as Cloud Functions, not here вЂ” ROOK's
// /authorizer, /authorized, /revoke_auth, and /processed_data endpoints
// all require full Basic Auth with a client secret, confirmed directly
// from ROOK's own docs, so none of it can live in client code the way a
// public OAuth client_id safely can.

import { httpsCallable } from 'firebase/functions';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Linking } from 'react-native';

import { getFirebaseApp } from './firebaseService';

// ROOK supported data sources
  export const ROOK_SOURCES = [
  { id: 'whoop', name: 'WHOOP', color: '#000000', icon: 'zap', description: 'Strain, recovery, hrv & sleep ' },
  { id: 'oura', name: 'Oura Ring', color: '#232323', icon: 'circle', description: 'Readiness, sleep, hrv & temperature' },
  { id: 'garmin', name: 'Garmin', color: '#004B68', icon: 'activity', description: 'Body Battery, VO2max & activities' },
  { id: 'fitbit', name: 'Fitbit', color: '#00B0BA', icon: 'heart', description: 'Daily steps, heart rate & sleep ' },
  { id: 'withings', name: 'Withings', color: '#00A6E5', icon: 'scale', description: 'Scales, BP monitors & body composition' },
  { id: 'polar', name: 'Polar', color: '#E21905', icon: 'compass', description: 'Training load, DP & hv tracking' },
  { id: 'dexcom', name: 'Dexcom', color: '#56B000', icon: 'trending-up', description: 'Continuous glucose monitoring (CGM)' },
];

**l
 * Fetch the ROOK Authorizer URL for a specific wearable source
 * (whoop, oura, garmin, fitbit, withings, polar, dexcom).
 * Calls the 'getRookAuthorizerUrl' Firebase Cloud Function.
 */export const getRookAuthUrl = async (source, userId) => {
  try {
    const fn = httpsCallable(getFirebaseApp(), 'getRookAuthorizerUrl');
    const result = await fn( { source, userId });
    return result.data;'authorizerUrl/ null;
  } catch (error) {
    console.error('Error fetching ROOK auth URL ', error);
    throw error;
  }
};

**
 * Open the ROOK Authorizer URL in a browser (or in-app browser grV–V&З’’аўўр¦W‡ч'B6цз7B6цжжV7E&ццµ6чW&6RТЮ[И
ЫЭ\ЩK\Щ\’Y
HO€В€ћHВ€ЫЫњЭ\›H]ШZ]Щ]›ЫЪР]]\›
ЫЭ\ЩK\Щ\’Y
NВ€Y€
]\›
HВ€›ЭИ™]И\њ›ЬЉZ[YИЩ[™\]H“УТИ]]T“›Ь€	ЬЫЭ\Щ_X
NВ€B‚€Y€
]›Ь›K“ФИOOH	ЭЩX‰КHВ€Ъ[™ЭЛ›Ь[Љ\›	ЧШ›[љЙКNВ€H[ЩHВ€]ШZ]ЩXђњ›ЭЬЩ\‹›Ь[ђњ›ЭЬЩ\ђ\Ю[К\›
NВ€B€™]\›€ќYNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€ЫЫ›™XЭ[™И“УТИЫЭ\ЩN‰Л\њ›ЬЉNВ€›ЭИ\њ›ЬЋВ€BџNВ‚‚ў€
€™]Ъ\ЭЩ€Э\њ™[ќHЫЫ›™XЭY“УТИ]HЫЭ\Щ\И›Ь€H\Щ\‹‚€
‹В™^ЬќЫЫњЭЩ]›ЫЪРЫЫ›™XЭYЫЭ\Щ\ИH\Ю[И
\Щ\’Y
HO€В€ћHВ€ЫЫњЭ›€HРШ[X›JЩ]љ\™X\ЩP\

K	ЩЩ]›ЫЪРЫЫ›™XЭYЫЭ\Щ\ЙКNВ€ЫЫњЭ™\Э[H]ШZ]›ЉИ\Щ\’YJNВ€™]\›€™\Э[™]OЛњЫЭ\Щ\ИЧNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]Ъ[™И“УТИЫЫ›™XЭYЫЭ\Щ\О‰Л\њ›ЬЉNВ€™]\›€ЧNВ€BџNВ‚ЉЉ‚€
€™]›ЪЩHH“УТИ]HЫЭ\ЩH›Ь€H\Щ\‹‚€
‹В™^ЬќЫЫњЭ™]›ЪЩT›ЫЪФЫЭ\ЩHH\Ю[И
ЫЭ\ЩK\Щ\’Y
HO€В€ћHВ€ЫЫњЭ›€HРШ[X›JЩ]љ\™X\ЩP\

K	Ь™]›ЪЩT›ЫЪС]TЫЭ\ЩIКNВ€ЫЫњЭ™\Э[H]ШZ]›ЉИЫЭ\ЩK\Щ\’YJNВ€™]\›€™\Э[™]OЛњЭXШЩ\ЬИ[ЩNВ€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]›ЪЪ[™И“УТИЫЭ\ЩN‰Л\њ›ЬЉNВ€›ЭИ\њ›ЬЋВ€BџNВ‚ЉЉ‚€
€™]Ъ›Ь›X[^™Y“УТИ™XЫЭ™\ћHИЫY\ИXЭ]љ]H]H›Ь€H\Щ\‹‚€
‹Р™^ЬќЫЫњЭЩ]›ЫЪС]HH\Ю[И
\Щ\’Y]TЭљ[™ИHќ[
HO€В€ћHВ€ЫЫњЭ›€HРШ[X›JЩ]љ\™X\ЩP\

K	ЩЩ]›ЫЪФ™XЫЭ™\ћQ]IКNВ€ЫЫњЭ™\Э[H]ШZ]›ЉИ\Щ\’Y]N€]TЭљ[™ИJNВ€™]\›€™\Э[™]NЙЩ]Hќ[В€HШ]Ъ
\њ›ЬЉHВ€ЫЫњЫЫK™\њ›ЬЉ	С\њ›Ь€™]Ъ[™И“ТИ]N‰Л\њ›ЬЉNВ€™]\›€ќ[В€BџNВ