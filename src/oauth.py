from authlib.integrations.starlette_client import OAuth
from .config import settings

oauth = OAuth()

oauth.register(
    name="google",
    client_id = settings.GOOGLE_CLIENT_ID,
    client_secret = settings.GOOGLE_CLIENT_TOKEN,
    access_token_url="https://oauth2.googleapis.com/token",
    authorize_url="https://accounts.google.com/o/oauth2/auth",
    client_kwargs={"scope": "openid email profile"}
)