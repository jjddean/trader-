CREATE TABLE companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  hs_codes TEXT, -- JSON array
  description TEXT,
  products TEXT, -- JSON array
  employee_count INTEGER,
  revenue_gbp INTEGER,
  verified BOOLEAN DEFAULT 0,
  embedding_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_country ON companies(country_code);
CREATE INDEX idx_companies_hs ON companies(hs_codes);
CREATE INDEX idx_companies_verified ON companies(verified);
