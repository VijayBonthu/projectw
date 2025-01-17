import os
from dotenv import load_dotenv
load_dotenv()

class Settings:
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_TOKEN =  os.getenv("GOOGLE_CLIENT_TOKEN")
    REDIRECT_URL = os.getenv("REDIRECT_URL")
    POSTGRES_USER = os.environ.get("POSTGRES_USER")
    POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD")
    POSTGRES_DB = os.environ.get("POSTGRES_DB")
    POSTGRES_PORT = os.environ.get("POSTGRES_PORT")
    POSTGRES_HOSTNAME = os.environ.get("POSTGRES_HOSTNAME")
    DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOSTNAME}:{POSTGRES_PORT}/{POSTGRES_DB}"

settings = Settings()