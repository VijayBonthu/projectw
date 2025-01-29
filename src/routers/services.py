from fastapi import File, UploadFile, Form, Depends, APIRouter, HTTPException, status
import os
from utils import get_current_user
from getdata import ExtractText
from processdata import AccessLLM
from config import settings
from sqlalchemy.orm import Session
from models import get_db
from database_scripts import user_documents

router = APIRouter()
accessllm = AccessLLM(api_key=os.getenv("OPENAI_CHATGPT"))
UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True) 


@router.post("/upload/")
async def upload_file(get_current_user=Depends(get_current_user), file:UploadFile = File(...), db:Session=Depends(get_db)):
    file_content = b''
    try:
        while chunk := await file.read(1024*1024):
            file_content +=chunk
        if len(file_content) > eval(settings.FILE_SIZE):
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File size exceed 10MB limit")

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"file processing failed: {str(e)}")
    
    if not file_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    file_path = os.path.join(UPLOADS_DIR, file.filename)
    try:
        with open(file_path, "wb") as f:
            f.write(file_content) 
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"failed to save the file: {str(e)}")
    try:
        user_doc = {
            "user_id":get_current_user["id"],
            "document_path" : file_path
        }
        response = await user_documents(doc_data=user_doc,db=db)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error occured please try again {str(e)}")

    document_data = await ExtractText(document_path=file_path).parse_document()
    full_data = []
    for i in range(len(document_data)):
        full_data.append(document_data[i]["data"])
    return "\n".join(
    str(item["data"]) if isinstance(item, dict) else str(item)
    for item in full_data
    )
    # x = accessllm.send_chat(user_message=document_data, expected_time=upload_doc.expected_time, list_of_developers=upload_doc.list_of_developers)

    # return x