// The evening nutrition tests set the clock to 9:30 PM in New Jersey, which is
// already the next day in UTC. jest.global-setup.js pins the zone so that holds
// on a machine that runs in UTC. If this fails, the pin is missing, and the
// "local day" tests will fail with it.
describe('test time zone', () => {
  it('is New Jersey time, so 9:30 PM there is still the same calendar day', () => {
    const nineThirtyPm = new Date('2026-10-09T01:30:00Z');
    expect(nineThirtyPm.getHours()).toBe(21);
    expect(nineThirtyPm.getDate()).toBe(8);
  });
});
