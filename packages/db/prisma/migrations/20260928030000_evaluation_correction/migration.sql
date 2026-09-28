-- Reopen the same evaluation for correction without a new form response.
ALTER TYPE "EvaluationStatus" ADD VALUE IF NOT EXISTS 'EN_CORRECCION';

DO $$ BEGIN
  CREATE TYPE "CorrectionScope" AS ENUM ('PARCIAL', 'COMPLETA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "evaluation_report" ADD COLUMN IF NOT EXISTS "correction_scope" "CorrectionScope";
ALTER TABLE "evaluation_report" ADD COLUMN IF NOT EXISTS "flagged_sections" JSONB;
ALTER TABLE "evaluation_report" ADD COLUMN IF NOT EXISTS "correction_requested_at" TIMESTAMP(3);
ALTER TABLE "evaluation_report" ADD COLUMN IF NOT EXISTS "correction_saved_at" TIMESTAMP(3);

ALTER TABLE "report_review" ADD COLUMN IF NOT EXISTS "correction_scope" "CorrectionScope";
ALTER TABLE "report_review" ADD COLUMN IF NOT EXISTS "flagged_sections" JSONB;
