"""Settings read from server/.env (or real environment variables, which win)."""
import os
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = SERVER_DIR / ".env"


def load_env_file() -> None:
    """Copy KEY=VALUE lines from .env into os.environ, without overwriting real env vars."""
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def required(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"{key} is missing: copy server/.env.example to server/.env")
    return value


class Settings:
    def __init__(self) -> None:
        load_env_file()
        self.database_url = required("DATABASE_URL")
        self.jwt_secret = required("JWT_SECRET")
        self.upload_dir = SERVER_DIR / "uploads"
        self.otp_demo = os.environ.get("OTP_DEMO", "true").lower() in ("true", "1", "yes")
        self.razorpay_key_id = os.environ.get("RAZORPAY_KEY_ID", "")
        self.razorpay_key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")


settings = Settings()
