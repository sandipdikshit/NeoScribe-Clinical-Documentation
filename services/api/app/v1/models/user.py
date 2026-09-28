from sqlalchemy import Column, Integer, String, Date, TIMESTAMP, ForeignKey, func
from app.database import Base
from fastapi import HTTPException

from typing import List, Optional
from sqlalchemy.orm import Session
from app.v1.schemas.user import UserCreate, UserUpdate
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False, unique=True, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(50), nullable=False, unique=True, index=True)
    phone_number = Column(String(20), nullable=True)
    practice_type = Column(String(50), nullable=True)
    orgid = Column(Integer, ForeignKey("organization.orgid"), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False)

    # > Get all Users
    @classmethod
    def get_all(cls, db: Session) -> List['User']:
        return db.query(cls).all()

    @classmethod
    # > Get User by ID
    def get(cls, db: Session, user_id: int):
        return db.query(cls).filter(cls.id == user_id).first()

    @classmethod
    # > Get user by Email
    def get_by_email(cls, db: Session, email: str):
        return db.query(cls).filter(cls.email == email).first()

    @classmethod
    # > Create Users in Bulk
    def create_bulk(cls, db: Session, users: List[UserCreate]):
        emails = [user.email for user in users]
        existing_users = db.query(cls).filter(cls.email.in_(emails)).all()
        existing_emails = {user.email for user in existing_users}
        new_users = [user for user in users if user.email not in existing_emails]

        if not new_users:
            raise HTTPException(status_code=400, detail="All users already exist")
        db_users = [
            cls(
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                phone_number=user.phone_number,
                practice_type=user.practice_type,
                orgid=user.orgid,
                date_of_birth=user.date_of_birth,
                gender=user.gender,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )for user in new_users
        ]
        db.add_all(db_users)
        db.commit()
        for db_user in db_users:
            db.refresh(db_user)
        return db_users

    # > Create User
    def create(self, db: Session, user: UserCreate):
        self.username=user.username
        self.first_name=user.first_name
        self.last_name=user.last_name
        self.email=user.email
        self.phone_number=user.phone_number
        self.practice_type=user.practice_type
        self.orgid=user.orgid 
        self.date_of_birth=user.date_of_birth
        self.gender=user.gender
        self.created_at=datetime.now()
        self.updated_at=datetime.now()
        db.add(self)
        db.commit()
        db.refresh(self)
        return self


    # > Update User
    def update(self, db: Session, user: UserUpdate):
        user_data = user.model_dump(exclude_unset=True)
        for key, value in user_data.items():
            setattr(self, key, value)
        self.updated_at = datetime.now()
        db.commit()
        db.refresh(self)
        return self

    # > Delete User
    def delete(self, db: Session):
        db.delete(self)
        db.commit()
        return self



