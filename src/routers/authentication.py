
from oauth import flow, auth_callback
from fastapi import Depends, HTTPException, Request, APIRouter, status
from sqlalchemy.orm import Session
from models import get_db
from database_scripts import create_user,UserCreationError, get_user_details
from utils import create_token, verify_password
import models
from p_model_type import Registration_login_password, login_details

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

@router.get("/auth/callback", status_code=status.HTTP_200_OK)
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
        user = await create_user(user_data=user_data,provider=response['provider'], db=db)
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

@router.post("/registration", status_code=status.HTTP_201_CREATED)
async def create_account(user_details:Registration_login_password, db:Session=Depends(get_db)):
    if not user_details:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Required details are not provided")
    try:
        user_details = user_details.__dict__
        user_details.update(
            {
                "id": None,
                "verified_email":False,
                "picture":None,
                "provider":"Local",
                "name":user_details["given_name"] + " " +user_details["family_name"]
            }
        )
        user = await create_user(user_data=user_details, provider="Local",db=db)
    except UserCreationError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Something went wrong, it is not you, Please try after sometime{e}")
    

    
    payload= {
        "id": user.user_id,
        "verified_email":user.verified_email,
        "picture": user.picture,
        "provider": user.provider,
        "email":user.email_address
    }

    token = create_token(user_data=payload)
    
    return {"access_token": token, "token_type": "bearer"} 

@router.post("/login", status_code=status.HTTP_200_OK)
def log_into_account(login_details:login_details, db:Session=Depends(get_db)):
    if not login_details:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please provide the details to login")
    try:
        user_details = get_user_details(email_address=login_details.email_address, db=db)
    except UserCreationError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record doesn't exists, please register to Login")

    checked_password = verify_password(password=login_details.password,hashed_password=user_details[6])
    if checked_password:
        payload= {
            "id": user_details[1],
            "verified_email":user_details[4],
            "provider": user_details[5],
            "email":user_details[0],
        }
        token = create_token(user_data=payload)
        return {"access_token": token, "token_type": "bearer"}
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")





