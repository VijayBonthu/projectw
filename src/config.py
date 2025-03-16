import os
from dotenv import load_dotenv
load_dotenv()

class Settings:
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_TOKEN =  os.getenv("GOOGLE_CLIENT_TOKEN")
    REDIRECT_URL = os.getenv("REDIRECT_URL")
    POSTGRES_USER = os.getenv("POSTGRES_USER")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
    POSTGRES_DB = os.getenv("POSTGRES_DB")
    POSTGRES_PORT = os.getenv("POSTGRES_PORT")
    POSTGRES_HOSTNAME = os.getenv("POSTGRES_HOSTNAME")
    DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOSTNAME}:{POSTGRES_PORT}/{POSTGRES_DB}"
    ALGORITHM=os.getenv("ALGORITHM")
    SECRET_KEY_J=os.getenv("SECRET_KEY_J")
    TOKEN_EXPIRED_TIME_IN_DAYS=os.getenv("TOKEN_EXPIRED_TIME_IN_DAYS")
    FILE_SIZE = os.getenv("FILE_SIZE")
    OPENAI_CHATGPT = os.getenv("OPENAI_CHATGPT")
    IMAGE_TEXT_LANGUAGE=['en']
    JIRA_CLIENT_ID = os.getenv("JIRA_CLIENT_ID")
    JIRA_CLIENT_SECRET = os.getenv("JIRA_CLIENT_SECRET")
    JIRA_REDIRECT_URI=os.getenv("JIRA_REDIRECT_URI")
    GOOGLE_JWKS = os.getenv("GOOGLE_JWKS_URL")
    JIRA_JWKS = os.getenv("JIRA_JWKS_URL")

settings = Settings()