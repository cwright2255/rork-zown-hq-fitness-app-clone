import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import LoadingScreen, { ErrorBoundary } from '@/components/LoadingScreen';
import { authService } from '@/services/authService';

function IndexContent() {
  const { isOnboarded } = useUserStore();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('[Index] Checking authentication status');
        const authed = await authService.isAuthenticated();
        console.log('[Index] Authentication status:', authed);
        if (mounted) setIsAuthed(authed);
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
  }, []);

  if (isInitializing) {
    return <LoadingScreen message="Initializing..." />;
  }

  if (!isAuthed) {
    return <Redirect href="/start" />;
  }

  return <Redirect href={isOnboarded ? '/hq' : '/start'} />;
}

export default function Index() {
  return (
    <ErrorBoundary>
      <IndexContent />
    </ErrorBoundary>
  );
}