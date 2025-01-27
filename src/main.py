from fastapi import FastAPI
import uvicorn
from dotenv import load_dotenv
import models
from models import engine
from fastapi.middleware.cors import CORSMiddleware

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