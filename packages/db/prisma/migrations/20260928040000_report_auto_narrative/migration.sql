-- Snapshot of the narrative last generated from field answers.
-- Fields that still match it are refreshed; hand-edited fields are kept.
ALTER TABLE "evaluation_report" ADD COLUMN IF NOT EXISTS "auto_narrative" JSONB;
