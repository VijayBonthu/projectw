from fastapi import FastAPI, File, UploadFile
import os
from getdata import ExtractText
import uvicorn
app = FastAPI()

UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

@app.get("/")
async def home():
    return "Hello World"

@app.post("/upload/")
async def upload_file(file:UploadFile = File(...)):
    file_path = os.path.join(UPLOADS_DIR, file.filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    content = ExtractText(document_path=file_path).parse_document()
    return content

    
if __name__ == "__main__":
    uvicorn.run("main:app", port=8080, log_level='info', reload=True)