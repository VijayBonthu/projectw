from fastapi import FastAPI
import uvicorn
from dotenv import load_dotenv
import models
from models import engine
from fastapi.middleware.cors import CORSMiddleware
from routers import authentication, services, third_party_integrations
from utils.logger import setup_logger

# Setup logging once at application startup
logger = setup_logger()

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

origins = [
    "https://immense-finally-giraffe.ngrok-free.app",
    "https://7ede-142-198-208-131.ngrok-free.app",
    "http://localhost",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:3001"

    # Add any other domains that need to access your API
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"], 
    allow_headers=["*"],
)

app.include_router(authentication.router, prefix="/api/v1", tags=["authentication"])
app.include_router(services.router, prefix="/api/v1", tags=["services"])
app.include_router(third_party_integrations.router, prefix="/api/v1", tags=["third party integrations"])

@app.get("/")
async def home():
    return "Welcome to Oauth testing login page" 

    
if __name__ == "__main__":
    uvicorn.run("main:app", port=8080, log_level='info', reload=True)