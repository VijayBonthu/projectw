from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from config import settings
from fastapi import status, HTTPException,Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import easyocr

UPLOADS_DIR = "uploads"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def create_token(user_data:dict):
    try:
        to_encode = user_data.copy()
        to_encode.update({
            "iat":datetime.now(timezone.utc),
            "exp":datetime.now(timezone.utc) + timedelta(days=int(settings.TOKEN_EXPIRED_TIME_IN_DAYS))
        })
        return jwt.encode(
            to_encode, 
            settings.SECRET_KEY_J, 
            algorithm=settings.ALGORITHM)
    except JWTError as e:
        raise Exception(f"Failed to create token: {str(e)}")

def validate_token(token:str, credential_exception):
    try:
        if not token:
            raise Exception(f"No token provided in the header")

        payload = jwt.decode(
            token=token,
            key=settings.SECRET_KEY_J,
            algorithms=settings.ALGORITHM
            )
        
        exp = payload.get("exp")
        if not exp or datetime.fromtimestamp(exp, tz=timezone.utc)<datetime.now(timezone.utc):
            raise credential_exception
        return payload
    except JWTError:
        raise credential_exception
    
def get_current_user(token: HTTPAuthorizationCredentials = Security(security)):
    credential_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    return validate_token(token.credentials, credential_exception)

def hash_passwords(password:str):
    return pwd_context.hash(password)

def verify_password(password:str, hashed_password:str):
    return pwd_context.verify(password,hashed_password)

#extact text from images
def extract_text_from_image_easy(image_path) -> str:
    #add languages in config file
    reader = easyocr.Reader(settings.IMAGE_TEXT_LANGUAGE)
    #details 0 gives the text directly if you give 1 it will provide you with CI of those values and probably the postion of the word 
    results = reader.readtext(image_path, detail=0)
    extracted_text = " ".join(results)
    return extracted_text

def validate_jira_token(token: str):
    """Validate Jira-specific JWT token"""
    try:
        payload = jwt.decode(
            token=token,
            key=settings.SECRET_KEY_J,
            algorithms=settings.ALGORITHM
        )
        
        # Check if it's a Jira token
        if payload.get("provider") != "Jira":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Jira token"
            )
            
        # Check expiration
        exp = payload.get("exp")
        if not exp or datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Jira token has expired"
            )
            
        return payload
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Jira token: {str(e)}"
        )


