from sqlalchemy import Column, Integer, String, Date, TIMESTAMP, ForeignKey, func
from app.database import Base


class Organization(Base):
    __tablename__ = "organization"

    orgid = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True, index=True)
    email = Column(String(50), nullable=False, unique=True, index=True)
    address = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False
    )