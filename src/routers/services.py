from fastapi import File, UploadFile, Form, Depends, APIRouter, HTTPException, status, Request, Security, BackgroundTasks
from fastapi.responses import HTMLResponse
import os
from utils.token_generation import token_validator
from utils.chat_history import save_chat_history, delete_chat_history, get_user_chat_history_details,get_single_user_chat_history, save_chat_with_doc
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
from p_model_type import JiraTokenRequest, ChatHistoryDetails
import asyncio
import uuid
from datetime import datetime
from utils.document_save import get_s3_client,ensure_bucket_exists, upload_document_s3

router = APIRouter()
# accessllm = AccessLLM(api_key=os.getenv("OPENAI_CHATGPT"))
UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True) 

security = HTTPBearer()

# In-memory task storage (replace with database in production)
task_status = {}

async def process_document_task(file_path: str, user_id: str, document_id: str, task_id: str):
    try:
        # Initial steps remain the same until document extraction
        task_status[task_id] = {
            "status": "in_progress",
            "current_step": 0,
            "step_progress": 0,
            "message": "Reading document"
        }
        
        # Step 1: Extract text from document
        logger.info(f"file_path: {file_path}, user_id: {user_id}, document_id: {document_id}, task_id: {task_id}")
        task_status[task_id]["step_progress"] = 50
        document_data = await ExtractText(document_path=file_path, user_id=user_id, document_id=document_id).parse_document()
        task_status[task_id]["step_progress"] = 100
        logger.info(f"document_reading is complete")
        
        # Step 2: Process and combine document data
        
        task_status[task_id]["current_step"] = 1
        task_status[task_id]["step_progress"] = 0
        task_status[task_id]["message"] = "Processing content"
        logger.info(f"Processing the document started: {task_status[task_id]['message']}")
        
        full_data = []
        for i in range(len(document_data)):
            full_data.append(document_data[i]["data"])
        
        raw_requirements = "\n".join(
            str(item["data"]) if isinstance(item, dict) else str(item) for item in full_data
        )
        task_status[task_id]["step_progress"] = 100
        logger.info(f"Processing the document complete: {task_status[task_id]['message']}")
        
        # Step 3: Initialize ProjectScopingAgent and analyze requirements
        task_status[task_id]["current_step"] = 2
        task_status[task_id]["step_progress"] = 0
        task_status[task_id]["message"] = "Analyzing requirements"
        logger.info(f"Processing the analysing input started: {task_status[task_id]['message']}")
        raw_data = {
                "input": {
                    raw_requirements
                }
            }
        agent = ProjectScopingAgent()
        requirements = agent.analyze_input(raw_data["input"])
        task_status[task_id]["step_progress"] = 100
        logger.info(f"Processing the analysing input complete: {task_status[task_id]['message']}")
        
        # Step 4: Identify ambiguities 
        task_status[task_id]["current_step"] = 3 
        task_status[task_id]["step_progress"] = 0
        task_status[task_id]["message"] = "Identifying potential issues"
        logger.info(f"Processing the potential issues started: {task_status[task_id]['message']}")
        
        ambiguities = agent.identify_ambiguities()
        task_status[task_id]["step_progress"] = 100
        logger.info(f"Processing the potential issues complete: {task_status[task_id]['message']}")

        
        # Step 5: Generate tech recommendations
        task_status[task_id]["current_step"] = 4
        task_status[task_id]["step_progress"] = 0
        task_status[task_id]["message"] = "Generating technical recommendations"
        logger.info(f"Processing the tech recommendations started: {task_status[task_id]['message']}")
        
        tech_stack = agent.generate_tech_recommendations()
        task_status[task_id]["step_progress"] = 50
        
        # Generate PDF report
        pdf_filename = f"project_scoping_report_{document_id}.pdf"
        logger.info(f"final document is getting created: {pdf_filename}")
        agent.generate_pdf_report(pdf_filename)
        task_status[task_id]["step_progress"] = 100
        logger.info(f"Processing the tech recommendations started: {task_status[task_id]['message']}")
        
        # Set task as completed with comprehensive result
        task_status[task_id]["status"] = "completed"
        task_status[task_id]["result"] = {
            "summary": "Document processed successfully.",
            "document_id": document_id,
            "requirements": requirements,
            "ambiguities": ambiguities,
            "tech_stack": tech_stack,
            "pdf_report": pdf_filename,
            "chat_context": {
                "project_definition": requirements.get("project_definition", {}),
                "tech_recommendations": tech_stack.get("primary_stack", {}),
                "key_questions": ambiguities.get("questions", [])
            }
        }
        
        logger.info(f"Task {task_id} completed successfully")
        logger.info(f"task_status[task_id]['result']")
        
    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        task_status[task_id]["status"] = "error"
        task_status[task_id]["message"] = str(e)


