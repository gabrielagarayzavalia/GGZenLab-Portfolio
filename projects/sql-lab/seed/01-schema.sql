-- LAB-01: schema de práctica (tema job search, análogo conceptual a Job Hunter)

CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES companies(id),
  title VARCHAR(200) NOT NULL,
  modality VARCHAR(40),
  match_percent INT CHECK (match_percent BETWEEN 0 AND 100)
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  job_id INT NOT NULL REFERENCES jobs(id),
  status VARCHAR(40) NOT NULL,
  applied_at DATE
);

CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_match ON jobs(match_percent DESC);
CREATE INDEX idx_applications_job ON applications(job_id);
