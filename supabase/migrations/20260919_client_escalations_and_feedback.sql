-- Migration: Client Escalations & Branch Quality Feedback System
-- Table to manage client complaints, SLA breaches, milestone delays, and service quality escalations

CREATE TABLE IF NOT EXISTS branch_client_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    assigned_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    logged_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('sla_breach', 'milestone_delay', 'quality_complaint', 'fee_dispute', 'unresponsive_staff', 'general')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    status TEXT NOT NULL CHECK (status IN ('open', 'investigating', 'resolved', 'escalated_to_hq')) DEFAULT 'open',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    feedback_channel TEXT NOT NULL CHECK (feedback_channel IN ('walk_in', 'whatsapp', 'phone_call', 'portal_review', 'manager_flag')) DEFAULT 'walk_in',
    resolution_notes TEXT,
    resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    rating NUMERIC CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast branch-scoped querying
CREATE INDEX IF NOT EXISTS idx_branch_client_escalations_branch ON branch_client_escalations(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_client_escalations_status ON branch_client_escalations(status);
CREATE INDEX IF NOT EXISTS idx_branch_client_escalations_severity ON branch_client_escalations(severity);

-- Enable RLS
ALTER TABLE branch_client_escalations ENABLE ROW LEVEL SECURITY;

-- Select policy: Branch staff, managers, and admins can view their branch's escalations
CREATE POLICY "Users can view escalations in their branch or if admin"
ON branch_client_escalations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND (p.role = 'admin' OR p.branch_id = branch_client_escalations.branch_id)
    )
);

-- Insert policy: Authenticated staff and managers can log escalations
CREATE POLICY "Authenticated users can create escalations"
ON branch_client_escalations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update policy: Branch managers, admins, or assigned staff can update escalations
CREATE POLICY "Managers and admins can update escalations"
ON branch_client_escalations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND (p.role = 'admin' OR (p.is_manager = true AND p.branch_id = branch_client_escalations.branch_id) OR branch_client_escalations.assigned_staff_id = p.id OR branch_client_escalations.logged_by = p.id)
    )
);

-- Delete policy: Only branch managers or admins can delete
CREATE POLICY "Managers and admins can delete escalations"
ON branch_client_escalations FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND (p.role = 'admin' OR (p.is_manager = true AND p.branch_id = branch_client_escalations.branch_id))
    )
);
