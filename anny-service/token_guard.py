"""Who is asking the mesh service.

A body mesh costs real money to make (each running copy holds 4 GiB and 2 CPUs), so the service makes one only for a signed-in person.
The app sends the person's Firebase sign-in token in the Authorization header ("Bearer <token>"). Cloud Run's own front door cannot
check that kind of token (it knows Google service accounts, not Firebase users), so the service is deployed open to the network
(--allow-unauthenticated, see the README) and checks the token itself, here, before it does any work.

A token is good when Google signed it for this Firebase project: signed with one of Google's published signing keys, made for this
project (audience and issuer), not run out, and naming a person. That is the check Firebase documents for a server that does not use
its Admin SDK (https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library).

This file imports nothing heavy (no torch, no Anny), so it is tested on its own: test_token_guard.py.
"""

import json
import logging
import os
import re
import threading
import time
import urllib.request
from typing import Callable, Mapping, Optional

from fastapi import Header, HTTPException
from google.auth import jwt as google_jwt

logger = logging.getLogger("anny-service")

# The Firebase project the tokens must be made for. Overridable for another project, but the default is this app's.
PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "zown-3c512")

# Google's public signing certificates for Firebase sign-in tokens: a JSON object of key id -> certificate.
CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"

# A Firebase sign-in token is a little over a thousand characters. Anything much longer is not one, and is not worth reading.
MAX_TOKEN_LENGTH = 4096
# How far a token's issued-at and expiry may be off from this machine's clock. The library accepts at most 60.
CLOCK_SKEW_SECONDS = 10

# Google rotates the signing keys every few days and publishes a new one well before it signs with it, so keeping the list for an
# hour is safe. A token signed with a key that is not on the list (a rotation just happened, or a made-up key id) makes the service
# look again, but never more than once a minute, so a stranger sending made-up key ids cannot make it ask Google over and over.
CERTS_MAX_AGE_SECONDS = 3600
CERTS_MIN_REFETCH_SECONDS = 60
# After a failed fetch, try again soon rather than a minute from now.
CERTS_RETRY_AFTER_FAILURE_SECONDS = 5

# What the caller is told. The reason a token was refused goes to the log (without the token), never into the answer.
SIGN_IN_MESSAGE = "Sign in to build the 3D body."
TRY_AGAIN_MESSAGE = "Could not check your sign-in just now. Try again in a moment."

_BEARER = re.compile(r"^Bearer[ \t]+(\S+)$", re.IGNORECASE)


class InvalidToken(Exception):
    """The token is not a good Firebase sign-in token for this project. The message is a short reason for the log."""


class CertsUnavailable(Exception):
    """Google's signing certificates could not be fetched, and none are kept from an earlier fetch."""


def fetch_certs() -> Mapping[str, str]:
    """Google's current signing certificates, as { key id: certificate in PEM form }."""
    with urllib.request.urlopen(CERTS_URL, timeout=5) as response:  # nosec: a fixed https address
        body = response.read(65536)
    certs = json.loads(body)
    if not isinstance(certs, dict) or not certs:
        raise ValueError("the answer holds no certificates")
    return certs


class CertCache:
    """Keeps Google's signing certificates between requests (see the notes above on how long, and how often it looks again)."""

    def __init__(
        self,
        fetch: Callable[[], Mapping[str, str]] = fetch_certs,
        clock: Callable[[], float] = time.monotonic,
        max_age: float = CERTS_MAX_AGE_SECONDS,
        min_refetch: float = CERTS_MIN_REFETCH_SECONDS,
        retry_after_failure: float = CERTS_RETRY_AFTER_FAILURE_SECONDS,
    ):
        self._fetch = fetch
        self._clock = clock
        self._max_age = max_age
        self._min_refetch = min_refetch
        self._retry_after_failure = retry_after_failure
        self._lock = threading.Lock()
        self._certs: Optional[Mapping[str, str]] = None
        self._expires = 0.0
        self._next_try = 0.0

    def certs_for(self, key_id: str) -> Mapping[str, str]:
        """The certificates to check a token signed with `key_id` against. Raises CertsUnavailable when there are none to be had."""
        with self._lock:
            now = self._clock()
            needed = self._certs is None or now >= self._expires or key_id not in self._certs
            if needed and now >= self._next_try:
                self._refresh(now)
            if self._certs is None:
                raise CertsUnavailable()
            return self._certs

    def _refresh(self, now: float) -> None:
        try:
            certs = self._fetch()
        except Exception as error:  # a failed fetch is not the caller's fault: keep what is held, try again soon
            logger.warning("Could not fetch Firebase's signing certificates: %s", type(error).__name__)
            self._next_try = now + self._retry_after_failure
            return
        self._certs = certs
        self._expires = now + self._max_age
        self._next_try = now + self._min_refetch


def bearer_token(header: Optional[str]) -> Optional[str]:
    """The token in an "Authorization: Bearer <token>" header, or None when there is none."""
    if not isinstance(header, str):
        return None
    match = _BEARER.match(header.strip())
    if not match or len(match.group(1)) > MAX_TOKEN_LENGTH:
        return None
    return match.group(1)


def verify_firebase_token(token: str, project_id: str, certs_for: Callable[[str], Mapping[str, str]]) -> str:
    """The id of the person a good sign-in token belongs to. Raises InvalidToken for a bad one, CertsUnavailable when it cannot be checked."""
    if not isinstance(token, str) or not token or len(token) > MAX_TOKEN_LENGTH:
        raise InvalidToken("not a token")
    try:
        header = google_jwt.decode_header(token)
    except Exception as error:
        raise InvalidToken("unreadable header (%s)" % type(error).__name__) from None
    key_id = header.get("kid")
    if header.get("alg") != "RS256" or not isinstance(key_id, str) or not key_id:
        raise InvalidToken("unexpected header")

    certs = certs_for(key_id)  # may raise CertsUnavailable

    try:
        claims = google_jwt.decode(
            token,
            certs=certs,
            verify=True,
            audience=project_id,
            clock_skew_in_seconds=CLOCK_SKEW_SECONDS,
        )
    except Exception as error:
        # Signature, expiry, issued-at and audience are all checked in there. The library's own message can hold the token, so only
        # the kind of problem goes to the log.
        raise InvalidToken("rejected (%s)" % type(error).__name__) from None
    if claims.get("iss") != "https://securetoken.google.com/%s" % project_id:
        raise InvalidToken("made for another project")
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject or len(subject) > 128:
        raise InvalidToken("names nobody")
    return subject


_cache = CertCache()


def verify_token(token: str) -> str:
    """verify_firebase_token for this service's project, with the certificates kept in memory."""
    return verify_firebase_token(token, PROJECT_ID, _cache.certs_for)


def require_signed_in(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: the id of the person asking, or a 401 (no good token) or 503 (could not check it just now)."""
    token = bearer_token(authorization)
    if token is None:
        raise HTTPException(status_code=401, detail=SIGN_IN_MESSAGE)
    try:
        return verify_token(token)
    except InvalidToken as error:
        logger.info("Refused a sign-in token: %s", error)
        raise HTTPException(status_code=401, detail=SIGN_IN_MESSAGE) from None
    except CertsUnavailable:
        raise HTTPException(status_code=503, detail=TRY_AGAIN_MESSAGE) from None
