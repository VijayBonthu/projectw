from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, Request
import os
import uvicorn
from dotenv import load_dotenv
from processdata import AccessLLM
from p_model_type import UploadDoc
from getdata import ExtractText
import json
import models
from models import engine,get_db
from oauth import flow, auth_callback
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database_scripts import get_or_create_user,UserCreationError
from fastapi.middleware.cors import CORSMiddleware
from utils import create_token

load_dotenv()

models.Base.metadata.create_all(bind=engine)

accessllm = AccessLLM(api_key=os.getenv("OPENAI_CHATGPT"))

app = FastAPI()

origins = [
    "https://immense-finally-giraffe.ngrok-free.app",
    "http://immense-finally-giraffe.ngrok-free.app",
    "http://localhost",
    "http://localhost:8080",
    # Add any other domains that need to access your API
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# {"expected_time": "4 weeks","list_of_developers":["data analyst", "data engineer", "data architect", "devops engineer","developer"]}



UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True) 

auth_states = {}
@app.get("/")
async def home():
    return "Welcome to Oauth testing login page"

@app.get("/auth/login")
async def login():
    result= flow.authorization_url(prompt="consent")

    auth_url = result[0] if isinstance(result, tuple) else result
    state = result[1] if isinstance(result, tuple) else None

    if state:
        auth_states[state] = True
    print(auth_url)
    return RedirectResponse(url=str(auth_url))

@app.get("/auth/callback")
async def callback(request: Request, db:Session=Depends(get_db)):

    # Extract the state from query parameters
    state = request.query_params.get("state")
    if not state or state not in auth_states:
        raise HTTPException(status_code=400, detail="Link already expired, Try to login in again")
    try: 
        #Uses Google authentication to login
        response =auth_callback(url=request.url)
        if response.get("message") == "bad request":
            raise HTTPException(status_code=400, detail="Issue with your login, Please try again")
        user_data = response["user"]
        #create a record in DB if its the first time or get the details for jwt payload
        user = await get_or_create_user(user_data=user_data,provider=response['provider'], db=db)
        auth_states.pop(state,None)
    except UserCreationError as e:
        raise HTTPException(status_code=500, detail=f"Authentication failed: {e}")
    
    payload= {
        "id": user.user_id,
        "oauth_id": user.oauth_id,
        "picture": user.picture,
        "provider": user.provider,
        "email":user.email
    }
     # creates JWT token
    token = create_token(user_data=payload)
    return {"access_token": token, "token_type":"bearer"}


    

@app.post("/upload/")
async def upload_file(payload:str = Form(...), file:UploadFile = File(...)):


    parameters = json.loads(payload) 

    upload_doc = UploadDoc(**parameters)
    file_path = os.path.join(UPLOADS_DIR, file.filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    document_data = await ExtractText(document_path=file_path).parse_document()
    x = accessllm.send_chat(user_message=document_data, expected_time=upload_doc.expected_time, list_of_developers=upload_doc.list_of_developers)

    return x

    
if __name__ == "__main__":
    uvicorn.run("main:app", port=8080, log_level='info', reload=True)