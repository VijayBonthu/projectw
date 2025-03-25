from fastapi import  Depends, APIRouter, HTTPException,Header
from utils.token_generation import token_validator, validate_token_incoming_requests
from sqlalchemy.orm import Session
from models import get_db
from utils.integrations import Integrations

router = APIRouter()

@router.get("/jira/get_issues")
async def get_jira_issues(jira_authorization: str = Header(None),current_user = Depends(token_validator), db:Session=Depends(get_db)):
    
    if not jira_authorization:
        raise HTTPException(status_code=401, detail="Jira authorization header is required")
    payload = validate_token_incoming_requests(jira_authorization)
    issues = Integrations(payload['jira_access_token']).get_all_issues()
    return {"issues": issues}

@router.get("/jira/download_attachments")
async def download_jira_attachements(jira_authorization: str = Header(None), issue_key:str = None, current_user = Depends(token_validator), download_file_name:str = None, attachment_id=None):
    if not jira_authorization:
        raise HTTPException(status_code=401, detail="Jira authorization header is required")  
    if not issue_key:
        raise HTTPException(status_code=401, detail="issue key is required")  
    issues = Integrations(jira_authorization).download_jira_attachments(issue_key=issue_key, download_file_name=download_file_name, attachment_id=attachment_id)
    return {"issues": issues}

