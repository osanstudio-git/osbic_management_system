-- Migration: Add payment_date to job_payments to track exact date amount was received
-- When employees record payments in the Employee Portal (or backdate them), this date is saved and shown in Accounts Portal.

ALTER TABLE public.job_payments
  ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE;

-- Optional index for faster filtering and sorting by received date
CREATE INDEX IF NOT EXISTS idx_job_payments_payment_date ON public.job_payments(payment_date);

COMMENT ON COLUMN public.job_payments.payment_date IS 'Actual date when the amount was received by employee / deposited by client';

