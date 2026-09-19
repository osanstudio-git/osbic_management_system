import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Lead } from '../shared/useLeads';

export type DistributionStrategy = 'workload_balanced' | 'pure_round_robin' | 'available_only';

export interface StaffCapacity {
  id: string;
  full_name: string;
  avatar_url?: string;
  department?: string;
  role?: string;
  is_active: boolean;
  availability_status: 'available' | 'on-work' | 'busy';
  activeLeadCount: number;
  activeJobCount: number;
  totalActiveLoad: number;
}

export interface ProposedAssignment {
  leadId: string;
  leadCode?: string;
  contactName: string;
  sourceName?: string;
  employeeId: string;
  employeeName: string;
}

export interface DistributionPlan {
  totalLeadsToDistribute: number;
  assignments: ProposedAssignment[];
  staffSummary: {
    employee: StaffCapacity;
    assignedCount: number;
    initialLoad: number;
    projectedLoad: number;
  }[];
}

/**
 * Computes an equitable distribution plan based on chosen strategy
 */
export const computeDistributionPlan = (
  unassignedLeads: Lead[],
  staffList: StaffCapacity[],
  strategy: DistributionStrategy = 'workload_balanced'
): DistributionPlan => {
  if (unassignedLeads.length === 0 || staffList.length === 0) {
    return {
      totalLeadsToDistribute: 0,
      assignments: [],
      staffSummary: staffList.map(s => ({
        employee: s,
        assignedCount: 0,
        initialLoad: s.totalActiveLoad,
        projectedLoad: s.totalActiveLoad,
      })),
    };
  }

  // 1. Filter eligible staff based on strategy
  let eligibleStaff = [...staffList].filter(s => s.is_active);
  if (strategy === 'available_only') {
    const availableOnly = eligibleStaff.filter(s => s.availability_status === 'available');
    if (availableOnly.length > 0) {
      eligibleStaff = availableOnly;
    }
  }

  if (eligibleStaff.length === 0) {
    eligibleStaff = [...staffList];
  }

  const assignments: ProposedAssignment[] = [];
  // Clone staff with simulated loads
  const simulation = eligibleStaff.map(s => ({
    employee: s,
    currentLoad: s.totalActiveLoad,
    assignedCount: 0,
  }));

  if (strategy === 'pure_round_robin') {
    // Pure turn-by-turn round robin
    unassignedLeads.forEach((lead, index) => {
      const slot = simulation[index % simulation.length];
      slot.assignedCount++;
      slot.currentLoad++;
      assignments.push({
        leadId: lead.id,
        leadCode: lead.lead_code,
        contactName: lead.contact_name,
        sourceName: (lead as any).lead_sources?.name || lead.utm_source || 'Direct',
        employeeId: slot.employee.id,
        employeeName: slot.employee.full_name,
      });
    });
  } else {
    // Capacity / Workload balanced (greedy assignment to lowest loaded member)
    unassignedLeads.forEach((lead) => {
      // Find staff with minimum current load
      simulation.sort((a, b) => a.currentLoad - b.currentLoad);
      const targetSlot = simulation[0];
      targetSlot.assignedCount++;
      targetSlot.currentLoad++;

      assignments.push({
        leadId: lead.id,
        leadCode: lead.lead_code,
        contactName: lead.contact_name,
        sourceName: (lead as any).lead_sources?.name || lead.utm_source || 'Direct',
        employeeId: targetSlot.employee.id,
        employeeName: targetSlot.employee.full_name,
      });
    });
  }

  const staffSummary = staffList.map(s => {
    const matchedSim = simulation.find(slot => slot.employee.id === s.id);
    const assignedCount = matchedSim ? matchedSim.assignedCount : 0;
    return {
      employee: s,
      assignedCount,
      initialLoad: s.totalActiveLoad,
      projectedLoad: s.totalActiveLoad + assignedCount,
    };
  });

  return {
    totalLeadsToDistribute: unassignedLeads.length,
    assignments,
    staffSummary,
  };
};

export const useExecuteRoundRobin = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (plan: DistributionPlan) => {
      const now = new Date().toISOString();

      // 1. Execute lead updates in batches
      const updatePromises = plan.assignments.map(assign => {
        return supabase
          .from('leads')
          .update({
            assigned_to: assign.employeeId,
            assigned_by: profile?.id || null,
            updated_at: now,
          })
          .eq('id', assign.leadId);
      });

      const updateResults = await Promise.all(updatePromises);
      const hasError = updateResults.find(r => r.error);
      if (hasError && hasError.error) {
        throw hasError.error;
      }

      // 2. Insert notifications for assigned staff
      const notifications = plan.assignments.map(assign => ({
        recipient_id: assign.employeeId,
        sender_id: profile?.id || null,
        type: 'alert',
        title_en: `⚡ Inbound Lead Assigned: ${assign.contactName}`,
        title_ar: `⚡ تم تعيين عميل محتمل جديد: ${assign.contactName}`,
        body_en: `Auto-distributed by Branch Command. Source: ${assign.sourceName || 'Website'}.`,
        body_ar: `تم التوزيع التلقائي بواسطة إدارة الفرع. المصدر: ${assign.sourceName || 'الموقع'}.`,
        action_url: `/employee/leads`,
        action_required: false,
        is_read: false,
      }));

      try {
        await supabase.from('notifications').insert(notifications);
      } catch (notifErr) {
        console.warn('Failed to send assignment notifications:', notifErr);
      }

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['marketing'] });
      queryClient.invalidateQueries({ queryKey: ['branch_team'] });
      queryClient.invalidateQueries({ queryKey: ['branch_command_center'] });
    },
  });
};
