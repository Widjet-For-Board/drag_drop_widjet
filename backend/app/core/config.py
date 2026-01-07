from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_SECURE: bool = False
    
    PUBLIC_MINIO_URL: str = "http://localhost:9000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
