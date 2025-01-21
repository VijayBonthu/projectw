from fastapi import File, UploadFile, Form, Depends, APIRouter, Security
from fastapi.security.oauth2 import OAuth2PasswordRequestForm
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import os
import json
from utils import get_current_user
from p_model_type import UploadDoc
from getdata import ExtractText
from processdata import AccessLLM

router = APIRouter()
accessllm = AccessLLM(api_key=os.getenv("OPENAI_CHATGPT"))
UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True) 


@router.post("/upload/")
# async def upload_file(get_current_user=Depends(get_current_user), payload:str = Form(...), file:UploadFile = File(...)):
async def upload_file(get_current_user=Depends(get_current_user)):
    print(f"authentication successful: {get_current_user}")


    # parameters = json.loads(payload) 

    # upload_doc = UploadDoc(**parameters)
    # file_path = os.path.join(UPLOADS_DIR, file.filename)

    # with open(file_path, "wb") as f:
    #     content = await file.read()
    #     f.write(content)

    # document_data = await ExtractText(document_path=file_path).parse_document()
    # x = accessllm.send_chat(user_message=document_data, expected_time=upload_doc.expected_time, list_of_developers=upload_doc.list_of_developers)

    # return x