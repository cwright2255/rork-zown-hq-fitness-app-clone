// Calendar invites: a copy of one of a person's calendar events, offered to one other person (lib/calendarInvites.js). Only the two
// people can see it, the sender can only invite someone they follow, only the person invited can accept or decline, only the sender can
// cancel, all of it only while the invite is waiting, and what an invite says cannot be changed once it is sent.
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

// alice invites bob. She follows him (a follow document holds the name and picture of the person followed).
const follow = (name) => ({ name, avatar: null, close: false, followedAt: '2026-10-01T12:00:00.000Z' });
const alicefollowsBob = () => ({ 'users/alice/following/bob': follow('Bob') });

const invite = (over = {}) => ({
  participantIds: ['alice', 'bob'],
  fromUid: 'alice',
  toUid: 'bob',
  fromName: 'Alice',
  toName: 'Bob',
  status: 'pending',
  eventId: 'evt-1',
  title: 'Leg day',
  kind: 'workout',
  start: '2026-10-22T11:00:00.000Z',
  notes: 'Heavy squats',
  repeat: null,
  createdAt: '2026-10-20T12:00:00.000Z',
  ...over,
});
const without = (key) => { const d = invite(); delete d[key]; return d; };
const answer = (status) => ({ status, respondedAt: '2026-10-20T13:00:00.000Z' });

