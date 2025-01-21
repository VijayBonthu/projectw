import models
from models import get_db
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from p_model_type import registration_login
from sqlalchemy import and_

class UserCreationError(Exception):
    pass

async def get_or_create_user(user_data:registration_login,provider:str, db:Session):
    # {'id': '106124317363210854486', 'email': '@gmail.com', 'verified_email': True, 'name': 'full name', 'given_name': 'first name', 'family_name': 'last name', 'picture': 'https://lh3.googleusercontent.com/a/ACg8ocKaB3SgzhN1nS059s7D1re6z0eTnG6wtUDl5A695G-8Akhvq5GD'}
    if not user_data:
        raise UserCreationError(f"unable to retrive login details")
    try:
        query = db.query(models.User).filter(and_(models.User.email_address == user_data["email"], models.User.provider == provider))
        user_details = query.first()

    except SQLAlchemyError as e:
        raise Exception(f"unable to connect to DB {e}")
    if not user_details:
        user_details = models.User(
            oauth_id = user_data["id"], 
            email_address = user_data["email"],
            first_name = user_data["given_name"],
            last_name = user_data["family_name"],
            verified_email = user_data["verified_email"],
            full_name = user_data["name"],
            picture = user_data["picture"],
            provider = provider
        )
        try:
            db.add(user_details)
            db.commit()
            db.refresh(user_details)
        except SQLAlchemyError as e:
            db.rollback() 
            raise UserCreationError(f"unable to create details: {str(e)}")
        return user_details
    return user_details