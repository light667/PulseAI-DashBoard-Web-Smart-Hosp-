-- Seed services
INSERT INTO services (name) VALUES
('Cardiologie'),
('Chirurgie Générale'),
('Pédiatrie'),
('Gynécologie & Obstétrique'),
('Urgences'),
('Ophtalmologie'),
('Neurologie'),
('Orthopédie'),
('Dermatologie'),
('Psychiatrie'),
('Radiologie'),
('Laboratoire d''analyses'),
('Dentisterie'),
('ORL'),
('Médecine Générale')
ON CONFLICT DO NOTHING;
