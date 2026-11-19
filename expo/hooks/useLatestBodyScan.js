// hooks/useLatestBodyScan.js
//
// The person's latest body scan, for the 3D heat figure (components/MuscleHeatmapCard.jsx). Loads their scans when the screen opens and
// hands back the newest, or null while they load or when there is none, which is the figure's own "no scan yet" state. `retry` loads them
// again. The trail preview (app/running/hiking/[id].jsx) does the same inline.
import { useEffect } from 'react';
import { useUserStore } from '@/store/userStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';

export function useLatestBodyScan() {
  const { user } = useUserStore();
  const { scans, loadScans } = useBodyCompositionStore();

  useEffect(() => {
    if (user?.uid) loadScans(user.uid);
  }, [user?.uid]);

  const scan = scans && scans.length ? scans[scans.length - 1] : null;
  const retry = () => { if (user?.uid) loadScans(user.uid); };
  return { scan, retry };
}
