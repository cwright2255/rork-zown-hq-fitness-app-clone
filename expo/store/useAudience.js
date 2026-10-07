// store/useAudience.js
//
// One hook for the Everyone / Following / Close Friends filter on a screen:
// loads who you follow, remembers the pick for that screen, and gives back
// the list of uids the pick covers (null means everyone).
import { useEffect, useMemo } from 'react';
import { useSocialGraphStore } from './socialGraphStore';
import { audienceUids } from '../lib/audience';

export function useAudience(surface, myUid) {
  const audience = useSocialGraphStore((s) => s.audience[surface]) || 'everyone';
  const setAudienceFor = useSocialGraphStore((s) => s.setAudience);
  const following = useSocialGraphStore((s) => s.following);
  const loadFollowing = useSocialGraphStore((s) => s.loadFollowing);

  useEffect(() => {
    if (myUid) loadFollowing(myUid);
  }, [myUid]);

  const uids = useMemo(() => audienceUids(audience, following), [audience, following]);
  const uidKey = uids === null ? 'all' : uids.join(',');

  return {
    audience,
    setAudience: (value) => setAudienceFor(surface, value),
    follows: following,
    uids,
    uidKey,
  };
}
