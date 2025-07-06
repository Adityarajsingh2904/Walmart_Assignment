from pydantic import BaseSettings

class Settings(BaseSettings):
    PG_DSN: str
    JWT_SECRET: str

    class Config:
        env_file = ".env"

settings = Settings()
