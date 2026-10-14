// hooks/useTrailPhoto.js
//
// The picture for a trail card or page. A trail from the trail service comes with its
// picture's address (trail.photoUrl). A trail from Google Places comes with the photo's
// name (trail.photoName), which the cloud functions turn into an address
// (services/hikingService.js, getPhotoUri); that takes a moment, and until it arrives
// (or if there is no photo) this gives null so the screen shows its placeholder.
import { useEffect, useState } from 'react';
import { getPhotoUri, peekPhotoUri } from '@/services/hikingService';

/**
 * @param trail      a trail record, or null
 * @param maxWidthPx how wide the picture is shown, in pixels
 * @returns the picture's address, or null
 */
export function useTrailPhoto(trail, maxWidthPx) {
  const direct = trail && trail.photoUrl ? trail.photoUrl : null;
  const name = !direct && trail && trail.photoName ? trail.photoName : null;
  const [resolved, setResolved] = useState(() => (name ? peekPhotoUri(name, maxWidthPx) : null));

  useEffect(() => {
    if (!name) {
      setResolved(null);
      return undefined;
    }
    const known = peekPhotoUri(name, maxWidthPx);
    setResolved(known);
    if (known) return undefined;
    let live = true;
    getPhotoUri(name, maxWidthPx).then((uri) => {
      if (live) setResolved(uri);
    });
    return () => { live = false; };
  }, [name, maxWidthPx]);

  return direct || resolved;
}
