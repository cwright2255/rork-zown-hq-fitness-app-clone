"""Tests for token_guard.py: who the mesh service lets in.

Run from this folder:   python -m pytest test_token_guard.py
(needs fastapi, httpx, google-auth and pytest; the service's own requirements.txt has the first and the third, not the other two)

Nothing here reaches the network. Tokens are signed with a key made for the test and checked against a certificate made for the test,
through the same google-auth code the service runs, so the signature check is the real one. main.py is loaded with torch, trimesh and
Anny replaced by empty stand-ins (the sandbox that wrote this cannot install them), which is enough to see which routes ask for a token.
CI does not run Python; __tests__/annyServiceWiring.test.js (run by the app's Jest suite) checks what it can read from the files.
"""

import base64
import contextlib
import datetime
import hashlib
import hmac
import json
import sys
import time
import types

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.x509.oid import NameOID
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from google.auth import crypt
from google.auth.crypt import es256
from google.auth import jwt as google_jwt

import token_guard
from token_guard import (
    CertCache,
    CertsUnavailable,
    InvalidToken,
    SIGN_IN_MESSAGE,
    TRY_AGAIN_MESSAGE,
    bearer_token,
    verify_firebase_token,
)

PROJECT = "zown-3c512"
ISSUER = "https://securetoken.google.com/zown-3c512"
KEY_ID = "key-one"


def make_key_and_cert(name="test"):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=30))
        .sign(key, hashes.SHA256())
    )
    key_pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    return key_pem, cert.public_bytes(serialization.Encoding.PEM).decode()


def make_ec_key_and_cert(name="ec"):
    key = ec.generate_private_key(ec.SECP256R1())
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=30))
        .sign(key, hashes.SHA256())
    )
    key_pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    return key_pem, cert.public_bytes(serialization.Encoding.PEM).decode()


@pytest.fixture(scope="module")
def good_key():
    return make_key_and_cert("google")


@pytest.fixture(scope="module")
def other_key():
    return make_key_and_cert("someone else")


def claims(**changes):
    now = int(time.time())
    base = {"iss": ISSUER, "aud": PROJECT, "sub": "user-1", "iat": now - 10, "exp": now + 3600, "auth_time": now - 10}
    base.update(changes)
    return {k: v for k, v in base.items() if v is not None}


def sign(key_pem, payload=None, key_id=KEY_ID):
    signer = crypt.RSASigner.from_string(key_pem, key_id)
    return google_jwt.encode(signer, claims() if payload is None else payload, key_id=key_id).decode()


def certs_of(cert_pem, key_id=KEY_ID):
    return {key_id: cert_pem}


def verify(token, cert_pem, project=PROJECT):
    return verify_firebase_token(token, project, lambda kid: certs_of(cert_pem))


def b64(data):
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode()
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


# --------------------------------------------------------------------------------------------------------------------------------
# bearer_token


class TestBearerToken:
    def test_is_the_token_after_the_bearer_word(self):
        assert bearer_token("Bearer abc.def.ghi") == "abc.def.ghi"

    def test_ignores_letter_case_and_spaces(self):
        assert bearer_token("bearer abc") == "abc"
        assert bearer_token("BEARER abc") == "abc"
        assert bearer_token("  Bearer   abc  ") == "abc"
        assert bearer_token("Bearer\tabc") == "abc"

    @pytest.mark.parametrize(
        "header",
        [None, "", "Basic dXNlcjpwYXNz", "abc", "Bearer", "Bearer    ", "Bearer abc def", "Bearerabc", 42, ["Bearer abc"]],
    )
    def test_is_nothing_for_anything_else(self, header):
        assert bearer_token(header) is None

    def test_is_nothing_for_a_token_longer_than_any_firebase_token(self):
        assert bearer_token("Bearer " + "a" * token_guard.MAX_TOKEN_LENGTH) == "a" * token_guard.MAX_TOKEN_LENGTH
        assert bearer_token("Bearer " + "a" * (token_guard.MAX_TOKEN_LENGTH + 1)) is None


