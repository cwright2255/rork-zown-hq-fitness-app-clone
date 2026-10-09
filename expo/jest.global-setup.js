// Pins the time zone for every test run.
//
// Several nutrition tests set the clock to 9:30 PM in New Jersey, a moment when
// the UTC date has already turned over, and check that the diary uses the local
// day. They only mean something in a zone behind UTC, and a Codespace or a CI
// machine runs in UTC, so the zone is set here instead of left to the machine.
module.exports = async () => {
  process.env.TZ = 'America/New_York';
};
