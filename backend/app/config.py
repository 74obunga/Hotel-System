from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://app:app@localhost:5432/hotel"
    jwt_secret: str = "development-only-change-me"
    access_token_minutes: int = 30
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("jwt_secret")
    @classmethod
    def validate_jwt_secret(cls, value: str) -> str:
        if value == "development-only-change-me":
            raise ValueError("JWT_SECRET must be configured with a non-default secret in the environment")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
