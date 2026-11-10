import Constants from 'expo-constants';

// The line that tells someone which version of the app they have ("ZOWN HQ v1.0.1"): the version in app.json, read from the build the
// phone is running, so it can never say a different number from the build (it used to be typed into two screens by hand).
export function appVersionLabel() {
  const version = Constants?.expoConfig?.version;
  return version ? `ZOWN HQ v${version}` : 'ZOWN HQ';
}
