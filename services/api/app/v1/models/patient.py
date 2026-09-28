from sqlalchemy import Column, Integer, String, Date, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import Session
from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(50), nullable=False, unique=True, index=True)
    phone_number = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False
    )   

    @classmethod
    def get_patient(cls, db: Session, patient_id: int):
        return db.query(cls).filter(cls.id == patient_id).first()

    @classmethod
    def get_all(cls, db: Session):
        return db.query(cls).all()