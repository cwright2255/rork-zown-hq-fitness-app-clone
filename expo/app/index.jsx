import React, { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import { useUserStore } from '@/store/userStore';
import LoadingScreen from '@/components/LoadingScreen';
import { authService } from '@/services/authService';
import { spotifyService } from '@/services/spotifyService';
import { resolveLaunchSession } from '@/services/authGate';
import { fetchProfileComplete } from '@/services/profileStatus';
import { logOut } from '@/lib/logOut';
import { auth, isFirebaseConfigured } from '../src/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

// What shows for the moment the sign-in check takes, the same plain white as the phone's own launch screen (app.json, "splash"),
// so someone who is signed in goes from that to Home (also white) with nothing in between. The launch screen is part of the
// build, so these two have to change together, and with a new app version: __tests__/launchScreenColour.test.js keeps them equal.
const LAUNCH_BACKGROUND = '#FFFFFF';



function IndexContent() {
  const { isOnboarded, completeOnboarding } = useUserStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [uid, setUid] = useState(null);
  // For someone who is signed in but not marked as set up on this phone: what their saved profile says (null until it has been looked at).
  const [profile, setProfile] = useState(null); // null | 'complete' | 'incomplete' | 'unknown'
  const [handlingSpotify, setHandlingSpotify] = useState(false);
  const params = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const handleSpotifyCallback = async () => {
      const code = params.code || (Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('code') : null);
      const state = params.state || (Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('state') : null);

      if (code) {
        console.log('[Index] Spotify callback detected, processing...');
        setHandlingSpotify(true);
        try {
          const currentUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : `?code=${code}&state=${state}`;
          const success = await spotifyService.handleAuthorizationCodeCallback(currentUrl);
          console.log('[Index] Spotify auth result:', success);

          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.history.replaceState({}, document.title, window.location.pathname);
          }

          if (mounted) {
            router.replace('/profile/settings');
          }
          return true;
        } catch (error) {
          console.error('[Index] Spotify callback error:', error);
        } finally {
          if (mounted) setHandlingSpotify(false);
        }
      }
      return false;
    };

    (async () => {
      try {
        const wasSpotifyCallback = await handleSpotifyCallback();
        if (wasSpotifyCallback) return;

        console.log('[Index] Checking authentication status');
        // Firebase's own sign-in state decides (services/authGate.js): the gate waits for Firebase's first answer, and when Firebase
        // says nobody is signed in, whatever the phone saved from an earlier sign-in is cleared. The "keep me signed in" window
        // (Settings → Account) still applies to someone Firebase says is signed in.
        const session = await resolveLaunchSession({
          auth,
          isFirebaseConfigured,
          onAuthStateChanged,
          authService,
          endSession: logOut,
        });
        console.log('[Index] Authentication status:', session.authed, session.answer);
        if (mounted) {
          setIsAuthed(session.authed);
          setUid(session.uid);
        }
      } catch (e) {
        console.log('[Index] Auth check error:', e);
        if (mounted) setIsAuthed(false);
      } finally {
        if (mounted) {
          console.log('[Index] Initialization complete');
          setIsInitializing(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [params.code, params.state, router]);

  // Signed in, but this phone does not have them marked as set up (they quit onboarding part way, or the phone's saved state was
  // cleared): the saved profile says which. A finished profile goes Home; an unfinished one goes back to onboarding.
  const needsProfileCheck = !isInitializing && isAuthed && !isOnboarded && !handlingSpotify;
  useEffect(() => {
    if (!needsProfileCheck) return undefined;
    let mounted = true;
    (async () => {
      const finished = uid ? await fetchProfileComplete(uid) : null;
      if (!mounted) return;
      if (finished === true) {
        completeOnboarding();
        setProfile('complete');
      } else {
        setProfile(finished === false ? 'incomplete' : 'unknown');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [needsProfileCheck, uid, completeOnboarding]);

  if (handlingSpotify) {
    return <LoadingScreen message="Connecting Spotify..." />;
  }

  if (isInitializing) {
    return <View testID="launch-blank" style={{ flex: 1, backgroundColor: LAUNCH_BACKGROUND }} />;
  }

  // Signed in (and set up): straight to Home, with no splash. Everyone else goes to the login screen (/start sends them there),
  // which plays the launch splash (components/ZownGlitchSplash.jsx) over itself.
  if (!isAuthed) {
    return <Redirect href="/start" />;
  }

  if (isOnboarded) {
    return <Redirect href="/hq" />;
  }

  // Signed in but not marked as set up: wait for the saved profile's answer on the same black screen.
  if (profile === null) {
    return <View testID="launch-blank" style={{ flex: 1, backgroundColor: LAUNCH_BACKGROUND }} />;
  }
  if (profile === 'incomplete') {
    return <Redirect href="/onboarding" />;
  }
  if (profile === 'complete') {
    return <Redirect href="/hq" />;
  }
  // The profile could not be read: the login screen, as before.
  return <Redirect href="/start" />;
}

export default function Index() {
  return (
    
      <IndexContent />
    );

}