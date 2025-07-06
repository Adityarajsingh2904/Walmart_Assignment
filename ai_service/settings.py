from pydantic import BaseSettings, Field
from typing import Optional

class Settings(BaseSettings):
    KAFKA_BOOTSTRAP_SERVERS: str = Field(..., env="KAFKA_BOOTSTRAP_SERVERS")
    KAFKA_USERNAME: Optional[str] = Field(None, env="KAFKA_USERNAME")
    KAFKA_PASSWORD: Optional[str] = Field(None, env="KAFKA_PASSWORD")
    KAFKA_SECURITY_PROTOCOL: str = Field("PLAINTEXT", env="KAFKA_SECURITY_PROTOCOL")
    KAFKA_SASL_MECHANISM: Optional[str] = Field(None, env="KAFKA_SASL_MECHANISM")
    KAFKA_SSL_CAFILE: Optional[str] = Field(None, env="KAFKA_SSL_CAFILE")
    ENVIRONMENT: str = Field("dev", env="ENVIRONMENT")

    class Config:
        case_sensitive = False