describe('/calendarInvites/{inviteId}', () => {
  it('can be read by the two people in it, not by anyone else', async () => {
    await env.seed({ 'calendarInvites/i1': invite() });
    await ok(env.as('alice').doc('calendarInvites/i1').get());
    await ok(env.as('bob').doc('calendarInvites/i1').get());
    await no(env.as('carol').doc('calendarInvites/i1').get());
    await no(env.anon().doc('calendarInvites/i1').get());
  });

  it('lists only the invites the person is in', async () => {
    await env.seed({ 'calendarInvites/i1': invite() });
    await ok(env.as('alice').collection('calendarInvites').where('participantIds', 'array-contains', 'alice').get());
    await ok(env.as('bob').collection('calendarInvites').where('participantIds', 'array-contains', 'bob').get());
    await no(env.as('carol').collection('calendarInvites').where('participantIds', 'array-contains', 'alice').get());
    await no(env.as('alice').collection('calendarInvites').get());
    await no(env.anon().collection('calendarInvites').where('participantIds', 'array-contains', 'alice').get());
  });

  describe('sending one', () => {
    beforeEach(() => env.seed(alicefollowsBob()));

    it('is allowed for someone the sender follows, as a pending invite from themselves', async () => {
      await ok(env.as('alice').doc('calendarInvites/i1').set(invite()));
    });

    it('is allowed for a repeating event, and for one with no notes', async () => {
      await ok(env.as('alice').doc('calendarInvites/i1').set(invite({ repeat: { every: 'week', days: [4], until: null } })));
      await ok(env.as('alice').doc('calendarInvites/i2').set(invite({ notes: '' })));
    });

    it('is refused when the sender does not follow the person', async () => {
      await no(env.as('alice').doc('calendarInvites/i1').set(invite({ toUid: 'carol', participantIds: ['alice', 'carol'], toName: 'Carol' })));
    });

    it('is refused when the person follows the sender but the sender does not follow them back', async () => {
      await no(env.as('bob').doc('calendarInvites/i1').set(invite({
        fromUid: 'bob', toUid: 'carol', participantIds: ['bob', 'carol'], fromName: 'Bob', toName: 'Carol',
      })));
      await env.seed({ 'users/carol/following/alice': follow('Alice') });
      await no(env.as('alice').doc('calendarInvites/i2').set(invite({ toUid: 'carol', participantIds: ['alice', 'carol'], toName: 'Carol' })));
    });

    it('is refused for anyone but the person it says it is from, and for a visitor', async () => {
      await no(env.as('bob').doc('calendarInvites/i1').set(invite()));
      await no(env.as('carol').doc('calendarInvites/i2').set(invite()));
      await no(env.anon().doc('calendarInvites/i3').set(invite()));
    });

    it('is refused to oneself', async () => {
      await env.seed({ 'users/alice/following/alice': follow('Alice') });
      await no(env.as('alice').doc('calendarInvites/i1').set(invite({ toUid: 'alice', participantIds: ['alice', 'alice'], toName: 'Alice' })));
    });

    it('is refused unless the list of people is exactly the sender and the person invited', async () => {
      await no(env.as('alice').doc('calendarInvites/i1').set(invite({ participantIds: ['alice'] })));
      await no(env.as('alice').doc('calendarInvites/i2').set(invite({ participantIds: ['alice', 'bob', 'carol'] })));
      await no(env.as('alice').doc('calendarInvites/i3').set(invite({ participantIds: ['alice', 'carol'] })));
      await no(env.as('alice').doc('calendarInvites/i4').set(invite({ participantIds: ['carol', 'bob'] })));
      await no(env.as('alice').doc('calendarInvites/i5').set(invite({ participantIds: 'alice,bob' })));
    });

    it('is refused if it starts as anything but pending', async () => {
      for (const status of ['accepted', 'declined', 'cancelled', 'active', '']) {
        await no(env.as('alice').doc('calendarInvites/i1').set(invite({ status })));
      }
    });

    it('is refused when a field is missing, or one that does not belong is added', async () => {
      for (const key of Object.keys(invite())) await no(env.as('alice').doc('calendarInvites/i1').set(without(key)));
      await no(env.as('alice').doc('calendarInvites/i2').set(invite({ respondedAt: '2026-10-20T13:00:00.000Z' })));
      await no(env.as('alice').doc('calendarInvites/i3').set(invite({ approved: true })));
    });

    it('is refused for a title that is empty or longer than 80 characters', async () => {
      await ok(env.as('alice').doc('calendarInvites/i1').set(invite({ title: 'x'.repeat(80) })));
      await no(env.as('alice').doc('calendarInvites/i2').set(invite({ title: 'x'.repeat(81) })));
      await no(env.as('alice').doc('calendarInvites/i3').set(invite({ title: '' })));
      await no(env.as('alice').doc('calendarInvites/i4').set(invite({ title: 5 })));
    });

    it('is refused for notes longer than 500 characters', async () => {
      await ok(env.as('alice').doc('calendarInvites/i1').set(invite({ notes: 'n'.repeat(500) })));
      await no(env.as('alice').doc('calendarInvites/i2').set(invite({ notes: 'n'.repeat(501) })));
    });

    it('is refused for a kind the calendar does not have', async () => {
      for (const kind of ['workout', 'run', 'nutrition', 'other']) {
        await ok(env.as('alice').doc(`calendarInvites/${kind}`).set(invite({ kind })));
      }
      await no(env.as('alice').doc('calendarInvites/bad1').set(invite({ kind: 'party' })));
      await no(env.as('alice').doc('calendarInvites/bad2').set(invite({ kind: null })));
    });

    it('is refused for names that are too long or not text', async () => {
      await ok(env.as('alice').doc('calendarInvites/i1').set(invite({ fromName: 'a'.repeat(60), toName: 'b'.repeat(60) })));
      await no(env.as('alice').doc('calendarInvites/i2').set(invite({ fromName: 'a'.repeat(61) })));
      await no(env.as('alice').doc('calendarInvites/i3').set(invite({ toName: 'b'.repeat(61) })));
      await no(env.as('alice').doc('calendarInvites/i4').set(invite({ toName: 7 })));
    });

    it('is refused for a start, an event id or a time stamp that is not text, or is far too long', async () => {
      await no(env.as('alice').doc('calendarInvites/i1').set(invite({ start: 1792000000000 })));
      await no(env.as('alice').doc('calendarInvites/i2').set(invite({ start: 'x'.repeat(41) })));
      await no(env.as('alice').doc('calendarInvites/i3').set(invite({ eventId: 'e'.repeat(121) })));
      await no(env.as('alice').doc('calendarInvites/i4').set(invite({ eventId: 12 })));
      await no(env.as('alice').doc('calendarInvites/i5').set(invite({ createdAt: 'y'.repeat(41) })));
    });

    it('is refused when the repeat is anything but nothing or a map', async () => {
      await no(env.as('alice').doc('calendarInvites/i1').set(invite({ repeat: 'weekly' })));
      await no(env.as('alice').doc('calendarInvites/i2').set(invite({ repeat: ['week'] })));
      await no(env.as('alice').doc('calendarInvites/i3').set(invite({ repeat: 7 })));
    });
  });

  describe('answering one', () => {
    beforeEach(() => env.seed({ 'calendarInvites/i1': invite() }));

    it('lets the person invited accept it', async () => {
      await ok(env.as('bob').doc('calendarInvites/i1').update(answer('accepted')));
    });

    it('lets the person invited decline it', async () => {
      await ok(env.as('bob').doc('calendarInvites/i1').update(answer('declined')));
    });

    it('lets the sender cancel it', async () => {
      await ok(env.as('alice').doc('calendarInvites/i1').update(answer('cancelled')));
    });

    it('does not let the sender accept or decline their own invite', async () => {
      await no(env.as('alice').doc('calendarInvites/i1').update(answer('accepted')));
      await no(env.as('alice').doc('calendarInvites/i1').update(answer('declined')));
    });

    it('does not let the person invited cancel it', async () => {
      await no(env.as('bob').doc('calendarInvites/i1').update(answer('cancelled')));
    });

    it('needs the time of the answer, as text', async () => {
      await no(env.as('bob').doc('calendarInvites/i1').update({ status: 'accepted' }));
      await no(env.as('bob').doc('calendarInvites/i1').update({ status: 'accepted', respondedAt: 12345 }));
      await no(env.as('bob').doc('calendarInvites/i1').update({ status: 'accepted', respondedAt: 'z'.repeat(41) }));
    });

    it('refuses any other status', async () => {
      for (const status of ['pending', 'active', 'completed', 'going', '']) {
        await no(env.as('bob').doc('calendarInvites/i1').update({ status, respondedAt: '2026-10-20T13:00:00.000Z' }));
      }
    });

    it('refuses changing anything but the status and the time of the answer', async () => {
      const t = '2026-10-20T13:00:00.000Z';
      await no(env.as('bob').doc('calendarInvites/i1').update({ status: 'accepted', respondedAt: t, title: 'Easy day' }));
      await no(env.as('bob').doc('calendarInvites/i1').update({ status: 'accepted', respondedAt: t, start: '2026-10-30T11:00:00.000Z' }));
      await no(env.as('bob').doc('calendarInvites/i1').update({ status: 'accepted', respondedAt: t, toUid: 'carol' }));
      await no(env.as('bob').doc('calendarInvites/i1').update({ status: 'accepted', respondedAt: t, participantIds: ['bob', 'carol'] }));
      await no(env.as('alice').doc('calendarInvites/i1').update({ status: 'cancelled', respondedAt: t, notes: 'changed' }));
      await no(env.as('alice').doc('calendarInvites/i1').update({ title: 'Changed after sending' }));
      await no(env.as('alice').doc('calendarInvites/i1').update({ fromUid: 'bob' }));
    });

    it('refuses someone who is not in it, and a visitor', async () => {
      await no(env.as('carol').doc('calendarInvites/i1').update(answer('accepted')));
      await no(env.as('carol').doc('calendarInvites/i1').update(answer('cancelled')));
      await no(env.anon().doc('calendarInvites/i1').update(answer('accepted')));
    });

    it('refuses once it has been answered, either way and by anyone', async () => {
      await env.seed({
        'calendarInvites/yes': invite({ status: 'accepted', respondedAt: '2026-10-20T13:00:00.000Z' }),
        'calendarInvites/no': invite({ status: 'declined', respondedAt: '2026-10-20T13:00:00.000Z' }),
        'calendarInvites/off': invite({ status: 'cancelled', respondedAt: '2026-10-20T13:00:00.000Z' }),
      });
      await no(env.as('bob').doc('calendarInvites/yes').update(answer('declined')));
      await no(env.as('alice').doc('calendarInvites/yes').update(answer('cancelled')));
      await no(env.as('bob').doc('calendarInvites/no').update(answer('accepted')));
      await no(env.as('bob').doc('calendarInvites/off').update(answer('accepted')));
      await no(env.as('alice').doc('calendarInvites/off').update(answer('cancelled')));
    });
  });

  it('can never be deleted', async () => {
    await env.seed({ 'calendarInvites/i1': invite(), 'calendarInvites/i2': invite({ status: 'accepted', respondedAt: '2026-10-20T13:00:00.000Z' }) });
    await no(env.as('alice').doc('calendarInvites/i1').delete());
    await no(env.as('bob').doc('calendarInvites/i1').delete());
    await no(env.as('alice').doc('calendarInvites/i2').delete());
    await no(env.as('bob').doc('calendarInvites/i2').delete());
    await no(env.anon().doc('calendarInvites/i1').delete());
  });
});
