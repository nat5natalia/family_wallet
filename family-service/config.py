from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+aiomysql://family_user:family_pass@mysql:3306/family_wallet"
    JWT_SECRET_KEY: str = "super_secret_key_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    AUTH_SERVICE_URL: str = "http://auth-service:8000"

    class Config:
        env_file = ".env"


settings = Settings()
