-- Optional case filters. Null applies to every request origin and establishment type.
ALTER TABLE "form_template" ADD COLUMN "applies_to" JSONB;
ALTER TABLE "h1" ADD COLUMN "applies_to" JSONB;
