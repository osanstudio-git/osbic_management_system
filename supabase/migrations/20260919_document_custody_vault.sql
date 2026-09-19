-- 20260919_document_custody_vault.sql
-- Physical Document & Asset Custody Vault for Branch Operations (CRs, Stamps, Passports, PKI Tokens)

CREATE TABLE IF NOT EXISTS public.branch_document_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL DEFAULT 'cr_certificate' CHECK (
        document_type IN (
            'cr_certificate', 
            'company_stamp', 
            'passport', 
            'civil_id', 
            'tenancy_contract', 
            'pki_token', 
            'power_of_attorney', 
            'municipal_license',
            'other'
        )
    ),
    document_name TEXT NOT NULL,
    document_identifier TEXT,
    client_name TEXT NOT NULL,
    contact_phone TEXT,
    locker_location TEXT,
    status TEXT NOT NULL DEFAULT 'in_vault' CHECK (
        status IN ('in_vault', 'with_pro', 'returned_to_client', 'archived')
    ),
    current_holder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    checkout_reason TEXT,
    checkout_time TIMESTAMPTZ,
    expected_return_date DATE,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ DEFAULT now(),
    returned_to_client_at TIMESTAMPTZ,
    returned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branch_document_vault_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_item_id UUID NOT NULL REFERENCES public.branch_document_vault(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (
        action IN (
            'received_in_vault', 
            'checked_out_to_pro', 
            'returned_to_vault', 
            'handed_over_to_client', 
            'note_added'
        )
    ),
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recipient_holder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.branch_document_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_document_vault_logs ENABLE ROW LEVEL SECURITY;

-- Policies for branch_document_vault
DROP POLICY IF EXISTS "Authenticated users can read branch_document_vault" ON public.branch_document_vault;
CREATE POLICY "Authenticated users can read branch_document_vault"
ON public.branch_document_vault FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert branch_document_vault" ON public.branch_document_vault;
CREATE POLICY "Authenticated users can insert branch_document_vault"
ON public.branch_document_vault FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update branch_document_vault" ON public.branch_document_vault;
CREATE POLICY "Authenticated users can update branch_document_vault"
ON public.branch_document_vault FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete branch_document_vault" ON public.branch_document_vault;
CREATE POLICY "Authenticated users can delete branch_document_vault"
ON public.branch_document_vault FOR DELETE TO authenticated USING (true);

-- Policies for branch_document_vault_logs
DROP POLICY IF EXISTS "Authenticated users can read branch_document_vault_logs" ON public.branch_document_vault_logs;
CREATE POLICY "Authenticated users can read branch_document_vault_logs"
ON public.branch_document_vault_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert branch_document_vault_logs" ON public.branch_document_vault_logs;
CREATE POLICY "Authenticated users can insert branch_document_vault_logs"
ON public.branch_document_vault_logs FOR INSERT TO authenticated WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
