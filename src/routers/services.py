from fastapi import File, UploadFile, Form, Depends, APIRouter, HTTPException, status, Request, Security, BackgroundTasks
from fastapi.responses import HTMLResponse
import os
from utils.token_generation import token_validator
from utils.chat_history import save_chat_history, delete_chat_history, get_user_chat_history_details,get_single_user_chat_history
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
    file: UploadFile = File(...), 
    db: Session = Depends(get_db)
):
    file_content = b''
    try:
        while chunk := await file.read(1024*1024):
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

    file_path = os.path.join(UPLOADS_DIR, file.filename)
    try:
        with open(file_path, "wb") as f:
            f.write(file_content)
            logger.info(f"completed saving the file")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"failed to save the file: {str(e)}")
    try:
        logger.info(f"data from dependency with 2 tokens: {current_token}")
        user_doc = {
            "user_id": current_token["regular_login_token"]["id"],
            "document_path": file_path
        }
        logger.info(f"user doc dict: {user_doc}")
        response = await user_documents(doc_data=user_doc, db=db)
        logger.info(f"completed the document upload")
        
        # # Create a unique task ID
        # task_id = str(uuid.uuid4())
        
        # # Initialize task status
        # task_status[task_id] = {
        #     "status": "pending",
        #     "current_step": 0,
        #     "step_progress": 0,
        #     "message": "Starting document processing"
        # }
        
        # # Start background processing
        # background_tasks.add_task(
        #     process_document_task,
        #     file_path=response["document_path"],
        #     user_id=response["user_id"],
        #     document_id=response["document_id"],
        #     task_id=task_id
        # )
        
        # return {"message": "Document upload successful", "task_id": task_id}
        
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error occured please try again {str(e)}")
    print("near document extract")
    document_data = await ExtractText(document_path=response["document_path"],user_id=response["user_id"],document_id=response["document_id"]).parse_document()
    full_data = []
    for i in range(len(document_data)):
        full_data.append(document_data[i]["data"])
    raw_requirements =  "\n".join(
                        str(item["data"]) if isinstance(item, dict) else str(item) for item in full_data
                                )
    
    # Agent for analyzing and providing the response in PDF
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
    # sample_data = {
    #     agent.generate_pdf_report("project_scoping_report.pdf")
        return {"message": "request completed", "document_id": response["document_id"], "title":" dummy title for now"}
    except Exception as e:
        return {"Critical Error":{str(e)}}
    
    #     }
    # }
    # try:
    #     requirements = agent.analyze_input(sample_data["input"])
    #     ambiguities = agent.identify_ambiguities()
    #     tech_stack = agent.generate_tech_recommendations()
    

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
async def conversation_with_doc(request:Request,current_user = Depends(token_validator), db:Session=Depends(get_db)):
    chat_context = request.json()
    print(f"chat_context: {chat_context}")
    return {"message": "this is from LLM chat responding to user question regarding the document and its recommendataion: this needs to be implemented"}
    # return ProjectScopingAgent.chat_with_doc(context=)