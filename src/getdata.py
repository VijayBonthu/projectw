import os
import docx
import pandas as pd
from docx.document import Document as DocxDocument
from docx.oxml.ns import qn
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from typing import List, Dict
import fitz 
from pptx import Presentation
import camelot


class ExtractText:
    def __init__(self, document_path:str = None, url=None):
        self.document_path = document_path
        self.url = url
        os.makedirs("uploads_images", exist_ok=True)

    @staticmethod
    def iter_block_items(parent):
        """
        Iterate through paragraphs, tables, and other block elements in document order.
        """

        if isinstance(parent, DocxDocument):
            parent_elm = parent.element.body
        else:
            parent_elm = parent

        for child in parent_elm.iterchildren():
            if isinstance(child, CT_P):
                yield docx.text.paragraph.Paragraph(child, parent)
            elif isinstance(child, CT_Tbl):
                yield docx.table.Table(child, parent)


    async def extract_docx(self):
        doc = docx.Document(self.document_path)
        content = []
        image_count = 0
        os.makedirs("uploads_images", exist_ok=True)

        # Iterate through all elements in the document
        for block in self.__class__.iter_block_items(doc):
            # Process paragraphs
            if isinstance(block, docx.text.paragraph.Paragraph):
                text = block.text.strip()
                if text:
                    content.append({"type": "text", "data": text})

                # Extract images from the paragraph's XML
                for elem in block._element.iter():
                    if elem.tag.endswith('drawing'):
                        # Check for inline images
                        inline = elem.find('.//' + qn('wp:inline'))
                        if inline is not None:
                            blip = inline.find('.//' + qn('a:blip'))
                            if blip is not None:
                                image_id = blip.get(qn('r:embed'))
                                if image_id:
                                    image_part = doc.part.related_parts[image_id]
                                    image_bytes = image_part.blob
                                    image_count += 1
                                    image_path = os.path.join("uploads_images", f"image_{image_count}.png")
                                    with open(image_path, "wb") as f:
                                        f.write(image_bytes)
                                    content.append({"type": "image", "data": image_path})

                        # Check for floating images (anchored)
                        anchor = elem.find('.//' + qn('wp:anchor'))
                        if anchor is not None:
                            blip = anchor.find('.//' + qn('a:blip'))
                            if blip is not None:
                                image_id = blip.get(qn('r:embed'))
                                if image_id:
                                    image_part = doc.part.related_parts[image_id]
                                    image_bytes = image_part.blob
                                    image_count += 1
                                    image_path = os.path.join("uploads_images", f"image_{image_count}.png")
                                    with open(image_path, "wb") as f:
                                        f.write(image_bytes)
                                    content.append({"type": "image", "data": image_path})

            # Process tables
            elif isinstance(block, docx.table.Table):
                table_data = []
                for row in block.rows:
                    row_data = [cell.text.strip() for cell in row.cells]
                    table_data.append(row_data)
                content.append({"type": "table", "data": table_data})

        return content
    

    async def process_pdf_with_structure(self):
        content = []
        image_count = 0

        with fitz.open(self.document_path) as doc:
            for page_num, page in enumerate(doc):
                # Extract text
                text = page.get_text().strip()
                if text:
                    content.append({"type": "text", "data": text})

                # Extract images
                image_list = page.get_images(full=True)
                for img_index, img in enumerate(image_list):
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    image_path = os.path.join("uploads_images", f"pdf_image_{page_num+1}_{img_index+1}.{image_ext}")
                    with open(image_path, "wb") as f:
                        f.write(image_bytes)
                    content.append({"type": "image", "data": image_path})

                # Extract tables (requires Camelot/Tabula; here's a basic approach)
                try:
                    tables = camelot.read_pdf(self.document_path, pages=str(page_num+1))
                    for table in tables:
                        content.append({"type": "table", "data": table.df.values.tolist()})
                except ImportError:
                    pass

        return content
    
    async def process_excel(self) -> List[Dict]:
        content = []
        xls = pd.ExcelFile(self.document_path)
        for sheet_name in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet_name)
            if not df.empty:
                content.append({
                    "type": "table",
                    "data": {
                        "sheet_name": sheet_name,
                        "rows": df.fillna("").values.tolist()
                    }
                })
        return content
    
    async def _process_txt(self) -> List[Dict]:
        with open(self.document_path, "r", encoding="utf-8") as f:
            text = f.read().strip()
        return [{"type": "text", "data": text}]
    
    async def _process_pptx(self) -> List[Dict]:
        content = []
        image_count = 0
        prs = Presentation(self.document_path)

        for slide_num, slide in enumerate(prs.slides):
            # Extract text from slide shapes
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    content.append({"type": "text", "data": shape.text.strip()})

                # Extract images
                if shape.shape_type == 13:  # 13 = picture type
                    image = shape.image
                    image_bytes = image.blob
                    image_ext = image.ext
                    image_path = os.path.join("uploads_images", f"pptx_image_{slide_num+1}_{image_count+1}.{image_ext}")
                    with open(image_path, "wb") as f:
                        f.write(image_bytes)
                    content.append({"type": "image", "data": image_path})
                    image_count += 1

                # Extract tables
                if shape.has_table:
                    table = shape.table
                    table_data = []
                    for row in table.rows:
                        row_data = [cell.text.strip() for cell in row.cells]
                        table_data.append(row_data)
                    content.append({"type": "table", "data": table_data})

        return content

    
    async def extract_csv(self):
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
            return self.process_pdf_with_structure()
        elif file_extension == ".txt":
            return self.extract_txt()
        elif file_extension == ".csv":
            return self.extract_csv()
        elif file_extension == ".xlsx":
            return self.process_excel()
        elif file_extension == ".pptx":
            return self._process_pptx()
        else:
            return "unsupported file type. Please provide .docx or .pdf file"
    

