// lib/tryOn/latestScan.js
//
// The latest body scan the phone knows about for the signed-in person (loads their scans first if none are in memory yet), or null.
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { useUserStore } from '@/store/userStore';

export async function latestScan() {
  try {
    let state = useBodyCompositionStore.getState();
    if (state.scans.length === 0) {
      const uid = useUserStore.getState().user?.uid;
      if (uid) {
        await state.loadScans(uid);
        state = useBodyCompositionStore.getState();
      }
    }
    return state.scans[state.scans.length - 1] || null;
  } catch (e) {
    return null;
  }
}
