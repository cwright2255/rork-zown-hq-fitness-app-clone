// Who is calling one of our plain web-address functions (the ones made with onRequest, which unlike onCall do not check sign-in for us):
// the person's Firebase sign-in token, sent by the app in the Authorization header as "Bearer <token>". The token is checked with the
// function that is passed in (index.js passes getAuth().verifyIdToken), so this is tested without Firebase.
//
// Pure, never throws: any problem with the header or the token means "nobody", and the caller answers 401.

// A Firebase sign-in token is a little over a thousand characters. Anything much longer is not one, and is not worth checking.
const MAX_TOKEN_LENGTH = 4096;

/** The token in the request's "Authorization: Bearer <token>" header, or null when there is none (or it is not a Bearer header). */
export function bearerToken(req) {
  const header = req && req.headers ? req.headers.authorization : null;
  if (typeof header !== 'string') return null;
  const match = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
  if (!match || match[1].length > MAX_TOKEN_LENGTH) return null;
  return match[1];
}

/**
 * The id of the person who sent the request, or null when the request has no token or the token is not good (not signed by Firebase for
 * this project, run out, or made up). `verify` is called with the token and resolves to the decoded token, { uid, ... }.
 */
export async function signedInUid(req, verify) {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    const decoded = await verify(token);
    return decoded && typeof decoded.uid === 'string' && decoded.uid.length > 0 ? decoded.uid : null;
  } catch {
    return null;
  }
}
