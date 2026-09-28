from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db


import app.v1.crud.org as crud
import app.v1.schemas.org as schema

router = APIRouter()


# > Create Org
@router.post("/", response_model=schema.Org)
def create_org(org: schema.OrgCreate, db: Session = Depends(get_db)):
    db_user = crud.get_by_email(db, email=org.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create(db=db, org=org)


# > Get org by ID
@router.get("/{org_id}", response_model=schema.Org)
def read_org(org_id: int, db: Session = Depends(get_db)):
    db_org = crud.get(db, org_id=org_id)
    if db_org is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return db_org


# > Update org
@router.put("/{org_id}", response_model=schema.Org)
def update_org(org_id: int, org: schema.OrgUpdate, db: Session = Depends(get_db)):
    db_org = crud.get(db, id=org_id)
    if db_org is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return crud.update(db=db, db_org=db_org, org=org)


# > Delete org
@router.delete("/{org_id}", response_model=schema.Org)
def delete_org(org_id: int, db: Session = Depends(get_db)):
    db_user = crud.get(db, org_id=org_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return crud.delete(db=db, org_id=org_id)


# ! Admin routes


# > Get All orgs
@router.get("/", response_model=List[schema.Org])
def read_orgs(db: Session = Depends(get_db)):
    users = crud.get_all(db)
    return users


# > Create Orgs in Bulk
@router.post("/bulk", response_model=List[schema.Org])
def create_bulk_orgs(orgs: List[schema.OrgCreate], db: Session = Depends(get_db)):
    created_orgs = crud.create_bulk(db=db, orgs=orgs)
    return created_orgs
