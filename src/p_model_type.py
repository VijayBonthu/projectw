from pydantic import BaseModel
from typing import Optional

class UploadDoc(BaseModel):
    expected_time:str = None
    list_of_developers:Optional[list[str]] = None