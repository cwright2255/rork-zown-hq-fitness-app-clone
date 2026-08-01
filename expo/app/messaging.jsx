// app/messaging.jsx
//
// This used to be a third, fully independent messaging implementation —
// its own hardcoded conversation list and thread view, completely separate
// from app/messages.jsx + app/messages/[id].jsx (which had their own,
// different fake data) and now completely separate from the real
// messaging system built on store/messagingStore.js.
//
// Rather than maintain three parallel implementations (real or not),
// this route now simply redirects to the real one. If anything in the
// app still links to /messaging directly, it lands in the same place as
// /messages.

import { Redirect } from 'expo-router';

export default function MessagingRedirect() {
  return <Redirect href="/messages" />;
}
