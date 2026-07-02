INSERT INTO companies (name) VALUES
  ('YO IT Consulting'),
  ('Scale Army Careers'),
  ('EPAM Systems'),
  ('Globant');

INSERT INTO jobs (company_id, title, modality, match_percent) VALUES
  (1, 'Neuroscience QA Lead - Remote', 'Remote', 85),
  (2, 'QA Automation Engineer', 'Remote', 85),
  (3, 'Senior Automation Tester in Java', 'Hybrid', 80),
  (4, 'QA Analyst Manual', 'On-site', 72),
  (2, 'Manual QA Tester', 'Remote', 68);

INSERT INTO applications (job_id, status, applied_at) VALUES
  (1, 'applied', '2026-06-28'),
  (2, 'not_applied', NULL),
  (3, 'not_selected', '2026-06-20');