@router.post("/upload/")
async def upload_file(
    background_tasks: BackgroundTasks,
    current_token: dict = Depends(token_validator), 
    file: list[UploadFile] = File(...), 
    db: Session = Depends(get_db)
):
    entire_doc_details = []
    for content_document in file:
        file_content = b''
        try:
            while chunk := await content_document.read(1024*1024):
                file_content += chunk
            logger.info(f"reading the file content")
            if len(file_content) > eval(settings.FILE_SIZE):
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File size exceed 10MB limit")
            logger.info("complete the file size check and reading < 50 MB")

        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"file processing failed: {str(e)}")
        
        if not file_content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
        logger.info(f"completed reading the file")

        file_uuid = str(uuid.uuid4())
        file_extension = content_document.filename.split(".")[-1]
        document_name = content_document.filename.split(".")[0]
        os.makedirs(f"{UPLOADS_DIR}/{current_token['regular_login_token']['id']}", exist_ok=True) 
        

        file_path = os.path.join(f"{UPLOADS_DIR}/{current_token['regular_login_token']['id']}", f"{document_name}_{file_uuid}.{file_extension}")
        try:
            with open(file_path, "wb") as f:
                f.write(file_content)
                logger.info(f"completed saving the file")
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"failed to save the file: {str(e)}")
        
        try:
            with open(file_path, 'rb') as file_obj:
                s3 = get_s3_client()
                response = ensure_bucket_exists(s3_client=s3, bucket_name= settings.S3_BUCKET_NAME)
                s3_file_path  = f"{UPLOADS_DIR}/{current_token['regular_login_token']['id']}/{document_name}_{file_uuid}.{file_extension}"
                logger.info(f"ensuring s3 is active with respose{response}")
                if response['bucket_status'] == 'exists':
                    document_id = upload_document_s3(s3_client=s3, file_obj=file_obj, current_document_path=s3_file_path,content_type='application/pdf',bucket_name=settings.S3_BUCKET_NAME)
        except HTTPException as e:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"failed to upload document to s3 since there is no bucket")
        


        try:
            user_doc = {
                "user_id": current_token["regular_login_token"]["id"],
                "document_path": s3_file_path
            }
            logger.info(f"user doc dict: {user_doc}")
            response = await user_documents(doc_data=user_doc, db=db)
            logger.info(f"completed the document upload")
            document_data = await ExtractText(document_path=response["document_path"],user_id=response["user_id"],document_id=response["document_id"]).parse_document()
            entire_doc_details.append(document_data)
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error occured please try again {str(e)}")
    logger.info(f"entire_doc_details: {entire_doc_details}")
        
    full_data = []
    for content_data in entire_doc_details:
        for i in range(len(content_data)):
            full_data.append(document_data[i]["data"]) 
        raw_requirements =  "\n".join(
                            str(item["data"]) if isinstance(item, dict) else str(item) for item in full_data
                                    )
    # return {"message": raw_requirements, "document_id": response["document_id"], "title":" dummy title for now"}
    # Agent for analyzing and providing the response in PDF
    agent = ProjectScopingAgent()
    
    # Sample data must include the correct structure
    sample_data = {
        "document": raw_requirements
    }
    try:
        requirements, title = await agent.analyze_input(sample_data)
        
        

        return {"message": requirements, "document_id": response["document_id"], "title":title}
    except Exception as e:
        return {"Critical Error":{str(e)}}
    

@router.get("/task_status/{task_id}")
async def get_task_status(
    task_id: str,
    current_token: dict = Depends(token_validator)
):
    """Get the status of a processing task"""
    logger.info(f"Checking status for task_id: {task_id}")
    logger.info(f"Available task IDs: {list(task_status.keys())}")
    
    if task_id not in task_status:
        # Check if the task was completed and has a result
        completed_task = next((t for t in task_status.values() 
                              if t.get("status") == "completed" and 
                                 t.get("result", {}).get("document_id") == task_id), None)
        
        if completed_task:
            logger.info(f"Found completed task with matching document_id: {task_id}")
            return completed_task
            
        # If we still can't find it, return a more helpful error
        logger.error(f"Task not found: {task_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task not found. Available tasks: {len(task_status)}"
        )
    
    logger.info(f"Returning status for task_id: {task_id}")
    return task_status[task_id]