# --------------------------------------------------------------------------------------------------------------------------------
# verify_firebase_token: the real signature check, with a key made for the test


class TestVerifyFirebaseToken:
    def test_gives_the_id_of_the_person_a_good_token_belongs_to(self, good_key):
        key_pem, cert_pem = good_key
        assert verify(sign(key_pem), cert_pem) == "user-1"

    def test_asks_for_the_certificates_by_the_key_id_in_the_token(self, good_key):
        key_pem, cert_pem = good_key
        asked = []

        def certs_for(kid):
            asked.append(kid)
            return certs_of(cert_pem, kid)

        verify_firebase_token(sign(key_pem, key_id="rotated-key"), PROJECT, certs_for)
        assert asked == ["rotated-key"]

    def test_refuses_a_token_that_has_run_out(self, good_key):
        key_pem, cert_pem = good_key
        with pytest.raises(InvalidToken):
            verify(sign(key_pem, claims(exp=int(time.time()) - 3600, iat=int(time.time()) - 7200)), cert_pem)

    def test_refuses_a_token_issued_in_the_future(self, good_key):
        key_pem, cert_pem = good_key
        with pytest.raises(InvalidToken):
            verify(sign(key_pem, claims(iat=int(time.time()) + 3600, exp=int(time.time()) + 7200)), cert_pem)

    def test_allows_a_few_seconds_of_clock_difference(self, good_key):
        key_pem, cert_pem = good_key
        assert verify(sign(key_pem, claims(iat=int(time.time()) + 5)), cert_pem) == "user-1"

    def test_refuses_the_right_issuer_with_the_wrong_audience(self, good_key):
        # each of the two claims is checked by itself, not just the pair
        key_pem, cert_pem = good_key
        with pytest.raises(InvalidToken):
            verify(sign(key_pem, claims(aud="another-project")), cert_pem)

    def test_refuses_a_token_made_for_another_firebase_project(self, good_key):
        key_pem, cert_pem = good_key
        with pytest.raises(InvalidToken):
            verify(sign(key_pem, claims(aud="another-project", iss="https://securetoken.google.com/another-project")), cert_pem)

    def test_refuses_the_right_audience_with_the_wrong_issuer(self, good_key):
        key_pem, cert_pem = good_key
        with pytest.raises(InvalidToken, match="another project"):
            verify(sign(key_pem, claims(iss="https://accounts.google.com")), cert_pem)

    @pytest.mark.parametrize("subject", [None, "", 42, "x" * 129])
    def test_refuses_a_token_that_names_nobody(self, good_key, subject):
        key_pem, cert_pem = good_key
        payload = claims(sub=subject)
        if subject is None:
            payload.pop("sub", None)
        with pytest.raises(InvalidToken):
            verify(sign(key_pem, payload), cert_pem)

    def test_refuses_a_token_signed_with_a_key_that_is_not_googles(self, good_key, other_key):
        # the same key id and every claim right, but signed by someone else's key
        _, google_cert = good_key
        stranger_key, _ = other_key
        with pytest.raises(InvalidToken):
            verify(sign(stranger_key), google_cert)

    def test_refuses_a_token_whose_key_id_is_not_on_the_list(self, good_key):
        key_pem, cert_pem = good_key
        with pytest.raises(InvalidToken):
            verify_firebase_token(sign(key_pem, key_id="unknown"), PROJECT, lambda kid: certs_of(cert_pem))

    def test_refuses_a_token_with_a_changed_payload(self, good_key):
        key_pem, cert_pem = good_key
        head, body, signature = sign(key_pem).split(".")
        forged = dict(json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))), sub="someone-else")
        with pytest.raises(InvalidToken):
            verify(".".join([head, b64(forged), signature]), cert_pem)

    def test_refuses_a_token_with_no_signature_algorithm(self, good_key):
        _, cert_pem = good_key
        unsigned = ".".join([b64({"alg": "none", "typ": "JWT", "kid": KEY_ID}), b64(claims()), ""])
        with pytest.raises(InvalidToken):
            verify(unsigned, cert_pem)

    def test_refuses_a_token_signed_with_the_public_certificate_as_a_shared_secret(self, good_key):
        # the classic trick: say HS256 and sign with the public certificate, which anyone can read
        _, cert_pem = good_key
        signed_part = b64({"alg": "HS256", "typ": "JWT", "kid": KEY_ID}) + "." + b64(claims())
        mac = hmac.new(cert_pem.encode(), signed_part.encode(), hashlib.sha256).digest()
        with pytest.raises(InvalidToken):
            verify(signed_part + "." + b64(mac), cert_pem)

    def test_refuses_a_token_signed_with_another_algorithm_even_when_the_signature_is_good(self):
        # Firebase signs with RS256 only. A token that is correctly signed some other way is not one of Google's.
        ec_key, ec_cert = make_ec_key_and_cert()
        signer = es256.ES256Signer.from_string(ec_key, KEY_ID)
        token = google_jwt.encode(signer, claims(), key_id=KEY_ID).decode()
        assert json.loads(base64.urlsafe_b64decode(token.split(".")[0] + "==="))["alg"] == "ES256"
        with pytest.raises(InvalidToken, match="unexpected header"):
            verify(token, ec_cert)

    def test_refuses_a_good_token_that_is_longer_than_any_firebase_token(self, good_key):
        key_pem, cert_pem = good_key
        padded = sign(key_pem, claims(padding="x" * token_guard.MAX_TOKEN_LENGTH))
        assert len(padded) > token_guard.MAX_TOKEN_LENGTH
        with pytest.raises(InvalidToken, match="not a token"):
            verify(padded, cert_pem)

    def test_refuses_a_token_with_no_key_id(self, good_key):
        key_pem, cert_pem = good_key
        signer = crypt.RSASigner.from_string(key_pem)
        token = google_jwt.encode(signer, claims()).decode()
        asked = []
        with pytest.raises(InvalidToken):
            verify_firebase_token(token, PROJECT, lambda kid: asked.append(kid) or certs_of(cert_pem))
        assert asked == []

    @pytest.mark.parametrize("token", ["", "abc", "a.b", "a.b.c", "....", "not a token at all", None, 42, "a" * 5000])
    def test_refuses_what_is_not_a_token_without_fetching_any_certificates(self, token):
        def certs_for(kid):
            raise AssertionError("looked for certificates")

        with pytest.raises(InvalidToken):
            verify_firebase_token(token, PROJECT, certs_for)

    def test_does_not_put_the_token_in_the_reason(self, good_key):
        key_pem, cert_pem = good_key
        token = sign(key_pem, claims(exp=int(time.time()) - 3600, iat=int(time.time()) - 7200))
        with pytest.raises(InvalidToken) as raised:
            verify(token, cert_pem)
        assert token not in str(raised.value)
        assert token.split(".")[1] not in str(raised.value)

    @pytest.mark.parametrize("token", ["secret-looking-token-value", "secret.looking-token.value", "a.b.secret-looking-token-value"])
    def test_does_not_put_a_token_that_cannot_be_read_in_the_reason(self, token):
        # the library's own messages can hold the whole token, and the reason goes to the log
        with pytest.raises(InvalidToken) as raised:
            verify_firebase_token(token, PROJECT, lambda kid: {})
        assert "secret" not in str(raised.value)

    def test_does_not_put_what_the_token_says_in_the_reason(self, good_key):
        # the library's own message for a wrong audience repeats the audience, which the sender chose and the log should not take on trust
        key_pem, cert_pem = good_key
        token = sign(key_pem, claims(aud="secret-audience-text"))
        with pytest.raises(InvalidToken) as raised:
            verify(token, cert_pem)
        assert "secret-audience-text" not in str(raised.value)

    def test_does_not_put_a_part_of_the_token_the_library_cannot_read_in_the_reason(self, good_key):
        # a good header and a payload that is not a payload: the library's message holds the payload text
        _, cert_pem = good_key
        token = ".".join([b64({"alg": "RS256", "typ": "JWT", "kid": KEY_ID}), b64(b"secret-payload-text"), "c2lnbmF0dXJl"])
        with pytest.raises(InvalidToken) as raised:
            verify(token, cert_pem)
        assert "secret-payload-text" not in str(raised.value)

    def test_does_not_put_a_token_the_library_rejects_in_the_reason(self, good_key, other_key):
        stranger_key, _ = other_key
        _, google_cert = good_key
        token = sign(stranger_key)
        with pytest.raises(InvalidToken) as raised:
            verify(token, google_cert)
        assert token not in str(raised.value)
        assert token.split(".")[2] not in str(raised.value)

    def test_passes_on_that_the_certificates_are_not_to_be_had(self, good_key):
        key_pem, _ = good_key

        def certs_for(kid):
            raise CertsUnavailable()

        with pytest.raises(CertsUnavailable):
            verify_firebase_token(sign(key_pem), PROJECT, certs_for)


