# app/crud/org.py
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.v1.models.org import Organization
from app.v1.schemas.org import OrgCreate, OrgUpdate
from typing import List
from datetime import datetime


# > get org by ID
def get(db: Session, org_id: int):
    return db.query(Organization).filter(Organization.orgid == org_id).first()


# > get org by email
def get_by_email(db: Session, email: str):
    return db.query(Organization).filter(Organization.email == email).first()


# > create org
def create(db: Session, org: OrgCreate):
    db_org = Organization(
        name=org.name,
        email=org.email,
        address=org.address,
        phone_number=org.phone_number,
        created_at=func.now(),
        updated_at=func.now(),
    )
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    return db_org


# > update org
def update(db: Session, db_org: Organization, org: OrgUpdate):
    org_data = org.model_dump(exclude_unset=True)
    for key, value in org_data.items():
        setattr(db_org, key, value)
    db_org.updated_at = func.now()
    db.commit()
    db.refresh(db_org)
    return db_org


# > delete org
def delete(db: Session, org_id: int):
    db_org = db.query(Organization).filter(Organization.id == org_id).first()
    if db_org:
        db.delete(db_org)
        db.commit()
        return db_org


# ! Admin CRUD Operations


# > Get all Users
def get_all(db: Session) -> List[Organization]:
    return db.query(Organization).all()


# > Create Orgs in Bulk
def create_bulk(db: Session, orgs: List[OrgCreate]):
    emails = [org.email for org in orgs]
    existing_orgs = db.query(Organization).filter(Organization.email.in_(emails)).all()
    existing_emails = {org.email for org in existing_orgs}
    new_orgs = [org for org in orgs if org.email not in existing_emails]
    if not new_orgs:
        return "All orgs already exist"
    db_orgs = [
        Organization(
            name=org.name,
            email=org.email,
            address=org.address,
            phone_number=org.phone_number,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        for org in new_orgs
    ]
    db.add_all(db_orgs)
    db.commit()
    for db_org in db_orgs:
        db.refresh(db_org)
    return db_orgs
