// lib/signInHeader.js
//
// The header that tells one of our own servers who is asking: the Firebase sign-in token of the person signed in now. It is for the two
// calls that go to a server of ours without Firebase's own SDK in between, the Instagram recipe import (the instagramEmbed function) and
// the 3D body mesh service, which check it and turn away a request that has none or a bad one.
//
// getIdToken() hands back the token the SDK already holds and renews it first when it is about to run out, so the network is needed only
// when a renewal is due. When that fails the error is thrown, so the caller's own error handling says the call failed, instead of sending
// a request the server is going to refuse. With nobody signed in there is no token to send: the result is {} and the server's 401 says so.
//
// Spread it into a request's headers: { 'Content-Type': 'application/json', ...(await signInHeader()) }.
//
// Firebase is loaded when first needed, as services/callProxy.js does it, so importing this file starts nothing.
export async function signInHeader() {
  const { auth } = require('../src/config/firebase');
  const user = auth && auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
