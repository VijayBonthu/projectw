from fastapi import File, UploadFile, Form, Depends, APIRouter, HTTPException, status, Request, Security
import os
from utils.token_generation import get_current_user, validate_jira_token
from getdata import ExtractText
from processdata import AccessLLM
from config import settings
from sqlalchemy.orm import Session
from models import get_db
from database_scripts import user_documents
from agents.workflow import ProjectScopingAgent
from utils.logger import logger
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jira_logic.jira_components import get_jira_user_info
from p_model_type import JiraTokenRequest

router = APIRouter()
# accessllm = AccessLLM(api_key=os.getenv("OPENAI_CHATGPT"))
UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True) 

security = HTTPBearer()


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
    raw_requirements =  "\n".join(
                        str(item["data"]) if isinstance(item, dict) else str(item) for item in full_data
                                )
    
    print(f"raw_requirements: {raw_requirements}")
    
    #Agent for analyzing and providing the response in PDF
    agent = ProjectScopingAgent()
    
    # Sample data must include the correct structure
    sample_data = {
        "input": {
            raw_requirements
        }
    }
    try:
        requirements = agent.analyze_input(sample_data["input"])
        ambiguities = agent.identify_ambiguities()
        tech_stack = agent.generate_tech_recommendations()
    
        agent.generate_pdf_report("project_scoping_report.pdf")
        print(f"Ambiguities to resolve: {ambiguities['questions']}")
        return {"message": "request completed"}
    except Exception as e:
        print(f"Critical error: {str(e)}") 
        return {"Critical Error":{str(e)}}
    
@router.post("/jira/get_user")
async def get_user_details(
    request: Request,
    # current_user: dict = Depends(get_current_user),  # App authentication
    db: Session = Depends(get_db)
):
    """Get Jira user details using stored token"""
    try:
        # Get Jira token from Authorization header
        auth_header = request.headers.get("Jira-Authorization")
        if not auth_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Jira token not provided"
            )
            
        # Validate Jira token
        jira_token = auth_header.split("Bearer ")[1]
        jira_payload = validate_jira_token(jira_token)
        
        # Use the access token stored in the Jira JWT
        user_info = await get_jira_user_info(jira_payload["jira_access_token"])
        
        return {
            "message": "Jira user details retrieved",
            "jira_email": user_info.get("email"),
            "account_id": user_info.get("account_id")
        }
        
    except Exception as e:
        logger.error(f"Failed to get Jira user details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Jira user details: {str(e)}"
        )



   