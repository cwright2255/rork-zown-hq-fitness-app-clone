// The day getRookRecoveryData (index.js) asks ROOK about. The app sends the person's own calendar day
// ("2026-10-14"), because a server clock runs on UTC: from about 8 PM in New Jersey the UTC date is already
// tomorrow, ROOK has nothing for it, and recovery went blank every evening.
//
// A calendar day anywhere on Earth is within one day of the UTC date, so anything else (or anything that is not
// a real date) is ignored and the UTC date is used, which is what older versions of the app always got.
export function recoveryDay(input, now = new Date()) {
  const utc = now.toISOString().slice(0, 10);
  if (typeof input !== 'string') return utc;
  const t = Date.parse(`${input}T00:00:00Z`);
  // Only a real YYYY-MM-DD survives this: the date read back must be exactly what was sent ("2026-02-30" reads
  // back as 2 March, and anything with extra characters fails to read at all).
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== input) return utc;
  const apart = Math.abs(t - Date.parse(`${utc}T00:00:00Z`)) / 86400000;
  return apart <= 1 ? input : utc;
}
