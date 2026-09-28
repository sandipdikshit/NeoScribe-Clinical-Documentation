from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.v1.models.user import User
import app.v1.schemas.user as schema

router = APIRouter()


# > Create User
@router.post("/", response_model=schema.User)
def create_user(user: schema.UserCreate, db: Session = Depends(get_db)):
    db_user = User.get_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User()
    return new_user.create(db=db, user=user)


# > Get User by ID
@router.get("/{user_id}", response_model=schema.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    db_user = User.get(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user




# > Update User
@router.put("/{user_id}", response_model=schema.User)
def update_user(user_id: int, user: schema.UserUpdate, db: Session = Depends(get_db)):
    db_user =User.get(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user.update(db=db, user=user)


# > Delete User
@router.delete("/{user_id}", response_model=schema.User)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    db_user = User.get(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user.delete(db=db)


# ! Admin routes


# > Get All Users
@router.get("/", response_model=List[schema.User])
def read_users(db: Session = Depends(get_db)):
    users = User.get_all(db)
    return users


# > Create Users in Bulk
@router.post("/bulk", response_model=List[schema.User])
def create_bulk_users(users: List[schema.UserCreate], db: Session = Depends(get_db)):
    created_users = User.create_bulk(db=db, users=users)
    return created_users            
