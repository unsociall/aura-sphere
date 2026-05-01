import argparse
import os

from jose import jwt

DEFAULT_SECRET = "dev-secret-key-change-in-production"


def generate_token(user: str, email: str, name: str, secret: str) -> str:
    payload = {"sub": user, "email": email, "name": name}
    return jwt.encode(payload, secret, algorithm="HS256")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a development JWT for Aura-Sphere bridge.")
    parser.add_argument("--user", required=True, help="User ID to encode in the token.")
    parser.add_argument("--email", default="dev@local", help="Email claim for the token.")
    parser.add_argument("--name", default="Developer", help="Name claim for the token.")
    parser.add_argument(
        "--secret",
        default=os.getenv("SECRET_KEY", DEFAULT_SECRET),
        help="Secret key to sign the JWT. Defaults to SECRET_KEY or development fallback.",
    )
    args = parser.parse_args()

    token = generate_token(args.user, args.email, args.name, args.secret)
    print(token)


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
import argparse
from datetime import datetime, timedelta
import jwt
import os

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate JWT token for dev")
    parser.add_argument("--user", required=True, help="Username")
    args = parser.parse_args()

    token = create_access_token({"sub": args.user})
    print(f"Token for {args.user}: {token}")