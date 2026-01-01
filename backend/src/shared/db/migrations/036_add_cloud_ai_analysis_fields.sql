-- Add AI analysis fields to cloud_access_logs
-- These support Claude AI analysis of cloud investigation data

ALTER TABLE cloud_access_logs
ADD COLUMN IF NOT EXISTS ai_confidence VARCHAR(20) DEFAULT NULL;

ALTER TABLE cloud_access_logs
ADD COLUMN IF NOT EXISTS affected_resources JSONB DEFAULT '[]';

-- Add index for querying by AI confidence
CREATE INDEX IF NOT EXISTS idx_cloud_access_logs_ai_confidence
ON cloud_access_logs(ai_confidence)
WHERE ai_confidence IS NOT NULL;
