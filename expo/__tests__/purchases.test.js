// Buying a plan (services/purchases.js). Stage 1 has no store connection: this says so, and the plans screen shows "Coming soon".
// When RevenueCat is connected these change, and so should this.
import { PURCHASES_ENABLED, purchasePlan } from '../services/purchases';

describe('buying a plan before the store is connected', () => {
  it('is switched off', () => {
    expect(PURCHASES_ENABLED).toBe(false);
  });

  it('buys nothing, and says subscriptions are not open yet', async () => {
    expect(await purchasePlan('pro')).toEqual({ ok: false, error: 'Subscriptions are not open yet.' });
    expect(await purchasePlan('legend')).toEqual({ ok: false, error: 'Subscriptions are not open yet.' });
  });
});
