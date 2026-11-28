import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export type AssetCategory = 
  | 'desktop_pc' 
  | 'laptop' 
  | 'monitor' 
  | 'peripheral' 
  | 'sim_mobile' 
  | 'pki_token' 
  | 'access_card' 
  | 'furniture' 
  | 'other';

export type AssetStatus = 
  | 'in_stock' 
  | 'assigned' 
  | 'in_repair' 
  | 'damaged_lost' 
  | 'decommissioned';

export type AssetCondition = 
  | 'new' 
  | 'good' 
  | 'fair' 
  | 'needs_repair' 
  | 'damaged';

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  branch_id: string | null;
  status: AssetStatus;
  condition: AssetCondition;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expiry: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  branch?: { id: string; name: string; code: string } | null;
  current_assignment?: {
    id: string;
    assignment_code: string;
    employee_id: string;
    assigned_at: string;
    handover_condition: string;
    employee_acknowledged: boolean;
    employee?: {
      id: string;
      full_name: string;
      employee_code?: string;
      department?: string;
      avatar_url?: string;
      phone?: string;
    } | null;
  } | null;
}

export interface AssetKit {
  id: string;
  kit_code: string;
  name: string;
  branch_id: string | null;
  description: string | null;
  created_at: string;
  items?: Asset[];
}

export interface AssetAssignment {
  id: string;
  assignment_code: string;
  asset_id: string;
  employee_id: string;
  kit_id: string | null;
  assigned_by: string | null;
  assigned_at: string;
  returned_at: string | null;
  returned_to: string | null;
  handover_condition: 'new' | 'good' | 'fair' | 'damaged';
  return_condition: 'new' | 'good' | 'fair' | 'damaged' | null;
  employee_acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledgment_notes: string | null;
  notes: string | null;
  created_at: string;
  asset?: Asset;
  employee?: {
    id: string;
    full_name: string;
    employee_code?: string;
    department?: string;
    avatar_url?: string;
  } | null;
  assigner?: {
    id: string;
    full_name: string;
  } | null;
}

export function generateAssetTag(category: AssetCategory, sequence: number = Math.floor(100 + Math.random() * 900)): string {
  const prefixMap: Record<AssetCategory, string> = {
    desktop_pc: 'AST-PC',
    laptop: 'AST-LAP',
    monitor: 'AST-MON',
    peripheral: 'AST-PER',
    sim_mobile: 'AST-SIM',
    pki_token: 'AST-PKI',
    access_card: 'AST-ACC',
    furniture: 'AST-FUR',
    other: 'AST-GEN'
  };
  const prefix = prefixMap[category] || 'AST-IT';
  return `${prefix}-${sequence}`;
}

// ─── Query: All Assets with Active Assignment ─────────────────────────────────
export function useAssets(params: {
  branchId?: string | null;
  status?: string;
  category?: string;
  search?: string;
} = {}) {
  const { branchId, status, category, search } = params;

  return useQuery({
    queryKey: ['assets_list', branchId || 'all', status || 'all', category || 'all', search || ''],
    queryFn: async (): Promise<Asset[]> => {
      let query = supabase
        .from('assets')
        .select(`
          *,
          branch:branches(id, name, code),
          assignments:asset_assignments(
            id,
            assignment_code,
            employee_id,
            assigned_at,
            handover_condition,
            employee_acknowledged,
            returned_at,
            employee:profiles!employee_id(id, full_name, employee_code, department, avatar_url, phone)
          )
        `)
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status as AssetStatus);
      }
      if (category && category !== 'all') {
        query = query.eq('category', category as AssetCategory);
      }

      const { data, error } = await query;
      if (error) throw error;

      let list = (data || []).map((row: any) => {
        const activeAssignment = (row.assignments || []).find((a: any) => !a.returned_at);
        return {
          ...row,
          current_assignment: activeAssignment || null
        } as Asset;
      });

      if (search && search.trim()) {
        const q = search.toLowerCase();
        list = list.filter(a => 
          a.asset_tag.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.brand && a.brand.toLowerCase().includes(q)) ||
          (a.model && a.model.toLowerCase().includes(q)) ||
          (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
          (a.current_assignment?.employee?.full_name && a.current_assignment.employee.full_name.toLowerCase().includes(q))
        );
      }

      return list;
    }
  });
}

