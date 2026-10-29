-- ==============================================================================
-- Fix: Guarantee Global Uniqueness for Invoice and Quotation Numbers
-- Prevents duplicate key value violates unique constraint "invoices_invoice_number_key"
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    c_code TEXT;
    c_seq TEXT;
    prefix TEXT;
    seq_number INT := 1;
    candidate TEXT;
    pad_len INT := 2;
BEGIN
    -- 1. Determine document prefix based on context
    IF (NEW.metadata->>'proposal_type' = 'b2b_proposal' OR NEW.b2b_partner_id IS NOT NULL) THEN
        prefix := 'B2B-QT-' || to_char(CURRENT_DATE, 'YYYY') || '-';
        pad_len := 4;
    ELSIF NEW.client_id IS NOT NULL THEN
        SELECT client_code INTO c_code FROM public.profiles WHERE id = NEW.client_id;
        c_seq := right(regexp_replace(coalesce(c_code, ''), '[^0-9]', '', 'g'), 4);
        IF c_seq = '' OR length(c_seq) < 4 THEN
            c_seq := '0000';
        END IF;
        IF NEW.type = 'quotation' THEN
            prefix := 'QT-' || c_seq || '-';
        ELSE
            prefix := 'INV-' || c_seq || '-';
        END IF;
        pad_len := 2;
    ELSIF NEW.lead_id IS NOT NULL THEN
        SELECT lead_code INTO c_code FROM public.leads WHERE id = NEW.lead_id;
        c_seq := right(regexp_replace(coalesce(c_code, ''), '[^0-9]', '', 'g'), 4);
        IF c_seq = '' OR length(c_seq) < 4 THEN
            c_seq := '0000';
        END IF;
        IF NEW.type = 'quotation' THEN
            prefix := 'QT-' || c_seq || '-';
        ELSE
            prefix := 'INV-' || c_seq || '-';
        END IF;
        pad_len := 2;
    ELSE
        -- Fallback for direct walk-ins or unlinked quotations/invoices
        IF NEW.type = 'quotation' THEN
            prefix := 'QT-' || to_char(CURRENT_DATE, 'YYYY') || '-';
        ELSE
            prefix := 'INV-' || to_char(CURRENT_DATE, 'YYYY') || '-';
        END IF;
        pad_len := 4;
    END IF;

    -- 2. Prevent concurrent race condition for this prefix
    PERFORM pg_advisory_xact_lock(hashtext('invoice_' || prefix));

    -- 3. Find the maximum existing sequence number globally across the invoices table
    SELECT COALESCE(
        MAX(NULLIF(regexp_replace(invoice_number, '^' || prefix, ''), '')::INT),
        0
    ) + 1 INTO seq_number
    FROM public.invoices
    WHERE invoice_number LIKE prefix || '%'
      AND regexp_replace(invoice_number, '^' || prefix, '') ~ '^[0-9]+$';

    -- 4. Unconditional collision check: loop until a free number is found
    candidate := prefix || lpad(seq_number::TEXT, pad_len, '0');
    WHILE EXISTS (SELECT 1 FROM public.invoices WHERE invoice_number = candidate) LOOP
        seq_number := seq_number + 1;
        candidate := prefix || lpad(seq_number::TEXT, pad_len, '0');
    END LOOP;

    NEW.invoice_number := candidate;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
