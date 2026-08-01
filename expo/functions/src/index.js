import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

const rookSecret = defineSecret('ROOK_SECRET_KEY');
const rookClientUuid = defineSecret('ROOK_CLIENT_UUID');

export const getRookSdkCredentials = onCall(
  { secrets: [rookSecret, rookClientUuid] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to access ROOK credentials.');
    }

    const secretKey = rookSecret.value();
    const clientUUID = rookClientUuid.value();

    if (!secretKey || !clientUUID) {
      throw new HttpsError('failed-precondition', 'ROOK credentials are not configured on server.');
    }

    return {
      clientUUID,
      secretKey,
    };
  }
);
