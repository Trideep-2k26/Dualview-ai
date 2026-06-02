from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GOOGLE_API_KEY: str = ""
    CHROMA_DIR: str = "./data/chroma"
    LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    WHISPER_MODEL: str = "base"
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    CACHE_ENABLED: bool = False
    # Optional Chroma cloud settings (if using Chroma Cloud)
    CHROMA_MODE: str = "local"
    CHROMA_HOST: str = ""
    CHROMA_API_KEY: str = ""
    CHROMA_TENANT: str = ""
    CHROMA_DATABASE: str = ""
    CHROMA_USE_TLS: bool = True
    CHROMA_PORT: int | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