# --------------------------------------------------------------------------------------------------------------------------------
# CertCache: how long Google's certificates are kept, and how often the service looks again


class Clock:
    def __init__(self, now=1000.0):
        self.now = now

    def __call__(self):
        return self.now


def counting_fetch(*answers):
    """A fetch that gives the answers in order (an Exception is raised), the last one again and again; .calls counts."""
    state = {"calls": 0}

    def fetch():
        answer = answers[min(state["calls"], len(answers) - 1)]
        state["calls"] += 1
        if isinstance(answer, Exception):
            raise answer
        return answer

    fetch.state = state
    return fetch


class TestCertCache:
    def test_fetches_once_and_keeps_the_certificates(self):
        fetch = counting_fetch({"a": "cert-a"})
        cache = CertCache(fetch=fetch, clock=Clock())
        assert cache.certs_for("a") == {"a": "cert-a"}
        assert cache.certs_for("a") == {"a": "cert-a"}
        assert fetch.state["calls"] == 1

    def test_looks_again_after_an_hour(self):
        clock = Clock()
        fetch = counting_fetch({"a": "one"}, {"a": "two"})
        cache = CertCache(fetch=fetch, clock=clock)
        assert cache.certs_for("a") == {"a": "one"}
        clock.now += token_guard.CERTS_MAX_AGE_SECONDS - 1
        assert cache.certs_for("a") == {"a": "one"}
        clock.now += 2
        assert cache.certs_for("a") == {"a": "two"}
        assert fetch.state["calls"] == 2

    def test_looks_again_for_a_key_it_does_not_have_but_not_more_than_once_a_minute(self):
        clock = Clock()
        fetch = counting_fetch({"a": "one"}, {"a": "one", "b": "two"})
        cache = CertCache(fetch=fetch, clock=clock)
        cache.certs_for("a")
        # a made-up key id straight away: not worth another fetch
        assert "b" not in cache.certs_for("b")
        assert "b" not in cache.certs_for("made-up")
        assert fetch.state["calls"] == 1
        # a minute later, a key it does not have is worth a look, and the new key turns up
        clock.now += token_guard.CERTS_MIN_REFETCH_SECONDS
        assert cache.certs_for("b") == {"a": "one", "b": "two"}
        assert fetch.state["calls"] == 2

    def test_a_stranger_sending_made_up_key_ids_cannot_make_it_ask_google_over_and_over(self):
        clock = Clock()
        fetch = counting_fetch({"a": "one"})
        cache = CertCache(fetch=fetch, clock=clock)
        for n in range(500):
            cache.certs_for("made-up-%d" % n)
        assert fetch.state["calls"] == 1
        clock.now += 10 * token_guard.CERTS_MIN_REFETCH_SECONDS
        for n in range(500):
            cache.certs_for("made-up-%d" % n)
        assert fetch.state["calls"] == 2

    def test_cannot_be_checked_when_the_first_fetch_fails(self):
        cache = CertCache(fetch=counting_fetch(OSError("no network")), clock=Clock())
        with pytest.raises(CertsUnavailable):
            cache.certs_for("a")

    def test_after_a_failed_fetch_it_tries_again_soon_but_not_for_every_request(self):
        clock = Clock()
        fetch = counting_fetch(OSError("no network"), {"a": "one"})
        cache = CertCache(fetch=fetch, clock=clock)
        with pytest.raises(CertsUnavailable):
            cache.certs_for("a")
        with pytest.raises(CertsUnavailable):
            cache.certs_for("a")
        assert fetch.state["calls"] == 1
        clock.now += token_guard.CERTS_RETRY_AFTER_FAILURE_SECONDS
        assert cache.certs_for("a") == {"a": "one"}
        assert fetch.state["calls"] == 2

    def test_keeps_using_the_certificates_it_has_when_a_later_fetch_fails(self):
        clock = Clock()
        fetch = counting_fetch({"a": "one"}, OSError("no network"))
        cache = CertCache(fetch=fetch, clock=clock)
        cache.certs_for("a")
        clock.now += token_guard.CERTS_MAX_AGE_SECONDS + 1
        assert cache.certs_for("a") == {"a": "one"}

    def test_does_not_put_the_reason_for_a_failed_fetch_into_the_error(self):
        cache = CertCache(fetch=counting_fetch(OSError("secret detail")), clock=Clock())
        with pytest.raises(CertsUnavailable) as raised:
            cache.certs_for("a")
        assert "secret detail" not in str(raised.value)


