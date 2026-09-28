import os
from datetime import datetime, timedelta, date
from uuid import uuid4
from random import choice, randint
from faker import Faker
from app.database import SessionLocal
from app.v2.models.provider import ProviderCRUD
from app.v2.models.patient import PatientCRUD, PatientCreate
from app.v2.models.note import MedicalNoteCRUD, MedicalNoteCreate, NoteType, NoteStatus
from app.v2.models.sections import NoteSectionCRUD, NoteSectionCreate, SectionType
from app.v2.models.feedback import FeedbackCRUD, FeedbackCreate, FeedbackType

# Default values
DEFAULT_NUM_PATIENTS = 5
DEFAULT_NOTES_PER_PATIENT = 3
DEFAULT_SECTIONS_PER_NOTE = 4
DEFAULT_FEEDBACKS = 3

fake = Faker()

# Helper to simulate a provider object for CRUDs
class ProviderStub:
    def __init__(self, iUserId):
        self.iUserId = iUserId

def seed_provider_data(provider_id: int, num_patients=DEFAULT_NUM_PATIENTS, notes_per_patient=DEFAULT_NOTES_PER_PATIENT, sections_per_note=DEFAULT_SECTIONS_PER_NOTE, num_feedbacks=DEFAULT_FEEDBACKS):
    db = SessionLocal()
    provider_stub = ProviderStub(provider_id)
    patient_crud = PatientCRUD(db)
    note_crud = MedicalNoteCRUD(db)
    section_crud = NoteSectionCRUD(db)
    feedback_crud = FeedbackCRUD(db)

    # Seed patients
    patients = []
    for _ in range(num_patients):
        patient = PatientCreate(
            first_name=fake.first_name(),
            last_name=fake.last_name(),
            date_of_birth=fake.date_of_birth(minimum_age=18, maximum_age=90),
            gender=choice(["Male", "Female", "Other"])
        )
        db_patient = patient_crud.create_patient(patient, provider_stub)
        patients.append(db_patient)

    # Seed notes and sections
    for patient in patients:
        for _ in range(notes_per_patient):
            note = MedicalNoteCreate(
                job_id=uuid4(),
                patient_id=patient.patient_id,
                provider_id=provider_id,
                visit_date=fake.date_time_between(start_date="-2y", end_date="now"),
                note_type=choice(list(NoteType)),
                note_title=fake.sentence(nb_words=6),
                chief_complaint=fake.sentence(nb_words=10),
                status=choice(list(NoteStatus)),
                is_deleted=False
            )
            db_note = note_crud.create_note(note)

            # Seed sections for each note
            section_types = list(SectionType)
            for i in range(sections_per_note):
                section = NoteSectionCreate(
                    note_id=db_note.note_id,
                    section_type=section_types[i % len(section_types)],
                    section_name=section_types[i % len(section_types)].value.title(),
                    content=fake.paragraph(nb_sentences=3),
                    sequence_number=i,
                    is_like=False,
                    is_dislike=False
                )
                section_crud.create_section(section)

    # Seed feedbacks
    for _ in range(num_feedbacks):
        feedback = FeedbackCreate(
            subject=fake.sentence(nb_words=5),
            content=fake.paragraph(nb_sentences=2),
            feedback_type=choice(list(FeedbackType)),
            rating=randint(1, 5)
        )
        feedback_crud.create_feedback(feedback, provider_stub)

    db.close()
    print(f"Seeded {num_patients} patients, {num_patients * notes_per_patient} notes, {num_patients * notes_per_patient * sections_per_note} sections, and {num_feedbacks} feedbacks for provider {provider_id}.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Seed fake data for a specific provider.")
    parser.add_argument("provider_id", type=int, help="Provider ID to seed data for")
    parser.add_argument("--patients", type=int, default=DEFAULT_NUM_PATIENTS, help="Number of patients to create")
    parser.add_argument("--notes", type=int, default=DEFAULT_NOTES_PER_PATIENT, help="Notes per patient")
    parser.add_argument("--sections", type=int, default=DEFAULT_SECTIONS_PER_NOTE, help="Sections per note")
    parser.add_argument("--feedbacks", type=int, default=DEFAULT_FEEDBACKS, help="Number of feedbacks")
    args = parser.parse_args()
    seed_provider_data(args.provider_id, args.patients, args.notes, args.sections, args.feedbacks) 