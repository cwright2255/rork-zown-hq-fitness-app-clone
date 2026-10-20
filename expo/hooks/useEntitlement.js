// hooks/useEntitlement.js
//
// The plan the person has, for a screen: { tier, plan, ready, can(feature) }. `ready` is true once the phone knows the plan, from the
// cloud or from the copy it kept, and after a few seconds regardless, so a screen that waits for it never waits for ever offline.
// Until then a Pro or Legend person would see the lock for a moment, so a gate shows nothing yet instead.
import { useEffect, useMemo, useState } from 'react';
import { useEntitlementStore } from '@/store/entitlementStore';
import { canUseFeature, effectiveTier } from '@/lib/entitlements';

export const WAIT_FOR_PLAN_MS = 4000;

export function useEntitlement() {
  const plan = useEntitlementStore((s) => s.plan);
  const isLoaded = useEntitlementStore((s) => s.isLoaded);
  const tier = useMemo(() => effectiveTier(plan), [plan]);
  const known = isLoaded || plan !== null;
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (known) return undefined;
    const timer = setTimeout(() => setGaveUp(true), WAIT_FOR_PLAN_MS);
    return () => clearTimeout(timer);
  }, [known]);

  return { tier, plan, ready: known || gaveUp, can: (feature) => canUseFeature(tier, feature) };
}
