
--- Grant all privileges to the user
GRANT ALL PRIVILEGES ON DATABASE neoscribedev TO neoscribedevuser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO neoscribedevuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO neoscribedevuser;


--- Insert sample data into Transcripts table
INSERT INTO transcripts (status, audio_name, audio_duration, audio_filetype, soap_note, text_analytics, created_at, updated_at)
VALUES
('completed', 'audio1.mp3', 120.5, 'mp3', 'Patient reports mild headache.', 'word_count: 5, sentiment: neutral', NOW(), NOW()),
('completed', 'audio2.mp3', 95.0, 'mp3', 'Patient has a history of hypertension.', 'word_count: 6, sentiment: neutral', NOW(), NOW()),
('completed', 'audio3.mp3', 150.0, 'mp3', 'Patient is experiencing chest pain.', 'word_count: 5, sentiment: negative', NOW(), NOW()),
('completed', 'audio4.mp3', 180.0, 'mp3', 'Patient denies any allergies.', 'word_count: 4, sentiment: neutral', NOW(), NOW()),
('completed', 'audio5.mp3', 200.0, 'mp3', 'Patient has been prescribed medication.', 'word_count: 5, sentiment: neutral', NOW(), NOW()),
('completed', 'audio6.mp3', 110.0, 'mp3', 'Patient is feeling better after treatment.', 'word_count: 6, sentiment: positive', NOW(), NOW()),
('completed', 'audio7.mp3', 130.0, 'mp3', 'Patient complains of back pain.', 'word_count: 4, sentiment: negative', NOW(), NOW()),
('completed', 'audio8.mp3', 140.0, 'mp3', 'Patient has a follow-up appointment next week.', 'word_count: 7, sentiment: neutral', NOW(), NOW()),
('completed', 'audio9.mp3', 160.0, 'mp3', 'Patient is advised to rest and hydrate.', 'word_count: 6, sentiment: neutral', NOW(), NOW()),
('completed', 'audio10.mp3', 170.0, 'mp3', 'Patient reports no significant changes in symptoms.', 'word_count: 7, sentiment: neutral', NOW(), NOW());