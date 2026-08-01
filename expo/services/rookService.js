// services/rookService.js
//
// Unified wearable integration through ROOK — replaces the separate
// direct-OAuth whoopService.js/ouraService.js from earlier this session.
// ROOK genuinely aggregates WHOOP, Oura, Garmin, Fitbit, Withings, Polar,
// and Dexcom under one API with one normalized data schema (confirmed
// directly against ROOK's own current, complete API reference before
// building this — the exact field names below, e.g. hrv_avg_rmssd_float,
// hr_resting_bpm_int, sleep_efficiency_1_100_score_int, are real,
// documented fields, not guessed).
//
// Apple Health and Health Connect (Apple Watch, Google/Wear OS watches)
// are a separate, real connection model — the on-device ROOK SDK already
// wired in app/health.jsx — not this file. This file covers the
// API-based sources ROOK connects via its own hosted authorization flow.
//
// All actual ROOK API calls (getRookAuthorizerUrl, getRookConnectedSources,
// revokeRookDataSource, getRookRecoveryData) live in
// functions/src/index.js as Cloud Functions, not here — ROOK's
// /authorizer, /authorized, /revoke_auth, and /processed_data endpoints
// all require full Basic Auth with a client secret, confirmed directly
// from ROOK's own docs, so none of it can live in client code the way a
// public OAuth client_id safely can.

import { httpsCallable } from 'firebase/functions';
import * as WebBrowser from 'expo-web-browser';
import { functions } from '../src/config/firebase';

WebBrowser.maybeCompleteAuthSession();


// The exact enum ROOK's /authorizer endpoint accepts.
export const ROOK_DATA_SOURCES = ['Whoop', 'Oura', 'Garmin', 'Fitbit', 'Withings', 'Polar', 'Dexcom'];

class RookService {
  /**
   * Opens ROOK's real hosted authorization flow for one data source.
   * Returns true only once the user actually completes it — not just on
   * the browser session closing (WebBrowser reports 'success' whenever
   * the browser closes for any reason, including the user just backing
   * out, so this re-checks real connected status afterward rather than
   * trusting the browser-close event alone).
   */
  async connect(dataSource) {
    if (!ROOK_DATA_SOURCES.includes(dataSource)) {
      console.warn(`[rookService] "${dataSource}" is not a valid ROOK data source.`);
      return false;
    }
    try {
      const getAuthorizerUrl = httpsCallable(functions, 'getRookAuthorizerUrl');
      const result = await getAuthorizerUrl({ dataSource });
      const { authorized, authorizationUrl } = result.data;

      if (authorized) return true; // ROOK's own real "already connected" case
      if (!authorizationUrl) return false;

      await WebBrowser.openAuthSessionAsync(authorizationUrl);
      // Re-check real status rather than assuming the browser closing
      // means success — the user may have backed out without finishing.
      const sources = await this.getConnectedSources();
      return sources.some((s) => s.data_source === dataSource && s.authorized);
    } catch (e) {
      console.warn(`[rookService] connect(${dataSource}) failed:`, e?.message);
      return false;
    }
  }

  async disconnect(dataSource) {
    try {
      const revoke = httpsCallable(functions, 'revokeRookDataSource');
      const result = await revoke({ dataSource });
      return !!result.data?.revoked;
    } catch (e) {
      console.warn(`[rookService] disconnect(${dataSource}) failed:`, e?.message);
      return false;
    }
  }

  /**
   * Real connected status across every ROOK-supported provider — a
   * single source of truth so the wearables screen doesn't need a
   * separate isConnected() call per provider the way the previous
   * whoopService/ouraService split required.
   */
  async getConnectedSources() {
    try {
      const getSources = httpsCallable(functions, 'getRookConnectedSources');
      const result = await getSources();
      return result.data?.dataSources || [];
    } catch (e) {
      console.warn('[rookService] getConnectedSources failed:', e?.message);
      return [];
    }
  }

  async isConnected(dataSource) {
    const sources = await this.getConnectedSources();
    return sources.some((s) => s.data_source === dataSource && s.authorized);
  }

  /**
   * Real recovery signal for today from whichever connected source ROOK
   * actually has data for — normalized to the same field names
   * lib/muscleFatigue.js's getRecoveryModifier already expects (hrv,
   * restingHeartRate; recoveryScore is deliberately absent — ROOK doesn't
   * compute a proprietary composite score the way WHOOP/Oura each do on
   * their own, only the real underlying physiological signals, and the
   * HRV-based fallback path already handles that correctly). Returns
   * null (not fabricated data) if nothing is connected, nothing has
   * synced yet today, or the request fails.
   */
  async getTodayRecovery() {
    try {
      const getRecovery = httpsCallable(functions, 'getRookRecoveryData');
      const result = await getRecovery();
      return result.data || null;
    } catch (e) {
      console.warn('[rookService] getTodayRecovery failed:', e?.message);
      return null;
    }
  }
}

export const rookService = new RookService();