# --------------------------------------------------------------------------------------------------------------------------------
# require_signed_in: the answers a caller gets


@pytest.fixture
def guarded(monkeypatch, good_key):
    """A tiny app with one route behind the guard, using a certificate cache that holds the test's certificate."""
    _, cert_pem = good_key
    monkeypatch.setattr(token_guard, "_cache", CertCache(fetch=counting_fetch(certs_of(cert_pem)), clock=Clock()))
    app = FastAPI()

    @app.get("/who")
    def who(uid: str = Depends(token_guard.require_signed_in)):
        return {"uid": uid}

    return TestClient(app)


class TestRequireSignedIn:
    def test_lets_a_signed_in_person_through_and_says_who_they_are(self, guarded, good_key):
        key_pem, _ = good_key
        answer = guarded.get("/who", headers={"Authorization": "Bearer " + sign(key_pem)})
        assert answer.status_code == 200
        assert answer.json() == {"uid": "user-1"}

    def test_says_401_with_no_token(self, guarded):
        answer = guarded.get("/who")
        assert answer.status_code == 401
        assert answer.json() == {"detail": SIGN_IN_MESSAGE}

    @pytest.mark.parametrize("header", ["Basic dXNlcjpwYXNz", "Bearer", "Bearer made.up.token", "Bearer abc", "garbage"])
    def test_says_401_with_a_token_that_is_not_good(self, guarded, header):
        answer = guarded.get("/who", headers={"Authorization": header})
        assert answer.status_code == 401
        assert answer.json() == {"detail": SIGN_IN_MESSAGE}

    def test_says_401_with_a_token_that_has_run_out_without_saying_why(self, guarded, good_key):
        key_pem, _ = good_key
        expired = sign(key_pem, claims(exp=int(time.time()) - 3600, iat=int(time.time()) - 7200))
        answer = guarded.get("/who", headers={"Authorization": "Bearer " + expired})
        assert answer.status_code == 401
        assert answer.json() == {"detail": SIGN_IN_MESSAGE}

    def test_says_401_with_a_token_signed_by_someone_else(self, guarded, other_key):
        stranger_key, _ = other_key
        answer = guarded.get("/who", headers={"Authorization": "Bearer " + sign(stranger_key)})
        assert answer.status_code == 401

    def test_says_503_when_google_s_certificates_cannot_be_had(self, monkeypatch, good_key):
        key_pem, _ = good_key
        monkeypatch.setattr(token_guard, "_cache", CertCache(fetch=counting_fetch(OSError("no network")), clock=Clock()))
        app = FastAPI()

        @app.get("/who")
        def who(uid: str = Depends(token_guard.require_signed_in)):
            return {"uid": uid}

        answer = TestClient(app).get("/who", headers={"Authorization": "Bearer " + sign(key_pem)})
        assert answer.status_code == 503
        assert answer.json() == {"detail": TRY_AGAIN_MESSAGE}

    def test_uses_this_apps_firebase_project_unless_told_otherwise(self):
        assert token_guard.PROJECT_ID == "zown-3c512"


