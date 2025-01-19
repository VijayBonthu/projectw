from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from config import settings

def create_token(user_data:dict):
    to_encode = user_data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=5)
    to_encode.update({"iat":datetime.now(timezone.utc)})
    to_encode.update({"exp":expire})

    try:
        encode_jwt = jwt.encode(to_encode, settings.SECRET_KEY_J, algorithm=settings.ALGORITHM)
    except JWTError as e:
        return {"message": "jwt token creation failed", "error": {e}}
    return encode_jwt
