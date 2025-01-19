import models
from models import get_db
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

class UserCreationError(Exception):
    pass

async def get_or_create_user(user_data:dict,provider:str, db:Session):
    if not user_data:
        raise UserCreationError(f"unable to retrive login details")
    if provider == "local":
        user_local = db.query(models.User).filter(models.User.email == user_data["email"]).first()
        if not user_local:
            user_local = models.User(
                email = user_data["email"],
                name = user_data["name"],
                picture = "None",
                provider=provider
            )
            try:
                db.add(user_local)
                db.commit()
                db.refresh(user_local)
            except SQLAlchemyError as e:
                db.rollback() 
                raise UserCreationError(f"unable to create details: {str(e)}")
            return user_local
    if provider != "local":
        user_oauth = db.query(models.User).filter(models.User.oauth_id == user_data["id"]).first()
        if not user_oauth:
            user_oauth = models.User(
                oauth_id = user_data["id"], 
                email = user_data["email"],
                name = user_data["name"],
                picture = user_data["picture"],
                provider = provider
            )
            try:
                db.add(user_oauth)
                db.commit()
                db.refresh(user_oauth)
            except SQLAlchemyError as e:
                db.rollback() 
                raise UserCreationError(f"unable to create details {str(e)}")
        return user_oauth