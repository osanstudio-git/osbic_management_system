-- -------------------------------------------------------------------
-- OSBIC: Update Walk-in Sales Payment Modes & Add Mobile Payment Number
-- Run this in Supabase SQL Editor
-- -------------------------------------------------------------------

-- 1. Drop existing CHECK constraint on payment_mode and replace with new options
DO $$
BEGIN
  -- Drop check constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'walkin_sales_payment_mode_check'
  ) THEN
    ALTER TABLE public.walkin_sales DROP CONSTRAINT walkin_sales_payment_mode_check;
  END IF;
END $$;

-- Add updated check constraint allowing cash, pos, card, bank_transfer, mobile_payment
ALTER TABLE public.walkin_sales 
  ADD CONSTRAINT walkin_sales_payment_mode_check 
  CHECK (payment_mode IN ('cash', 'pos', 'card', 'bank_transfer', 'mobile_payment'));

-- 2. Add payment_mobile_number column for Mobile Payment transactions
ALTER TABLE public.walkin_sales 
  ADD COLUMN IF NOT EXISTS payment_mobile_number TEXT;

-- 3. Also ensure job_payments table allows pos and mobile_payment in payment_method if constrained
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'job_payments_payment_method_check'
  ) THEN
    ALTER TABLE public.job_payments DROP CONSTRAINT job_payments_payment_method_check;
    ALTER TABLE public.job_payments ADD CONSTRAINT job_payments_payment_method_check
      CHECK (payment_method IN ('cash', 'pos', 'card', 'bank_transfer', 'mobile_payment', 'cheque', 'online'));
  END IF;
END $$;

-- 4. Verify result
SELECT 'walkin_sales payment modes updated successfully (added pos and mobile_payment with payment_mobile_number)' AS status;

