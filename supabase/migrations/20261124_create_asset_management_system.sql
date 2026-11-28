-- ==============================================================================
-- OSBIC IT & Asset Management System (ITAM) Migration
-- 1. assets
-- 2. asset_kits (Workstation Bundles / Desk Kits)
-- 3. asset_kit_items
-- 4. asset_assignments (Historical Handover & Custody Log)
-- ==============================================================================

-- 1. Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('desktop_pc', 'laptop', 'monitor', 'peripheral', 'sim_mobile', 'pki_token', 'access_card', 'furniture', 'other')),
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'assigned', 'in_repair', 'damaged_lost', 'decommissioned')),
    condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'needs_repair', 'damaged')),
    purchase_date DATE,
    purchase_cost NUMERIC(10,3) DEFAULT 0,
    warranty_expiry DATE,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create asset_kits table (Workstation Bundles)
CREATE TABLE IF NOT EXISTS public.asset_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create asset_kit_items table
CREATE TABLE IF NOT EXISTS public.asset_kit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_id UUID NOT NULL REFERENCES public.asset_kits(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (kit_id, asset_id)
);

-- 4. Create asset_assignments table (Historical Log / Custody Records)
CREATE TABLE IF NOT EXISTS public.asset_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_code TEXT NOT NULL UNIQUE,
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    kit_id UUID REFERENCES public.asset_kits(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    returned_at TIMESTAMPTZ,
    returned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    handover_condition TEXT NOT NULL DEFAULT 'good' CHECK (handover_condition IN ('new', 'good', 'fair', 'damaged')),
    return_condition TEXT CHECK (return_condition IN ('new', 'good', 'fair', 'damaged')),
    employee_acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledgment_notes TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_branch_id ON public.assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_employee ON public.asset_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_asset ON public.asset_assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_active ON public.asset_assignments(asset_id) WHERE returned_at IS NULL;

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies for authenticated users
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assets' AND policyname = 'Allow auth access to assets') THEN
        CREATE POLICY "Allow auth access to assets" ON public.assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asset_kits' AND policyname = 'Allow auth access to asset_kits') THEN
        CREATE POLICY "Allow auth access to asset_kits" ON public.asset_kits FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asset_kit_items' AND policyname = 'Allow auth access to asset_kit_items') THEN
        CREATE POLICY "Allow auth access to asset_kit_items" ON public.asset_kit_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'asset_assignments' AND policyname = 'Allow auth access to asset_assignments') THEN
        CREATE POLICY "Allow auth access to asset_assignments" ON public.asset_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
