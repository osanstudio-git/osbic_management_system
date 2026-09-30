-- Migration: Add proof_url to job_payments table for payment proof screenshots

ALTER TABLE job_payments
  ADD COLUMN IF NOT EXISTS proof_url TEXT;

COMMENT ON COLUMN job_payments.proof_url IS 'URL or file path to payment proof screenshot (bank transfer receipt, POS slip, etc.) uploaded by sales';
