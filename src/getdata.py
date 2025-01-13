import os
import docx
from PyPDF2 import PdfReader
import re

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
    
    def extract_pdf(self):
        reader = PdfReader(self.document_path)
        text = []
        for page in reader.pages:
            text.append(page.extract_text())
        raw_text = "\n".join(text)
        # print(raw_text)

        cleaned_text = re.sub(r'\n\s*\n','\n', raw_text)
        cleaned_text = re.sub(r'(?<!\n)\n(?!\n)', ' ', cleaned_text)
        cleaned_text = re.sub(r'\s+', ' ', cleaned_text)
        return cleaned_text.strip()
    
    
    def parse_document(self):
        if not os.path.exists(self.document_path):
            return "File doesn't exist. Provide valid file path"
        
        file_extension = os.path.splitext(self.document_path)[-1].lower()

        if file_extension == ".docx":
            return self.extract_docx()
        elif file_extension == ".pdf":
            return self.extract_pdf()
        else:
            return "unsupported file type. Please provide .docx or .pdf file"
    
x = ExtractText(document_path="C:\\Users\\minat\\OneDrive\\Desktop\\startup_ideas.pdf").parse_document()
print(x)
        


