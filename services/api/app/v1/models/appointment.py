from sqlalchemy import Column, Integer, String, Date, TIMESTAMP, ForeignKey, func
from app.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(20), nullable=False)
    scheduled_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    transcript_id = Column(Integer, ForeignKey("transcripts.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), nullable=False)
    updated_at = Column(
        TIMESTAMP, server_default=func.now(), onupdate=func.now(), nullable=False
    )
