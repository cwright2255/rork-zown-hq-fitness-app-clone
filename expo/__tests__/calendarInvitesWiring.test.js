// Calendar invitations reach the person through one listener that the root layout starts at sign-in and stops at sign-out, so the
// Calendar and the Next Up card on Home have them the moment the app opens, and the next person to sign in on the phone never sees them.
// This reads the root layout's source because the layout itself needs the whole app around it to render.
const fs = require('fs');
const path = require('path');

const layout = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.jsx'), 'utf8');
const authBlock = layout.slice(layout.indexOf('onAuthStateChanged(auth'));

describe('root layout and calendar invitations', () => {
  it('gets the invite store', () => {
    expect(layout).toMatch(/import \{ useCalendarInviteStore \} from '@\/store\/calendarInviteStore';/);
  });

  it('starts listening for the signed-in person, once the calendar itself is syncing', () => {
    expect(authBlock).toMatch(/useScheduleStore\.getState\(\)\.startSync\(uid\)[^\n]*\n[^\n]*\n\s*useCalendarInviteStore\.getState\(\)\.subscribe\(uid\);/);
  });

  it('does that only for a signed-in person: it is the last step of the signed-in branch', () => {
    expect(authBlock).toMatch(/useCalendarInviteStore\.getState\(\)\.subscribe\(uid\);\s*\} else \{/);
  });

  it('stops listening, and forgets the invites, when nobody is signed in', () => {
    expect(authBlock).toMatch(/\} else \{\s*stopXpSync\(\);\s*useEntitlementStore\.getState\(\)\.stopListening\(\);\s*useCalendarInviteStore\.getState\(\)\.unsubscribe\(\);\s*\}/);
  });
});
