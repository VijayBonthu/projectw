
from oauth import flow, auth_callback
from fastapi import Depends, HTTPException, Request, APIRouter, status
from sqlalchemy.orm import Session
from models import get_db
from database_scripts import get_or_create_user,UserCreationError
from utils import create_token
import models
from p_model_type import registration_login

router = APIRouter()

auth_states = {}
@router.get("/auth/login")
async def login():
    result= flow.authorization_url(prompt="consent")

    auth_url = result[0] if isinstance(result, tuple) else result
    state = result[1] if isinstance(result, tuple) else None

    if state:
        auth_states[state] = True
    return auth_url

@router.get("/auth/callback")
async def callback(request: Request, db:Session=Depends(get_db)):
    # Extract the state from query parameters
    state = request.query_params.get("state")
    if not state or state not in auth_states:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Link already expired, Try to login in again")
    try: 
        #Uses Google authentication to login
        response =auth_callback(url=request.url)
        if response.get("message") == "bad request":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Issue with your login, Please try again")
        user_data = response["user"]
    except UserCreationError as e:
        #add logging here to save it
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Something went wrong, it is not you, Please try after sometime")
    try:
        #create a record in DB if its the first time or get the details for jwt payload
        user = await get_or_create_user(user_data=user_data,provider=response['provider'], db=db)
        auth_states.pop(state,None)
        #add logging here to save it
    except UserCreationError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Something went wrong, it is not you, Please try after sometime") 
    
    payload= {
        "id": user.user_id,
        "oauth_id": user.oauth_id,
        "verified_email":user.verified_email,
        "picture": user.picture,
        "provider": user.provider,
        "email":user.email_address
    }
     # creates JWT token
    token = create_token(user_data=payload)
    return {"access_token": token, "token_type":"bearer"}


