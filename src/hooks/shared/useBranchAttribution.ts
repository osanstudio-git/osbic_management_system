import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { supabase } from '../../lib/supabase';

export interface TransferRecord {
  employeeId: string;
  previousBranchId: string;
  currentBranchId: string;
  transferredAt: string; // ISO date string
}

const STORAGE_KEY_PREFIX = 'osbic_emp_branch_transfer_';

/**
 * Persists a branch transfer event for an employee.
 * Records both to localStorage cache and attempts to sync to profiles table if columns exist.
 */
export async function recordBranchTransfer(
  employeeId: string,
  oldBranchId: string,
  newBranchId: string
): Promise<void> {
  if (!employeeId || !oldBranchId || !newBranchId || oldBranchId === newBranchId) {
    return;
  }

  const record: TransferRecord = {
    employeeId,
    previousBranchId: oldBranchId,
    currentBranchId: newBranchId,
    transferredAt: new Date().toISOString(),
  };

  // 1. Store in localStorage for instant access across tabs
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${employeeId}`, JSON.stringify(record));
  } catch (e) {
    console.warn('Could not write transfer record to localStorage:', e);
  }

  // 2. Attempt to update profiles in Supabase if columns are available
  try {
    await (supabase.from('profiles') as any).update({
      previous_branch_id: oldBranchId,
      branch_transferred_at: record.transferredAt,
    }).eq('id', employeeId);
  } catch (err) {
    // If column doesn't exist yet, it will fail silently while localStorage preserves functionality
    console.warn('Supabase profile transfer update skipped:', err);
  }
}

/**
 * Hook providing automatic date-based branch attribution for the current employee
 */
export function useBranchAttribution(explicitEmployeeId?: string) {
  const { profile } = useAuth();
  const { branches } = useBranch();
  const targetId = explicitEmployeeId || profile?.id;

  const [transferRecord, setTransferRecord] = useState<TransferRecord | null>(() => {
    if (!targetId) return null;
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${targetId}`);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  // Also check if profile has transfer metadata from backend
  useEffect(() => {
    if (!targetId) return;

    // Check localStorage first
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${targetId}`);
      if (stored) {
        setTransferRecord(JSON.parse(stored));
        return;
      }
    } catch {}

    // Check profile columns if available
    const prof = profile as any;
    if (prof?.previous_branch_id && prof?.branch_transferred_at) {
      const rec: TransferRecord = {
        employeeId: targetId,
        previousBranchId: prof.previous_branch_id,
        currentBranchId: prof.branch_id || '',
        transferredAt: prof.branch_transferred_at,
      };
      setTransferRecord(rec);
    }
  }, [targetId, profile]);

  const isTransferred = Boolean(transferRecord?.previousBranchId && transferRecord?.transferredAt);

  const currentBranch = useMemo(() => {
    const curId = profile?.branch_id || transferRecord?.currentBranchId;
    return branches.find(b => b.id === curId);
  }, [branches, profile?.branch_id, transferRecord?.currentBranchId]);

  const previousBranch = useMemo(() => {
    if (!transferRecord?.previousBranchId) return null;
    return branches.find(b => b.id === transferRecord.previousBranchId);
  }, [branches, transferRecord?.previousBranchId]);

  /**
   * Automatically resolves which branch a given date belongs to.
   * If date is prior to transfer date -> previous branch.
   * Otherwise -> current branch.
   */
  const resolveBranchForDate = (dateString?: string) => {
    const defaultBranchId = profile?.branch_id || '';

    if (!isTransferred || !transferRecord?.transferredAt || !dateString) {
      return {
        branchId: defaultBranchId,
        branchName: currentBranch?.name || 'Current Branch',
        isTransferred: false,
        isHistorical: false,
        transferDate: null,
      };
    }

    try {
      const targetDate = new Date(dateString.includes('T') ? dateString : `${dateString}T00:00:00`);
      const transferDate = new Date(transferRecord.transferredAt);

      // Compare dates (day level or timestamp)
      const isHistorical = targetDate.getTime() < transferDate.getTime();

      if (isHistorical && transferRecord.previousBranchId) {
        return {
          branchId: transferRecord.previousBranchId,
          branchName: previousBranch?.name || 'Previous Branch',
          isTransferred: true,
          isHistorical: true,
          transferDate: transferRecord.transferredAt,
        };
      }

      return {
        branchId: defaultBranchId,
        branchName: currentBranch?.name || 'Current Branch',
        isTransferred: true,
        isHistorical: false,
        transferDate: transferRecord.transferredAt,
      };
    } catch {
      return {
        branchId: defaultBranchId,
        branchName: currentBranch?.name || 'Current Branch',
        isTransferred: false,
        isHistorical: false,
        transferDate: null,
      };
    }
  };

  return {
    isTransferred,
    transferRecord,
    currentBranch,
    previousBranch,
    resolveBranchForDate,
  };
}
