from fastapi import FastAPI, File, UploadFile, Form
import os
import uvicorn
from dotenv import load_dotenv
from processdata import AccessLLM
from p_model_type import UploadDoc
from getdata import ExtractText
import json
import models
from models import engine


load_dotenv()

models.Base.metadata.create_all(bind=engine)

accessllm = AccessLLM(api_key=os.getenv("OPENAI_CHATGPT"))

# {"expected_time": "4 weeks","list_of_developers":["data analyst", "data engineer", "data architect", "devops engineer","developer"]}

app = FastAPI()

UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True) 

@app.get("/")
async def home():
    return "Hello World"

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