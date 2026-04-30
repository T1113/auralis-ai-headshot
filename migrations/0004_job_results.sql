CREATE TABLE IF NOT EXISTS job_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  label TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  object_key TEXT,
  source_upload_id TEXT,
  image_url TEXT,
  mime_type TEXT,
  file_name TEXT,
  quality_score INTEGER,
  diagnostic_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (source_upload_id) REFERENCES uploads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_results_job_id ON job_results(job_id, created_at);