@router.post("/jira/get_user")
async def get_user_details(
    request: Request,
    current_user: dict = Depends(token_validator),  # App authentication
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
        jira_payload = token_validator(request=jira_token)
        print(f"jira_payload: {jira_payload}")
        
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

@router.get("/status-page/{task_id}", response_class=HTMLResponse)
async def task_status_page(task_id: str, token: str = None):
    """
    Renders an HTML page that polls for task status and communicates with parent window.
    This bypasses ngrok security restrictions.
    """
    # Validate token (simplified for brevity - implement proper validation)
    if not token:
        return HTMLResponse(content="Unauthorized", status_code=401)
    
    # Create HTML page that polls for status and communicates with parent
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Processing Status</title>
        <script>
            const taskId = "{task_id}";
            const token = "{token}";
            const apiUrl = "http://localhost:8080";  // Updated to correct port
            
            async function pollStatus() {{
                try {{
                    console.log("Polling status for task:", taskId);
                    const response = await fetch(`${{apiUrl}}/task_status/${{taskId}}`, {{
                        headers: {{
                            'Authorization': `Bearer ${{token}}`
                        }}
                    }});
                    
                    if (!response.ok) {{
                        throw new Error(`Status polling failed: ${{response.status}}`);
                    }}
                    
                    const data = await response.json();
                    console.log("Status update:", data);
                    
                    // Send data to parent window
                    window.opener.postMessage({{
                        type: 'task_status_update',
                        ...data
                    }}, "*");
                    
                    // Continue polling if not complete
                    if (data.status !== 'completed' && data.status !== 'error') {{
                        setTimeout(pollStatus, 1000);
                    }}
                }} catch (error) {{
                    console.error("Error polling status:", error);
                    
                    // Send error to parent
                    window.opener.postMessage({{
                        type: 'task_status_update',
                        status: 'error',
                        message: `Status polling failed: ${{error.message}}`
                    }}, "*");
                }}
            }}
            
            // Start polling when page loads
            window.onload = function() {{
                console.log("Status page loaded, starting polling");
                pollStatus();
            }};
        </script>
    </head>
    <body style="background-color: #f0f0f0; padding: 20px; font-family: Arial, sans-serif;">
        <h1>Processing your document...</h1>
        <p>This window will close automatically when processing is complete.</p>
        <p>Task ID: {task_id}</p>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

@router.post('/chat')
async def add_chat_history(request: ChatHistoryDetails,db:Session=Depends(get_db)):
    try:
        chat = request.model_dump()
        logger.info(f"got the details in api ,saving the chat history for user: {chat['user_id']}")
        save_chat = await save_chat_history(chat=chat, db=db)
        print(f"save_chat: {save_chat}")
        return {"status":save_chat["status"], "chat_history_id":save_chat["chat_history_id"], "user_id":save_chat["user_id"],"message":save_chat["message"]}
    except Exception as e:
        logger.error(f"error occured while saving the chat history for user: {chat['user_id']}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"details are missing: {str(e)}")
    

@router.delete('/chat/{chat_id}')
async def chat_delete(chat_id:str,db:Session=Depends(get_db),current_user:dict=Depends(token_validator)):
    try:
        
        deleted_details = await delete_chat_history(user_id = current_user["regular_login_token"]["id"], chat_history_id=chat_id, db=db)
        logger.info(f"deleted the chat history for user: {current_user['regular_login_token']['id']}, chat_id: {chat_id}")
        return {"status":deleted_details["status"]}
    except Exception as e:
        logger.error(f"error occured while deleting the chat history for user: {current_user['regular_login_token']['id']}, error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Provided incorrect Details") 
        
@router.get('/chat')
async def get_user_chat_history(current_user = Depends(token_validator), db:Session=Depends(get_db)):
    chat_records = await get_user_chat_history_details(user_id=current_user["regular_login_token"]["id"], db=db)
    return {"user_details": chat_records}

@router.get('/chat/{chat_history_id}')
async def get_user_chat_history_by_id(chat_history_id:str,current_user = Depends(token_validator), db:Session=Depends(get_db)):
    single_record = await get_single_user_chat_history(user_id=current_user["regular_login_token"]["id"], chat_history_id=chat_history_id, db=db)
    return {"user_details": single_record}

@router.post('/chat-with-doc')
async def conversation_with_doc(request:ChatHistoryDetails,current_user = Depends(token_validator), db:Session=Depends(get_db)):
    """
    Selected context is used to chat with the LLM

    Args:
    request: ChatHistoryDetails,
    current_user: dict,
    db: Session,
    sample received request
    {
        'chat_history_id': 'xxx', 
        'user_id': 'xxx', 
        'document_id': 'xxx', 
        'message': [
        {'role': 'user', 'content': 'xxx', 'timestamp': '2025-03-22T05:48:47.559Z'}, 
        {'role': 'assistant', 'content': 'xxx', 'timestamp': '2025-03-22T05:48:47.935Z'}, 
        {'role': 'user', 'content': 'xxx', 'timestamp': '2025-03-22T05:49:18.340Z'}
        ], 
        'title': ' dummy title for now'
    }

    Returns:
    Dict: LLM response to user question regarding the document and its recommendataion
    """
    try:
        if current_user["regular_login_token"]["id"] == request.user_id:
            chat_context = request.model_dump()
            #parse message for LLM and send it for query
            print(f"chat_context: {chat_context['message']}")
            LLM_response = await ProjectScopingAgent.chat_with_doc(context=chat_context["message"])
            return {"message": f"{LLM_response['message']}"}
        else:
            raise HTTPException(status_code=400, detail=f"User ID mismatch")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat-with-doc: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error")
    finally:
        chat_context["message"].append({"role": "assistant", "content": LLM_response, "timestamp": datetime.now().isoformat()})
        await save_chat_with_doc(chat_context=chat_context, db=db)

    