// ─── Query: Employee Custody Assets ───────────────────────────────────────────
export function useEmployeeAssets(employeeId?: string | null) {
  return useQuery({
    queryKey: ['employee_assets', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<AssetAssignment[]> => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from('asset_assignments')
        .select(`
          *,
          asset:assets(
            id,
            asset_tag,
            name,
            category,
            brand,
            model,
            serial_number,
            status,
            condition,
            branch:branches(id, name, code)
          ),
          assigner:profiles!assigned_by(id, full_name)
        `)
        .eq('employee_id', employeeId)
        .is('returned_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AssetAssignment[];
    }
  });
}

// ─── Query: Workstation Bundles (Asset Kits) ──────────────────────────────────
export function useAssetKits(branchId?: string | null) {
  return useQuery({
    queryKey: ['asset_kits', branchId || 'all'],
    queryFn: async (): Promise<AssetKit[]> => {
      let query = supabase
        .from('asset_kits')
        .select(`
          *,
          kit_items:asset_kit_items(
            asset:assets(
              id,
              asset_tag,
              name,
              category,
              brand,
              model,
              serial_number,
              status,
              condition
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((k: any) => ({
        id: k.id,
        kit_code: k.kit_code,
        name: k.name,
        branch_id: k.branch_id,
        description: k.description,
        created_at: k.created_at,
        items: (k.kit_items || []).map((ki: any) => ki.asset).filter(Boolean)
      }));
    }
  });
}

// ─── Query: Complete Assignment Audit History ────────────────────────────────
export function useAssetAssignmentsHistory(params: {
  assetId?: string | null;
  employeeId?: string | null;
  limit?: number;
} = {}) {
  const { assetId, employeeId, limit = 100 } = params;

  return useQuery({
    queryKey: ['asset_assignments_history', assetId || 'all', employeeId || 'all'],
    queryFn: async (): Promise<AssetAssignment[]> => {
      let query = supabase
        .from('asset_assignments')
        .select(`
          *,
          asset:assets(id, asset_tag, name, category, serial_number, branch:branches(name)),
          employee:profiles!employee_id(id, full_name, employee_code, department, avatar_url),
          assigner:profiles!assigned_by(id, full_name)
        `)
        .order('assigned_at', { ascending: false })
        .limit(limit);

      if (assetId) {
        query = query.eq('asset_id', assetId);
      }
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AssetAssignment[];
    }
  });
}

// ─── Mutation: Create Asset ───────────────────────────────────────────────────
export function useCreateAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      asset_tag?: string;
      name: string;
      category: AssetCategory;
      brand?: string | null;
      model?: string | null;
      serial_number?: string | null;
      branch_id?: string | null;
      status?: AssetStatus;
      condition?: AssetCondition;
      purchase_date?: string | null;
      purchase_cost?: number | null;
      warranty_expiry?: string | null;
      notes?: string | null;
      created_by?: string | null;
    }) => {
      const tag = payload.asset_tag?.trim() || generateAssetTag(payload.category);

      const { data, error } = await supabase
        .from('assets')
        .insert({
          ...payload,
          asset_tag: tag,
          status: payload.status || 'in_stock',
          condition: payload.condition || 'good'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Asset created successfully');
      qc.invalidateQueries({ queryKey: ['assets_list'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create asset');
    }
  });
}

// ─── Mutation: Update Asset ───────────────────────────────────────────────────
export function useUpdateAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Asset> }) => {
      const { data, error } = await supabase
        .from('assets')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Asset updated');
      qc.invalidateQueries({ queryKey: ['assets_list'] });
      qc.invalidateQueries({ queryKey: ['employee_assets'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update asset');
    }
  });
}

// ─── Mutation: Assign Single Asset to Employee ────────────────────────────────
export function useAssignAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      asset_id: string;
      employee_id: string;
      assigned_by: string;
      handover_condition?: 'new' | 'good' | 'fair' | 'damaged';
      kit_id?: string | null;
      notes?: string | null;
    }) => {
      const logCode = `LOG-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

      // 1. Create active assignment record
      const { data: assignment, error: assignError } = await supabase
        .from('asset_assignments')
        .insert({
          assignment_code: logCode,
          asset_id: payload.asset_id,
          employee_id: payload.employee_id,
          assigned_by: payload.assigned_by,
          kit_id: payload.kit_id || null,
          handover_condition: payload.handover_condition || 'good',
          notes: payload.notes || null,
          employee_acknowledged: false,
          assigned_at: new Date().toISOString()
        })
        .select()
        .single();

      if (assignError) throw assignError;

      // 2. Mark asset as assigned
      const { error: assetError } = await supabase
        .from('assets')
        .update({
          status: 'assigned',
          condition: payload.handover_condition || 'good',
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.asset_id);

      if (assetError) throw assetError;
      return assignment;
    },
    onSuccess: () => {
      toast.success('Equipment assigned to employee');
      qc.invalidateQueries({ queryKey: ['assets_list'] });
      qc.invalidateQueries({ queryKey: ['employee_assets'] });
      qc.invalidateQueries({ queryKey: ['asset_assignments_history'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign equipment');
    }
  });
}

// ─── Mutation: Return Asset to Stock ──────────────────────────────────────────
export function useReturnAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      assignment_id: string;
      asset_id: string;
      returned_to: string;
      return_condition: 'new' | 'good' | 'fair' | 'damaged';
      target_status?: AssetStatus;
      notes?: string | null;
    }) => {
      // 1. Close assignment record
      const { error: assignError } = await supabase
        .from('asset_assignments')
        .update({
          returned_at: new Date().toISOString(),
          returned_to: payload.returned_to,
          return_condition: payload.return_condition,
          notes: payload.notes || null
        })
        .eq('id', payload.assignment_id);

      if (assignError) throw assignError;

      // 2. Update asset status and condition
      const targetStatus: AssetStatus = payload.target_status || 
        (payload.return_condition === 'damaged' ? 'damaged_lost' : 'in_stock');

      const targetCondition: AssetCondition = 
        payload.return_condition === 'damaged' ? 'damaged' : payload.return_condition;

      const { error: assetError } = await supabase
        .from('assets')
        .update({
          status: targetStatus,
          condition: targetCondition,
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.asset_id);

      if (assetError) throw assetError;
    },
    onSuccess: () => {
      toast.success('Equipment returned to stock');
      qc.invalidateQueries({ queryKey: ['assets_list'] });
      qc.invalidateQueries({ queryKey: ['employee_assets'] });
      qc.invalidateQueries({ queryKey: ['asset_assignments_history'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to process return');
    }
  });
}

// ─── Mutation: Swap Asset ─────────────────────────────────────────────────────
export function useSwapAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      old_assignment_id: string;
      old_asset_id: string;
      new_asset_id: string;
      employee_id: string;
      assigned_by: string;
      old_return_condition: 'new' | 'good' | 'fair' | 'damaged';
      old_target_status: AssetStatus;
      new_handover_condition: 'new' | 'good' | 'fair' | 'damaged';
      reason?: string;
    }) => {
      // 1. Return old asset
      const { error: closeOldErr } = await supabase
        .from('asset_assignments')
        .update({
          returned_at: new Date().toISOString(),
          returned_to: payload.assigned_by,
          return_condition: payload.old_return_condition,
          notes: `Swapped for replacement. Reason: ${payload.reason || 'Not specified'}`
        })
        .eq('id', payload.old_assignment_id);

      if (closeOldErr) throw closeOldErr;

      await supabase
        .from('assets')
        .update({
          status: payload.old_target_status,
          condition: payload.old_return_condition === 'damaged' ? 'damaged' : payload.old_return_condition,
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.old_asset_id);

      // 2. Assign replacement asset
      const logCode = `LOG-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
      const { error: newAssignErr } = await supabase
        .from('asset_assignments')
        .insert({
          assignment_code: logCode,
          asset_id: payload.new_asset_id,
          employee_id: payload.employee_id,
          assigned_by: payload.assigned_by,
          handover_condition: payload.new_handover_condition,
          notes: `Replacement equipment swapped into service.`,
          employee_acknowledged: false,
          assigned_at: new Date().toISOString()
        });

      if (newAssignErr) throw newAssignErr;

      await supabase
        .from('assets')
        .update({
          status: 'assigned',
          condition: payload.new_handover_condition,
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.new_asset_id);
    },
    onSuccess: () => {
      toast.success('Equipment swapped successfully');
      qc.invalidateQueries({ queryKey: ['assets_list'] });
      qc.invalidateQueries({ queryKey: ['employee_assets'] });
      qc.invalidateQueries({ queryKey: ['asset_assignments_history'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Swap failed');
    }
  });
}

// ─── Mutation: Create Workstation Desk Kit ─────────────────────────────────────
export function useCreateKit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      kit_code?: string;
      branch_id?: string | null;
      description?: string | null;
      asset_ids: string[];
      created_by?: string | null;
    }) => {
      const code = payload.kit_code?.trim() || `KIT-DESK-${Math.floor(10 + Math.random() * 90)}`;

      // 1. Create kit
      const { data: kit, error: kitErr } = await supabase
        .from('asset_kits')
        .insert({
          kit_code: code,
          name: payload.name.trim(),
          branch_id: payload.branch_id || null,
          description: payload.description || null,
          created_by: payload.created_by || null
        })
        .select()
        .single();

      if (kitErr) throw kitErr;

      // 2. Link items
      if (payload.asset_ids.length > 0) {
        const itemRows = payload.asset_ids.map(asset_id => ({
          kit_id: kit.id,
          asset_id
        }));

        const { error: itemsErr } = await supabase
          .from('asset_kit_items')
          .insert(itemRows);

        if (itemsErr) throw itemsErr;
      }

      return kit;
    },
    onSuccess: () => {
      toast.success('Workstation kit created');
      qc.invalidateQueries({ queryKey: ['asset_kits'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create kit');
    }
  });
}

// ─── Mutation: Assign Complete Workstation Kit ─────────────────────────────────
export function useAssignKit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      kit_id: string;
      asset_ids: string[];
      employee_id: string;
      assigned_by: string;
      handover_condition?: 'new' | 'good' | 'fair' | 'damaged';
      notes?: string | null;
    }) => {
      const now = new Date().toISOString();

      for (const assetId of payload.asset_ids) {
        const logCode = `LOG-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

        await supabase
          .from('asset_assignments')
          .insert({
            assignment_code: logCode,
            asset_id: assetId,
            employee_id: payload.employee_id,
            kit_id: payload.kit_id,
            assigned_by: payload.assigned_by,
            handover_condition: payload.handover_condition || 'good',
            notes: payload.notes || 'Assigned as part of workstation kit bundle',
            employee_acknowledged: false,
            assigned_at: now
          });

        await supabase
          .from('assets')
          .update({
            status: 'assigned',
            condition: payload.handover_condition || 'good',
            updated_at: now
          })
          .eq('id', assetId);
      }
    },
    onSuccess: () => {
      toast.success('Complete workstation kit assigned to employee');
      qc.invalidateQueries({ queryKey: ['assets_list'] });
      qc.invalidateQueries({ queryKey: ['asset_kits'] });
      qc.invalidateQueries({ queryKey: ['employee_assets'] });
      qc.invalidateQueries({ queryKey: ['asset_assignments_history'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to assign kit');
    }
  });
}

// ─── Mutation: Employee Acknowledge Custody ────────────────────────────────────
export function useAcknowledgeAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      assignment_id: string;
      notes?: string | null;
    }) => {
      const { error } = await supabase
        .from('asset_assignments')
        .update({
          employee_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledgment_notes: payload.notes || null
        })
        .eq('id', payload.assignment_id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Equipment custody acknowledged');
      qc.invalidateQueries({ queryKey: ['employee_assets'] });
      qc.invalidateQueries({ queryKey: ['assets_list'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Acknowledgment failed');
    }
  });
}
