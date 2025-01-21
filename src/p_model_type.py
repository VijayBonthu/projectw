from pydantic import BaseModel
from typing import Optional

class UploadDoc(BaseModel):
    expected_time:str = None
    list_of_developers:Optional[list[str]] = None

class registration_login(BaseModel):
    email:str
    oauth_id:str = None
    first_name:str
    last_name:str
    verified_email:bool=False
    name:str
    picture:str = None
    provider:str

# class registration_oauth_google(BaseModel):
#     email_address:str
#     oauth_id:str
#     first_name:str
#     last_name:str
#     verified_email:bool
#     name:str
#     picture:str = None
#     provider:str