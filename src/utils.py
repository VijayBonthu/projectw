from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from config import settings
from fastapi import Depends, status, HTTPException,Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

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