# --------------------------------------------------------------------------------------------------------------------------------
# main.py: which routes ask for a token


@pytest.fixture
def main_module(monkeypatch):
    """main.py with torch, trimesh and Anny replaced by empty stand-ins."""
    torch = types.ModuleType("torch")
    torch.no_grad = lambda: contextlib.nullcontext()
    monkeypatch.setitem(sys.modules, "torch", torch)
    monkeypatch.setitem(sys.modules, "trimesh", types.ModuleType("trimesh"))
    monkeypatch.setitem(sys.modules, "anny", types.ModuleType("anny"))
    sys.modules.pop("main", None)
    import main

    reached = []

    def get_model():
        reached.append(True)
        raise RuntimeError("stand-in model")

    main.get_model = get_model
    main.reached = reached
    yield main
    sys.modules.pop("main", None)


SCAN = {"height_cm": 178, "weight_kg": 95, "gender": "male", "body_fat_percent": 22}


class TestMainRoutes:
    def test_health_stays_open_to_anyone(self, main_module):
        answer = TestClient(main_module.app).get("/health")
        assert answer.status_code == 200
        assert answer.json() == {"status": "ok"}

    def test_generate_mesh_turns_away_a_request_with_no_token_before_doing_any_work(self, main_module):
        answer = TestClient(main_module.app).post("/generate-mesh", json=SCAN)
        assert answer.status_code == 401
        assert answer.json() == {"detail": SIGN_IN_MESSAGE}
        assert main_module.reached == []

    def test_generate_mesh_turns_away_a_token_that_is_not_good(self, main_module):
        answer = TestClient(main_module.app).post("/generate-mesh", json=SCAN, headers={"Authorization": "Bearer made.up.token"})
        assert answer.status_code == 401
        assert main_module.reached == []

    def test_generate_mesh_asks_for_the_token_before_it_looks_at_the_measurements(self, main_module):
        answer = TestClient(main_module.app).post("/generate-mesh", json={"height_cm": "tall"})
        assert answer.status_code == 401

    def test_generate_mesh_goes_ahead_for_a_signed_in_person(self, main_module, monkeypatch):
        monkeypatch.setattr(token_guard, "verify_token", lambda token: "user-1")
        answer = TestClient(main_module.app).post("/generate-mesh", json=SCAN, headers={"Authorization": "Bearer any-token"})
        assert main_module.reached == [True]
        # the stand-in model fails, which the service reports as a 500: the point is that the request got that far
        assert answer.status_code == 500

    def test_nothing_else_is_open_but_health_and_the_docs_pages(self, main_module):
        paths = sorted(route.path for route in main_module.app.routes)
        assert paths == ["/docs", "/docs/oauth2-redirect", "/generate-mesh", "/health", "/openapi.json", "/redoc"]
