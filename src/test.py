# # from rich.console import Console
# # from rich.markdown import Markdown
# # import pandas as pd

# # text = {
# #   "content": "1. **High Level explanation of the entire project**\n   - The OBOOK project aims to develop an IT solution for National Competent Authorities (NCAs) to exchange financial instrument order data in compliance with MiFIR regulations. This involves creating a standardized and harmonized reporting format based on XSD (XML Schema Definition) which the NCAs will use to upload, transfer, and retrieve order book data through ESMA's EAMFT (European Securities and Markets Authority's Market Data Framework) system.\n   - Technologies to consider include:\n     - Cloud Technologies: Azure Data Lake, AWS S3 for file storage, GCP Cloud Storage.\n     - On-Premises Services: Local database servers for data processing, messaging systems for data exchange (e.g., RabbitMQ or Apache Kafka).\n   - The research provided by the client related to regulatory compliance (MiFIR) and existing standards (RTS 24) regarding order book data and file exchange.\n\n2. **List of Tasks/Steps**:\n   - **Task 1: Design XSD Schema for Order Book Data**\n     - Description: Create a detailed XSD schema to define the structure of order book data that NCAs will upload.\n     - Roles: Data Architect (1), Business Analyst (1)\n     - Estimated Time: 1 week\n   - **Task 2: Implement Data Exchange Mechanism**\n     - Description: Design and implement a file exchange mechanism for NCAs using ESMA's EAMFT system.\n     - Roles: Cloud Engineer (1), Developer (1), Business Analyst (1)\n     - Estimated Time: 2 weeks\n   - **Task 3: Develop Validation Rules for Data Files**\n     - Description: Create and implement validation rules for files to ensure compliance with the XSD schema.\n     - Roles: Developer (1), QA Engineer (1)\n     - Estimated Time: 1 week\n   - **Task 4: Setup Preliminary Checks in EAMFT System**\n     - Description: Implement pre-checks to validate incoming files based on sender, naming conventions, and size.\n     - Roles: Developer (1), QA Engineer (1)\n     - Estimated Time: 1 week\n   - **Task 5: Conduct Testing and Quality Assurance**\n     - Description: Perform end-to-end testing of the OBOOK solution to ensure compliance and performance.\n     - Roles: QA Engineer (2)\n     - Estimated Time: 1 week\n   - **Task 6: Documentation of the System**\n     - Description: Prepare functional and technical documentation for the OBOOK solution.\n     - Roles: Technical Writer (1), Business Analyst (1)\n     - Estimated Time: 1 week\n   - **Total Estimated Time: 7 weeks**\n\n3. **Ambiguity in Requirements**:\n   - There are several areas where further clarification is needed:\n     - Confirmation on the exact frequency of data submissions from NCAs.\n     - Understanding the retention period for the files within the ESMA system.\n     - Clarification regarding the specified format for the files if not using the harmonized reporting format.\n   - Questions to Clarify Requirements:\n     - What is the anticipated frequency of data submissions from NCAs? Are there specific timelines established?\n     - Could you provide more details on the expected retention policies for the files processed by the ESMA system?\n     - In instances where an NCA submits data in a non-standard format, will there be any conversion or additional processes involved, or must all submissions strictly adhere to the defined schema?\n     - What security measures or compliance requirements must be considered during the transfer of data between NCAs?\n     - Is there a need for user authentication and authorization in the EAMFT system for accessing data?"
# #     }
# # def display_text(text_dict):
# #     console = Console()
# #     content = text_dict.get("content", "")
    
# #     # Use Markdown to format and display the text
# #     # md = Markdown(content)

# #     # return console.print(md)
    
# #     with open("formated_document.txt", "w") as f:
# #         f.write(content)



    

# # # Call the function
# # display_text(text)


# from langchain_community.document_loaders import UnstructuredWordDocumentLoader
# from getdata import ExtractText
# import asyncio


# # def doc_lo(file_path):
# #   loader = UnstructuredWordDocumentLoader(file_path)
# #   documents = loader.load()
# #   print(documents)
# #   content = "\n".join([doc.page_content for doc in documents])
# #   return content

# file_path = "C:\\Users\\minat\\OneDrive\\Desktop\\projectw\\src\\uploads\\AIGS1003_Say_My_Name_Project_Report__Team_2 (2) (1) (1).docx"
# # x = doc_lo(file_path=file_path)
# # print(x)

# async def doc_loa(file_path):
#   return await ExtractText(file_path).parse_document()

# x = asyncio.run(doc_loa(file_path=file_path))
# print(x)


# import pandas as pd

# df = pd.read_excel("C:\\Users\\minat\\OneDrive\\Desktop\\New Microsoft Excel Worksheet.xlsx", header=None)
# print(df)
# df = df.iloc[:, 0].dropna().tolist() 
# print(df)
# batch_size = 2


# for i in range(0, len(df), batch_size):
#   df1 = df[i:i+batch_size]
#   file_name = f"c:\\Users\\minat\\OneDrive\\Desktop\\testing_documents\\move_{i//batch_size + 1}.txt"
#   with open(file_name, "w") as f:
#     for data in df1:
#       f.write(data+"\n")


from utils.token_generation import validate_token_incoming_requests
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFiMTQ2OTk3LWJhMzgtNDZmMS05OTk5LWJlZGZhNzFhNzQ3OSIsInZlcmlmaWVkX2VtYWlsIjpmYWxzZSwicHJvdmlkZXIiOiJMb2NhbCIsImVtYWlsIjoidmlqYXliaGFza2FyYm9udGh1QGdtYWlsLmNvbSIsImlhdCI6MTc0MTY0Mjc2MSwiZXhwIjoxNzQyMDc0NzYxfQ.SjZhR0NVe0Kl82Q-RKPtdE5ho0mpXijKLwa47Z9kh4s"

print(validate_token_incoming_requests(token=token))