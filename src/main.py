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
from config import settings
from oauth import flow, auth_callback
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import requests
from fastapi.middleware.cors import CORSMiddleware



load_dotenv()

models.Base.metadata.create_all(bind=engine)

accessllm = AccessLLM(api_key=os.getenv("OPENAI_CHATGPT"))

app = FastAPI()

origins = ["*","https://f6bd-142-198-196-182.ngrok-free.app"]
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

auth_states={}

@app.get("/")
async def home():
    return "Welcome to Oauth testing login page"

@app.get("/auth/login")
async def login():
    auth_url, state = flow.authorization_url(prompt="consent")
    print(flow.redirect_uri)
    auth_states[state]=True
    print(f"Authorization URL: {auth_url}")
    # print(f"Generated state: {state}")
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
async def callback(request: Request, db: Session = Depends(get_db)):

        # Extract the state from query parameters
    state = request.query_params.get("state")
    if not state or state not in auth_states:
        raise HTTPException(status_code=400, detail="Invalid or missing state")
    response = auth_callback(url=request.url)
    if response["message"] == "bad request":
        raise HTTPException(status_code=400, detail="Issue with your login, Please try again")
    
    user = db.query(models.User).filter(models.User.oauth_id == response["user"]["id"]).first()
    if not user:
        
        user = models.User(
            oauth_id = response["user"]["id"], 
            email = response["user"]["email"],
            name = response["user"]["name"],
            picture = response["user"]["picture"],
            provider = response["provider"]
        )
        try:
            db.add(user)
            db.commit()
            db.refresh()
        except Exception as e:
            db.rollback() 




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