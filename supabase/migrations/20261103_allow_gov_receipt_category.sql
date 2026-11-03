-- =============================================================================
-- Migration: Allow 'gov_receipt' in chk_job_service_docs_category constraint
-- =============================================================================

ALTER TABLE public.job_service_documents
  DROP CONSTRAINT IF EXISTS chk_job_service_docs_category;

ALTER TABLE public.job_service_documents
  ADD CONSTRAINT chk_job_service_docs_category
  CHECK (document_category IN ('input', 'output', 'gov_receipt'));
