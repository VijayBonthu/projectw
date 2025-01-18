from google_auth_oauthlib.flow import Flow
from config import settings
import requests

flow = Flow.from_client_secrets_file(
    client_secrets_file="../client_secret_g.json",
    redirect_uri=settings.REDIRECT_URL,
    scopes=["https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "openid"]
)

def auth_callback(url:str=None):
    if not url:
        return "callback failed no link provided"
    try:
        authorization_response = str(url)
        flow.fetch_token(authorization_response=authorization_response) 
        credentials = flow.credentials
        user_info_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {credentials.token}"}
        )
        user_info = user_info_response.json()
        # Process and store user information in PostgreSQL
        return {"message": "Authentication successful", "user": user_info, "provider":"Google"}
    except Exception as e:
        return {"message": "bad request", "error": e}