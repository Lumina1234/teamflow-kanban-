from __future__ import annotations

from typing import List, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://kanban:kanban@localhost:5432/kanban"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Session secret — must be at least 32 characters
    SESSION_SECRET_KEY: str = "change-me-in-production-must-be-32-chars-long!!"

    # Cookie settings
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "lax"

    # CORS — accepts List[str], JSON array, or comma-separated string from env
    ALLOWED_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://localhost:5173"]

    # Rate limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REGISTER: str = "3/minute"
    RATE_LIMIT_RESET: str = "3/minute"

    # Environment
    ENVIRONMENT: str = "development"

    @field_validator("ALLOWED_ORIGINS")
    @classmethod
    def parse_allowed_origins(cls, v) -> List[str]:
        """Accept comma-separated string OR JSON array from env."""
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json
                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("SESSION_SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SESSION_SECRET_KEY must be at least 32 characters long")
        return v


settings = Settings()
