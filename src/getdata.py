import os
import docx
from PyPDF2 import PdfReader
import re
import pandas as pd
import asyncio
from langchain_community.document_loaders import PyPDFLoader

class ExtractText:
    def __init__(self, document_path:str = None, url=None):
        self.document_path = document_path
        self.url = url
        
    def extract_docx(self):
        doc = docx.Document(self.document_path)
        text = []
        for para in doc.paragraphs:
            text.append(para.text)
        return "\n".join(text)
    
    async def process_pdf_with_structure(self):
        
        loader = PyPDFLoader(self.document_path)
        pages = []

        # Use async for to lazily load pages
        async for page in loader.alazy_load():
            pages.append(page)

        # Print the first page's metadata and content
        if pages:
            pag = []
            for i in range(len(pages)):
                pag.append(pages[i].page_content)
            return "".join(pag)
        else:
            return "No pages were loaded."

# Run the async function

    
    def extract_pdf(self):
        reader = PdfReader(self.document_path)
        text = []

        for page in reader.pages:
            text.append(page.extract_text())
        raw_text = "\n".join(text)
        cleaned_text = re.sub(r'\n\s*\n','\n', raw_text)
        cleaned_text = re.sub(r'(?<!\n)\n(?!\n)', ' ', cleaned_text)
        cleaned_text = re.sub(r'\s+', ' ', cleaned_text)
        return cleaned_text.strip()
    
    def extract_txt(self):
        with open(self.document_path, "rb") as f:
            return f.readlines()
    
    def extract_csv(self):
        try:
            data = pd.read_csv(filepath_or_buffer=self.document_path)
        except Exception as e:
            return e
        
        return {"data":data}
    
    def parse_document(self):
        if not os.path.exists(self.document_path):
            return "File doesn't exist. Provide valid file path"
        
        file_extension = os.path.splitext(self.document_path)[-1].lower()

        if file_extension == ".docx":
            return self.extract_docx()
        elif file_extension == ".pdf":
            # return self.extract_pdf()
            return asyncio.run(self.process_pdf_with_structure())
        elif file_extension == ".txt":
            return self.extract_txt()
        elif file_extension == ".csv":
            return self.extract_csv()
        else:
            return "unsupported file type. Please provide .docx or .pdf file"
    

        


