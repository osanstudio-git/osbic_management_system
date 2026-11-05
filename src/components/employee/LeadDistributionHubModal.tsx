import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Target, CheckCircle2, Clock, Calendar, Download,
  RefreshCw, X, Search, ChevronRight, UserCheck, AlertCircle,
  ArrowRight, Sparkles, Filter, ShieldCheck, Phone, Building2,
  Shuffle, Check, UserPlus, FileSpreadsheet, Eye, MessageSquare
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  format, isToday, isYesterday, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, isWithinInterval, parseISO
} from 'date-fns';
import toast from 'react-hot-toast';

interface LeadDistributionHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string | null;
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';
type ListTab = 'unassigned' | 'assigned' | 'date_log';

export default function LeadDistributionHubModal({
  isOpen,
  onClose,
  branchId
}: LeadDistributionHubModalProps) {
  const { profile, role } = useAuth();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  // Filters State
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [listTab, setListTab] = useState<ListTab>('unassigned');
  const [isBulkAssigning, setIsBulkAssigning] = useState<boolean>(false);
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);

  // 1. Fetch All Leads for Distribution
  const { data: allLeads = [], isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['lead_distribution_hub_leads', branchId],
    enabled: isOpen,
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          id,
          lead_code,
          contact_name,
          contact_phone,
          contact_whatsapp,
          contact_email,
          company_name,
          service_required,
          status,
          created_at,
          updated_at,
          assigned_to,
          assigned_by,
          date_reassigned,
          is_reassigned,
          branch_id,
          quoted_amount,
          total_amount,
          lead_sources:source_id (name),
          assigned_to_profile:profiles!assigned_to (id, full_name, employee_code, email, avatar_url),
          assigned_by_profile:profiles!assigned_by (id, full_name, employee_code)
        `)
        .order('created_at', { ascending: false });

      if (branchId) {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // 2. Fetch Active Sales Reps
  const { data: salesEmployees = [] } = useQuery({
    queryKey: ['sales_employees_for_distribution', branchId],
    enabled: isOpen,
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, employee_code, email, phone, role, department, can_do_sales, avatar_url, branch_id')
        .eq('role', 'employee')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).filter(e => e.can_do_sales || e.department === 'sales');
    }
  });

  // Date Filter Predicate
  const isLeadInDateRange = (dateStr: string) => {
    if (!dateStr) return true;
    const now = new Date();
    const d = new Date(dateStr);

    if (datePreset === 'today') {
      return isToday(d);
    }
    if (datePreset === 'yesterday') {
      return isYesterday(d);
    }
    if (datePreset === 'week') {
      return isWithinInterval(d, {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 })
      });
    }
    if (datePreset === 'month') {
      return isWithinInterval(d, {
        start: startOfMonth(now),
        end: endOfMonth(now)
      });
    }
    if (datePreset === 'custom' && customStart && customEnd) {
      const s = new Date(customStart + 'T00:00:00');
      const e = new Date(customEnd + 'T23:59:59');
      return d >= s && d <= e;
    }
    return true; // 'all'
  };

  // Filtered Leads in the active date range
  const dateFilteredLeads = useMemo(() => {
    return allLeads.filter(l => {
      // Use date_reassigned if assigned, or created_at
      const dateToCheck = l.date_reassigned || l.created_at;
      return isLeadInDateRange(dateToCheck);
    });
  }, [allLeads, datePreset, customStart, customEnd]);

  // Global KPIs (computed in the selected timeframe)
  const kpis = useMemo(() => {
    const totalLeads = dateFilteredLeads.length;
    // Unassigned leads: anywhere in the pipeline or created in range without assigned_to
    const unassignedLeads = allLeads.filter(l => !l.assigned_to && l.status !== 'converted' && l.status !== 'cancelled' && l.status !== 'lost');
    const assignedLeads = dateFilteredLeads.filter(l => Boolean(l.assigned_to));

    // Specifically assigned today
    const assignedToday = allLeads.filter(l => {
      if (!l.assigned_to) return false;
      const d = l.date_reassigned || l.created_at;
      return d && isToday(new Date(d));
    }).length;

    // Unassigned created today
    const unassignedToday = allLeads.filter(l => {
      return !l.assigned_to && l.created_at && isToday(new Date(l.created_at));
    }).length;

    return {
      totalLeads,
      unassignedCount: unassignedLeads.length,
      unassignedToday,
      assignedCount: assignedLeads.length,
      assignedToday
    };
  }, [allLeads, dateFilteredLeads]);

  // Counts Assigned to Each Sales Employee
  const employeeCounts = useMemo(() => {
    const map = new Map<string, {
      employee: any;
      todayCount: number;
      periodCount: number;
      totalAllTime: number;
      newCount: number;
      convertedCount: number;
    }>();

    // Initialize all sales reps
    salesEmployees.forEach(emp => {
      map.set(emp.id, {
        employee: emp,
        todayCount: 0,
        periodCount: 0,
        totalAllTime: 0,
        newCount: 0,
        convertedCount: 0,
      });
    });

    // Count in allLeads
    allLeads.forEach(l => {
      if (!l.assigned_to) return;
      if (map.has(l.assigned_to)) {
        const item = map.get(l.assigned_to)!;
        item.totalAllTime += 1;

        const dStr = l.date_reassigned || l.created_at;
        if (dStr && isToday(new Date(dStr))) {
          item.todayCount += 1;
        }

        if (isLeadInDateRange(dStr)) {
          item.periodCount += 1;
          if (l.status === 'new') item.newCount += 1;
          if (l.status === 'converted') item.convertedCount += 1;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Sort by today count first, then period count
      if (b.todayCount !== a.todayCount) return b.todayCount - a.todayCount;
      return b.periodCount - a.periodCount;
    });
  }, [allLeads, salesEmployees, datePreset, customStart, customEnd]);

  // Tab 1: Unassigned Leads List
  const unassignedList = useMemo(() => {
    return allLeads.filter(l => {
      if (l.assigned_to) return false;
      if (l.status === 'converted' || l.status === 'cancelled' || l.status === 'lost') return false;

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = l.contact_name?.toLowerCase().includes(q);
        const mCompany = l.company_name?.toLowerCase().includes(q);
        const mPhone = l.contact_phone?.includes(q) || l.contact_whatsapp?.includes(q);
        const mService = l.service_required?.toLowerCase().includes(q);
        const mCode = l.lead_code?.toLowerCase().includes(q);
        if (!mName && !mCompany && !mPhone && !mService && !mCode) return false;
      }
      return true;
    });
  }, [allLeads, searchQuery]);

  // Tab 2: Assigned Leads List
  const assignedList = useMemo(() => {
    return dateFilteredLeads.filter(l => {
      if (!l.assigned_to) return false;

      // Filter by selected employee
      if (selectedRepId !== 'all' && l.assigned_to !== selectedRepId) {
        return false;
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = l.contact_name?.toLowerCase().includes(q);
        const mCompany = l.company_name?.toLowerCase().includes(q);
        const mPhone = l.contact_phone?.includes(q) || l.contact_whatsapp?.includes(q);
        const mService = l.service_required?.toLowerCase().includes(q);
        const mCode = l.lead_code?.toLowerCase().includes(q);
        const mRep = (l.assigned_to_profile?.full_name || '').toLowerCase().includes(q);
        if (!mName && !mCompany && !mPhone && !mService && !mCode && !mRep) return false;
      }
      return true;
    });
  }, [dateFilteredLeads, selectedRepId, searchQuery]);

  // Tab 3: Date-Wise Assignment Log (Grouped day-by-day)
  const dateWiseLog = useMemo(() => {
    const map = new Map<string, {
      date: string;
      formattedDate: string;
      isToday: boolean;
      totalAssigned: number;
      byEmployee: Record<string, { name: string; count: number }>;
      leads: any[];
    }>();

    allLeads.forEach(l => {
      if (!l.assigned_to) return;
      const dStr = l.date_reassigned || l.created_at;
      if (!dStr) return;

      const dt = new Date(dStr);
      const key = format(dt, 'yyyy-MM-dd');
      const formatted = format(dt, 'dd MMM yyyy');
      const todayFlag = isToday(dt);

      if (!map.has(key)) {
        map.set(key, {
          date: key,
          formattedDate: formatted,
          isToday: todayFlag,
          totalAssigned: 0,
          byEmployee: {},
          leads: []
        });
      }

      const item = map.get(key)!;
      item.totalAssigned += 1;
      item.leads.push(l);

      const repName = l.assigned_to_profile?.full_name || 'Sales Rep';
      if (!item.byEmployee[l.assigned_to]) {
        item.byEmployee[l.assigned_to] = { name: repName, count: 0 };
      }
      item.byEmployee[l.assigned_to].count += 1;
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [allLeads]);

  // Handle Assigning / Reassigning a Lead
  const handleAssignLead = async (leadId: string, targetEmployeeId: string) => {
    setAssigningLeadId(leadId);
    try {
      const targetEmp = salesEmployees.find(e => e.id === targetEmployeeId);
      const currentLead = allLeads.find(l => l.id === leadId);

      const { error } = await supabase
        .from('leads')
        .update({
          assigned_to: targetEmployeeId,
          assigned_by: profile?.id,
          is_reassigned: Boolean(currentLead?.assigned_to && currentLead.assigned_to !== targetEmployeeId),
          reassigned_from_id: currentLead?.assigned_to || null,
          date_reassigned: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (error) throw error;

      await refetchLeads();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales_team_reports'] });

      toast.success(
        isRtl
          ? `تم تعيين العميل إلى ${targetEmp?.full_name || 'الموظف'}`
          : `Lead assigned to ${targetEmp?.full_name || 'Sales Rep'}`
      );
    } catch (err: any) {
      console.error('Assign lead error:', err);
      toast.error(err.message || 'Failed to assign lead');
    } finally {
      setAssigningLeadId(null);
    }
  };

  // Bulk Auto-Distribute Unassigned Leads (Round Robin)
  const handleAutoDistribute = async () => {
    if (unassignedList.length === 0) {
      toast.error(isRtl ? 'لا يوجد ليدات غير معينة للتوزيع' : 'No unassigned leads to distribute');
      return;
    }
    if (salesEmployees.length === 0) {
      toast.error(isRtl ? 'لا يوجد موظفي مبيعات متاحين للتوزيع' : 'No active sales reps available');
      return;
    }

    setIsBulkAssigning(true);
    try {
      let repIndex = 0;
      const updates = unassignedList.map(lead => {
        const rep = salesEmployees[repIndex % salesEmployees.length];
        repIndex++;
        return {
          leadId: lead.id,
          employeeId: rep.id,
          repName: rep.full_name
        };
      });

      // Update sequentially or in parallel batches
      for (const item of updates) {
        await supabase
          .from('leads')
          .update({
            assigned_to: item.employeeId,
            assigned_by: profile?.id,
            date_reassigned: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.leadId);
      }

      await refetchLeads();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['sales_team_reports'] });

      toast.success(
        isRtl
          ? `تم توزيع ${updates.length} عميل محتمل بالتساوي على فريق المبيعات بنجاح!`
          : `Distributed ${updates.length} unassigned leads equally across ${salesEmployees.length} sales reps!`
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to auto-distribute');
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // Download CSV Report
  const handleDownloadReport = () => {
    const listToExport = listTab === 'unassigned' ? unassignedList : assignedList;

    if (listToExport.length === 0) {
      toast.error(isRtl ? 'لا توجد بيانات للتصدير' : 'No records to export');
      return;
    }

    const headers = [
      'Lead Code',
      'Contact Name',
      'Company Name',
      'Phone Number',
      'WhatsApp',
      'Email',
      'Service Required',
      'Source',
      'Assigned To Name',
      'Assigned To Code',
      'Assigned By Name',
      'Status',
      'Quoted Amount (OMR)',
      'Created Date',
      'Assigned Date'
    ];

    const rows = listToExport.map(l => [
      `"${l.lead_code || ''}"`,
      `"${(l.contact_name || '').replace(/"/g, '""')}"`,
      `"${(l.company_name || '').replace(/"/g, '""')}"`,
      `"${l.contact_phone || ''}"`,
      `"${l.contact_whatsapp || ''}"`,
      `"${l.contact_email || ''}"`,
      `"${(l.service_required || '').replace(/"/g, '""')}"`,
      `"${(l.lead_sources?.name || '').replace(/"/g, '""')}"`,
      `"${(l.assigned_to_profile?.full_name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${l.assigned_to_profile?.employee_code || ''}"`,
      `"${(l.assigned_by_profile?.full_name || '').replace(/"/g, '""')}"`,
      `"${l.status || ''}"`,
      Number(l.quoted_amount || 0).toFixed(3),
      `"${l.created_at ? format(new Date(l.created_at), 'yyyy-MM-dd HH:mm') : ''}"`,
      `"${l.date_reassigned ? format(new Date(l.date_reassigned), 'yyyy-MM-dd HH:mm') : (l.created_at ? format(new Date(l.created_at), 'yyyy-MM-dd HH:mm') : '')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSBIC_Lead_Assignment_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(isRtl ? 'تم تنزيل تقرير توزيع الليدات بنجاح' : 'Lead assignment report downloaded');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm" dir={isRtl ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="w-full max-w-6xl bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* ─── Modal Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-sm shrink-0">
              <Target size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-syne text-base sm:text-lg font-bold text-foreground">
                  {isRtl ? 'مركز توزيع وتعيين الليدات (Sales Head Hub)' : 'Lead Assignment & Distribution Hub'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest">
                  Lead Coordinator
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isRtl
                  ? 'متابعة الليدات غير المعينة والمعينة، أعداد الليدات لكل موظف مبيعات اليوم وتاريخياً، مع خيار التوزيع والتصدير'
                  : 'Track unassigned and assigned leads, counts per sales rep (today & date-wise), and one-click report download'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchLeads()}
              className="p-2 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Refresh"
            >
              <RefreshCw size={15} className={loadingLeads ? 'animate-spin text-primary' : ''} />
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs border border-primary/20 transition-all shadow-sm"
              title={isRtl ? 'تنزيل تقرير التوزيع (.CSV)' : 'Download Distribution Report (.CSV)'}
            >
              <Download size={13} />
              <span className="hidden sm:inline">{isRtl ? 'تنزيل التقرير' : 'Download Report'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── Top KPI Strip ─────────────────────────────────────────────────── */}
        <div className="p-4 bg-muted/10 border-b border-border/30 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {/* Card 1: Unassigned Leads (Action Needed!) */}
          <div
            onClick={() => setListTab('unassigned')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              listTab === 'unassigned'
                ? 'bg-rose-500/10 border-rose-500/40 shadow-sm'
                : 'bg-card border-border/60 hover:border-rose-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isRtl ? 'غير معينة (Unassigned)' : 'Unassigned Leads'}
              </span>
              <AlertCircle size={14} className="text-rose-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-syne text-rose-400">{kpis.unassignedCount}</span>
              <span className="text-[10px] text-muted-foreground font-medium">
                ({kpis.unassignedToday} {isRtl ? 'وصلت اليوم' : 'in today'})
              </span>
            </div>
          </div>

          {/* Card 2: Assigned Today (MUST HAVE) */}
          <div className="p-3 rounded-2xl bg-card border border-border/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {isRtl ? 'تم تعيينها اليوم' : 'Assigned Today'}
              </span>
              <Clock size={14} className="text-primary" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-syne text-primary">{kpis.assignedToday}</span>
              <span className="text-[10px] text-muted-foreground font-medium">{isRtl ? 'ليد موزعة' : 'leads assigned'}</span>
            </div>
          </div>

          {/* Card 3: Total Assigned in Period */}
          <div
            onClick={() => setListTab('assigned')}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              listTab === 'assigned'
                ? 'bg-emerald-500/10 border-emerald-500/40 shadow-sm'
                : 'bg-card border-border/60 hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isRtl ? 'إجمالي المعينين بالفترة' : 'Assigned in Period'}
              </span>
              <CheckCircle2 size={14} className="text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-syne text-emerald-400">{kpis.assignedCount}</span>
              <span className="text-[10px] text-muted-foreground font-medium">{isRtl ? 'ليد موزعة' : 'leads'}</span>
            </div>
          </div>

          {/* Card 4: Active Sales Team Capacity */}
          <div className="p-3 rounded-2xl bg-card border border-border/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isRtl ? 'فريق المبيعات النشط' : 'Active Sales Reps'}
              </span>
              <Users size={14} className="text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold font-syne text-foreground">{salesEmployees.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium">{isRtl ? 'مستعدين للاستلام' : 'consultants'}</span>
            </div>
          </div>
        </div>

        {/* ─── Employee Assignment Cards (Counts Assigned to Each Rep) ─────── */}
        <div className="p-4 bg-muted/5 border-b border-border/30 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-muted-foreground flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
              <UserCheck size={13} className="text-primary" />
              {isRtl ? 'توزيع الليدات حسب موظفي المبيعات (اليوم / الفترة):' : 'Leads Distributed to Sales Reps (Today / Period):'}
            </span>
            {selectedRepId !== 'all' && (
              <button
                onClick={() => setSelectedRepId('all')}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                {isRtl ? 'إلغاء التصفية (عرض الكل)' : 'Show All Reps'}
              </button>
            )}
          </div>

          {/* Horizontal scroll of Sales Reps with Live Counts */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar">
            {employeeCounts.map(item => {
              const isSelected = selectedRepId === item.employee.id;

              return (
                <div
                  key={item.employee.id}
                  onClick={() => {
                    setSelectedRepId(isSelected ? 'all' : item.employee.id);
                    setListTab('assigned');
                  }}
                  className={`p-2.5 rounded-2xl border transition-all cursor-pointer min-w-[190px] shrink-0 flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                      : 'bg-card border-border/60 hover:border-primary/40 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {item.employee.full_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{item.employee.full_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{item.employee.employee_code || 'REP'}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-xs font-bold text-primary font-mono">{item.todayCount}</span>
                      <span className="text-[9px] text-muted-foreground uppercase">{isRtl ? 'اليوم' : 'Today'}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {item.periodCount} {isRtl ? 'بالفترة' : 'total'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Filter & Search Bar ───────────────────────────────────────────── */}
        <div className="p-3.5 bg-muted/20 border-b border-border/30 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
          {/* Tabs: Unassigned, Assigned, Date Log */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-bold w-full md:w-auto">
            <button
              onClick={() => setListTab('unassigned')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                listTab === 'unassigned'
                  ? 'bg-card text-rose-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertCircle size={13} />
              <span>{isRtl ? 'غير المعينين' : 'Unassigned'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/15 font-mono">
                {unassignedList.length}
              </span>
            </button>

            <button
              onClick={() => setListTab('assigned')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                listTab === 'assigned'
                  ? 'bg-card text-emerald-400 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckCircle2 size={13} />
              <span>{isRtl ? 'المعينين' : 'Assigned Leads'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/15 font-mono">
                {assignedList.length}
              </span>
            </button>

            <button
              onClick={() => setListTab('date_log')}
              className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                listTab === 'date_log'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar size={13} />
              <span>{isRtl ? 'السجل اليومي' : 'Date-Wise Log'}</span>
            </button>
          </div>

          {/* Date Range Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs w-full md:w-auto">
            {(['today', 'yesterday', 'week', 'month', 'all'] as DatePreset[]).map(p => (
              <button
                key={p}
                onClick={() => setDatePreset(p)}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap text-[11px] ${
                  datePreset === p
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {p === 'today' && (isRtl ? 'اليوم (Must)' : 'Today (Must)')}
                {p === 'yesterday' && (isRtl ? 'أمس' : 'Yesterday')}
                {p === 'week' && (isRtl ? 'هذا الأسبوع' : 'This Week')}
                {p === 'month' && (isRtl ? 'هذا الشهر' : 'This Month')}
                {p === 'all' && (isRtl ? 'الكل' : 'All')}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={isRtl ? 'ابحث بالاسم، الهاتف، الخدمة...' : 'Search name, phone, service...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-card border border-border/60 rounded-xl text-xs text-foreground outline-none focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* ─── Main Content Area ─────────────────────────────────────────────── */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-3">
          {/* TAB 1: UNASSIGNED LEADS */}
          {listTab === 'unassigned' && (
            <div className="space-y-3">
              {/* Unassigned Action Banner */}
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertCircle size={18} className="text-rose-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground">
                      {isRtl ? `${unassignedList.length} عميل محتمل بانتظار التعيين` : `${unassignedList.length} Unassigned Leads Waiting for Assignment`}
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {isRtl
                        ? 'قم بتعيين كل ليد لموظف مبيعات يدويًا أو استخدم التوزيع التلقائي المتساوي'
                        : 'Assign each lead to a sales consultant or auto-distribute equally in 1 click'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleAutoDistribute}
                  disabled={isBulkAssigning || unassignedList.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 text-white font-bold text-xs rounded-xl hover:bg-rose-600 transition-all shadow-md shadow-rose-500/20 disabled:opacity-50 shrink-0"
                >
                  <Shuffle size={13} className={isBulkAssigning ? 'animate-spin' : ''} />
                  <span>{isBulkAssigning ? (isRtl ? 'جاري التوزيع...' : 'Distributing...') : (isRtl ? 'توزيع تلقائي بالتساوي' : 'Auto-Distribute Equally')}</span>
                </button>
              </div>

              {/* Unassigned Table */}
              {unassignedList.length === 0 ? (
                <div className="text-center py-16 bg-card border border-border/40 rounded-3xl p-8 space-y-2">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-400/60" />
                  <p className="text-sm font-bold text-foreground">{isRtl ? 'رائع! لا يوجد أي ليدات غير معينة حالياً' : 'All Clear! No unassigned leads waiting'}</p>
                  <p className="text-xs text-muted-foreground">{isRtl ? 'تم توزيع وتعيين جميع العملاء بنجاح على فريق المبيعات' : 'All incoming inquiries have been assigned to sales representatives'}</p>
                </div>
              ) : (
                <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="py-3 px-4">{isRtl ? 'العميل' : 'Contact / Lead'}</th>
                          <th className="py-3 px-4">{isRtl ? 'الهاتف' : 'Phone / Contact'}</th>
                          <th className="py-3 px-4">{isRtl ? 'الخدمة المطلوبة' : 'Service Required'}</th>
                          <th className="py-3 px-4">{isRtl ? 'المصدر' : 'Source'}</th>
                          <th className="py-3 px-4">{isRtl ? 'تاريخ الوصول' : 'Received Date'}</th>
                          <th className="py-3 px-4 text-right">{isRtl ? 'تعيين إلى موظف المبيعات' : 'Assign to Sales Rep'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {unassignedList.map(lead => (
                          <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <div>
                                <span className="font-bold text-foreground block">{lead.contact_name}</span>
                                {lead.company_name && (
                                  <span className="text-[10px] text-muted-foreground block">{lead.company_name}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono whitespace-nowrap">
                              <span className="text-foreground">{lead.contact_phone || lead.contact_whatsapp || '—'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-muted-foreground truncate max-w-[160px] inline-block">
                                {lead.service_required || 'General Inquiry'}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground border border-border/40">
                                {lead.lead_sources?.name || 'Inbound'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                              {lead.created_at ? format(new Date(lead.created_at), 'dd MMM HH:mm') : '—'}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <select
                                defaultValue=""
                                disabled={assigningLeadId === lead.id}
                                onChange={e => {
                                  if (e.target.value) {
                                    handleAssignLead(lead.id, e.target.value);
                                  }
                                }}
                                className="bg-primary/10 border border-primary/30 text-primary font-bold text-xs rounded-xl px-3 py-1.5 outline-none hover:bg-primary/20 transition-all cursor-pointer"
                              >
                                <option value="" disabled>
                                  {assigningLeadId === lead.id ? (isRtl ? 'جاري التعيين...' : 'Assigning...') : (isRtl ? '⚡ تعيين لموظف...' : '⚡ Assign to Rep...')}
                                </option>
                                {salesEmployees.map(rep => (
                                  <option key={rep.id} value={rep.id} className="bg-card text-foreground">
                                    {rep.full_name} ({rep.employee_code || 'REP'})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ASSIGNED LEADS */}
          {listTab === 'assigned' && (
            <div className="space-y-3">
              <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-3 px-4">{isRtl ? 'العميل' : 'Contact / Lead'}</th>
                        <th className="py-3 px-4">{isRtl ? 'معين إلى (Sales Rep)' : 'Assigned To'}</th>
                        <th className="py-3 px-4">{isRtl ? 'تم التعيين بواسطة' : 'Assigned By'}</th>
                        <th className="py-3 px-4">{isRtl ? 'تاريخ التعيين' : 'Assigned Date'}</th>
                        <th className="py-3 px-4">{isRtl ? 'الحالة' : 'Status'}</th>
                        <th className="py-3 px-4 text-right">{isRtl ? 'إعادة التعيين' : 'Reassign Rep'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {assignedList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-16 text-muted-foreground">
                            {isRtl ? 'لا توجد ليدات معينة مطابقة للتصفية الحالية' : 'No assigned leads matching this filter'}
                          </td>
                        </tr>
                      ) : (
                        assignedList.map(lead => (
                          <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <div>
                                <span className="font-bold text-foreground block">{lead.contact_name}</span>
                                <span className="text-[10px] text-muted-foreground font-mono">{lead.contact_phone || lead.service_required || '—'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                  {(lead.assigned_to_profile?.full_name || 'EM').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-xs text-foreground block">
                                    {lead.assigned_to_profile?.full_name || 'Assigned Rep'}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground font-mono">
                                    {lead.assigned_to_profile?.employee_code || 'REP'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-muted-foreground">
                              <span className="text-[11px] font-medium">{lead.assigned_by_profile?.full_name || 'System / Self'}</span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                              {lead.date_reassigned
                                ? format(new Date(lead.date_reassigned), 'dd MMM HH:mm')
                                : (lead.created_at ? format(new Date(lead.created_at), 'dd MMM HH:mm') : '—')}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                lead.status === 'converted'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : lead.status === 'new'
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : 'bg-muted text-muted-foreground border border-border/40'
                              }`}>
                                {lead.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <select
                                defaultValue=""
                                disabled={assigningLeadId === lead.id}
                                onChange={e => {
                                  if (e.target.value) {
                                    handleAssignLead(lead.id, e.target.value);
                                  }
                                }}
                                className="bg-muted/40 hover:bg-muted border border-border/60 text-foreground font-medium text-xs rounded-xl px-2.5 py-1 outline-none transition-all cursor-pointer"
                              >
                                <option value="" disabled>{isRtl ? 'نقل لموظف آخر...' : 'Reassign to...'}</option>
                                {salesEmployees
                                  .filter(rep => rep.id !== lead.assigned_to)
                                  .map(rep => (
                                    <option key={rep.id} value={rep.id} className="bg-card text-foreground">
                                      {rep.full_name} ({rep.employee_code || 'REP'})
                                    </option>
                                  ))}
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATE-WISE ASSIGNMENT LOG */}
          {listTab === 'date_log' && (
            <div className="space-y-3">
              <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="py-3 px-4">{isRtl ? 'التاريخ' : 'Date'}</th>
                        <th className="py-3 px-4">{isRtl ? 'إجمالي الليدات الموزعة' : 'Total Leads Assigned'}</th>
                        <th className="py-3 px-4">{isRtl ? 'تفصيل التوزيع حسب الموظفين (الاسم والعدد)' : 'Assigned to Whom (Name & Count)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {dateWiseLog.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-16 text-muted-foreground">
                            {isRtl ? 'لا يوجد سجل توزيع' : 'No assignment records found'}
                          </td>
                        </tr>
                      ) : (
                        dateWiseLog.map(day => (
                          <tr key={day.date} className={`hover:bg-muted/20 transition-colors ${day.isToday ? 'bg-primary/5' : ''}`}>
                            <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{day.formattedDate}</span>
                                {day.isToday && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-primary/20 text-primary uppercase">
                                    Today
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                                {day.totalAssigned} {isRtl ? 'ليد' : 'leads'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {Object.values(day.byEmployee).map((empStat, idx) => (
                                  <div
                                    key={idx}
                                    className="px-2 py-0.5 rounded-lg bg-muted/40 border border-border/40 text-[11px] flex items-center gap-1.5"
                                  >
                                    <span className="font-semibold text-foreground">{empStat.name}:</span>
                                    <span className="font-mono font-bold text-primary">{empStat.count}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Modal Footer ──────────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            {isRtl
              ? `إجمالي المعاملات: ${dateFilteredLeads.length} | غير المعينة: ${unassignedList.length}`
              : `Total Leads: ${dateFilteredLeads.length} | Unassigned: ${unassignedList.length}`}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-muted hover:bg-muted/70 text-foreground font-bold text-xs rounded-xl transition-all"
          >
            {isRtl ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
