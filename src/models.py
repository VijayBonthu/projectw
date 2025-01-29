from sqlalchemy import Column, String, Integer, create_engine, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings
import uuid
from sqlalchemy.sql.sqltypes import TIMESTAMP
from sqlalchemy.sql.expression import text

Base = declarative_base()
engine = create_engine(settings.DATABASE_URL)
sessionlocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = sessionlocal()
    try:
        yield db
    finally:
        db.close()

class User(Base):
    __tablename__= "users"
    user_id = Column(String, primary_key=True, nullable=False, index=True,default=lambda: str(uuid.uuid4()))
    oauth_id = Column(String,unique=True, index=True)
    email_address = Column(String, nullable=False, unique=True, index=True)
    full_name = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    verified_email = Column(Boolean, nullable=False)
    picture = Column(String) 
    provider = Column(String, nullable=False) 
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default= text('now()'))

class LoginDetails(Base):
    __tablename__="login_details"
    id = Column(Integer, primary_key=True, nullable=False, index=True)
    user_id = Column(String,ForeignKey(User.user_id), nullable=False,index=True, unique=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default= text("now()"))

class UserDocuments(Base):
    __tablename__ = "user_documents"
    document_id = Column(String, primary_key=True, nullable=False,index=True,default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey(User.user_id), nullable=False, index=True)
    document_path = Column(String, nullable=False)
    active_tag = Column(Boolean, nullable=False, default=text("True"))
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=text("now()"))