"""Primitives de sécurité : hashing, JWT, tokens."""

from __future__ import annotations

import hashlib
import secrets
import time

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_ph = PasswordHasher()


# -- Mots de passe (argon2id) --


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False


# -- JWT --


def create_access_token(
    user_id: str,
    role: str,
    *,
    secret: str,
    ttl_minutes: int = 15,
) -> str:
    now = time.time()
    payload = {
        "sub": user_id,
        "role": role,
        "iat": int(now),
        "exp": int(now + ttl_minutes * 60),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str, *, secret: str) -> dict[str, object]:
    """Decode et vérifie un access token. Lève jwt.PyJWTError si invalide."""
    return jwt.decode(token, secret, algorithms=["HS256"])


# -- Tokens opaques (refresh, vérification email, reset) --


def generate_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
