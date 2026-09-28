-- Phase 1: Add currency support to invoices table
-- Adds currency code (default OMR) and an exchange rate snapshot stored at save time.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'OMR',
  ADD COLUMN IF NOT EXISTS exchange_rate_to_omr NUMERIC(12, 6) DEFAULT 1.000000;

-- Add comment for documentation
COMMENT ON COLUMN invoices.currency IS 'ISO currency code: OMR, SAR, AED, QAR, KWD, BHD';
COMMENT ON COLUMN invoices.exchange_rate_to_omr IS 'How many units of selected currency equals 1 OMR at time of save (frozen snapshot)';
