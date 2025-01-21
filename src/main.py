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
from utils import create_token, validate_token
from routers import authentication, services

load_dotenv()

models.Base.metadata.create_all(bind=engine)

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

app.include_router(authentication.router)
app.include_router(services.router)

@app.get("/")
async def home():
    return "Welcome to Oauth testing login page" 

    
if __name__ == "__main__":
    uvicorn.run("main:app", port=8080, log_level='info', reload=True)