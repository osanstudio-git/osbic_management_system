import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLeads, useDailySalesSheetData, useDeleteLead } from '../../hooks/shared/useLeads';
import { useAdminEmployees, useUpdateEmployee } from '../../hooks/admin/useAdminEmployees';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Phone, Calendar, Info, Search, 
  ChevronRight, AlertCircle, RefreshCw, Zap,
  Compass, LayoutGrid, List, SlidersHorizontal, Download,
  FileSpreadsheet, FileText, PhoneCall, Award, MessageSquarePlus, Sparkles,
  Trash2, Table, Users, Crown, Target, TrendingUp, CheckCircle2, ChevronDown, Check,
  Percent, AlertTriangle, Clock, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isBefore, startOfDay, isToday } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AddLeadSlideOver from '../../components/employee/AddLeadSlideOver';
import LeadDetailSlideOver from '../../components/employee/LeadDetailSlideOver';
import { DailySalesSheetModal } from '../../components/employee/DailySalesSheetModal';
import { QuickInteractionModal } from '../../components/employee/QuickInteractionModal';
import { LivingDealsTable } from '../../components/employee/LivingDealsTable';
import { SalesExportCenterModal } from '../../components/employee/SalesExportCenterModal';
import { type Lead } from '../../hooks/shared/useLeads';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function EmployeeLeads() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  
  // Guard access
  if (profile && !profile.can_do_sales) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="w-20 h-20 bg-red-400/10 rounded-3xl flex items-center justify-center text-red-400 mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-syne font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-8 max-w-sm">You do not have permission to view the Sales Workspace / CRM.</p>
      </div>
    );
  }

  // Hierarchy & Dynamic Roles
  const isSalesHead = Boolean(profile?.is_sales_head || profile?.is_manager || role === 'admin');
  const canAssignLeads = Boolean(profile?.can_assign_leads || isSalesHead);

  // Sales rep selection for Sales Head view
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const effectiveRepId = isSalesHead ? selectedRepId : profile?.id;
  const isAllReps = isSalesHead && selectedRepId === 'all';

  // Fetch employees list for team switcher & delegation
  const { data: allEmployees = [] } = useAdminEmployees(profile?.branch_id || undefined);
  const salesReps = useMemo(() => {
    return allEmployees.filter(e => e.is_active && (e.can_do_sales || e.department === 'sales' || e.is_manager));
  }, [allEmployees]);

  const updateEmployeeMutation = useUpdateEmployee();
  const [isCoordinatorModalOpen, setIsCoordinatorModalOpen] = useState(false);
  const [isExportCenterOpen, setIsExportCenterOpen] = useState(false);

  // Queries
  const { useLeadsList, useLeadSourcesList } = useLeads(effectiveRepId, isAllReps);
  const { data: leads, isLoading, refetch } = useLeadsList();
  const { data: sources = [] } = useLeadSourcesList();
  const deleteLeadMutation = useDeleteLead();

  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'new' | 'on_progress' | 'converted'>('all');
  const [radarFilter, setRadarFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'duplicate'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [isDailySheetOpen, setIsDailySheetOpen] = useState(false);
  const [quickLogLead, setQuickLogLead] = useState<Lead | null>(null);

  // Living Deal Row Grid is the primary/default view
  const [viewMode, setViewMode] = useState<'living' | 'grid' | 'list'>('living');
  const [showFilters, setShowFilters] = useState(false);
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Duplicate Phone Detection
  const duplicatePhones = useMemo(() => {
    const counts: Record<string, number> = {};
    (leads || []).forEach(l => {
      const clean = (l.contact_phone || '').replace(/\D/g, '');
      if (clean.length >= 7) counts[clean] = (counts[clean] || 0) + 1;
    });
    const dupes = new Set<string>();
    Object.entries(counts).forEach(([phone, count]) => {
      if (count > 1) dupes.add(phone);
    });
    return dupes;
  }, [leads]);

  // Live Radar Counts
  const radarCounts = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    let duplicate = 0;

    (leads || []).forEach(lead => {
      const isWon = lead.status === 'converted' || (Number(lead.total_amount) || 0) > 0;
      if (lead.next_follow_up_at && !isWon) {
        const d = new Date(lead.next_follow_up_at);
        if (isToday(d)) {
          today++;
        } else if (isBefore(d, startOfDay(new Date()))) {
          overdue++;
        } else {
          upcoming++;
        }
      }
      const clean = (lead.contact_phone || '').replace(/\D/g, '');
      if (clean.length >= 7 && duplicatePhones.has(clean)) {
        duplicate++;
      }
    });

    return { overdue, today, upcoming, duplicate };
  }, [leads, duplicatePhones]);

  // Filtering leads
  const filteredLeads = useMemo(() => {
    return (leads || []).filter(lead => {
      // 0. Radar Quick Action Filter
      if (radarFilter !== 'all') {
        const isWon = lead.status === 'converted' || (Number(lead.total_amount) || 0) > 0;
        if (radarFilter === 'overdue') {
          if (!lead.next_follow_up_at || isWon) return false;
          if (!isBefore(new Date(lead.next_follow_up_at), startOfDay(new Date())) || isToday(new Date(lead.next_follow_up_at))) return false;
        } else if (radarFilter === 'today') {
          if (!lead.next_follow_up_at || isWon) return false;
          if (!isToday(new Date(lead.next_follow_up_at))) return false;
        } else if (radarFilter === 'upcoming') {
          if (!lead.next_follow_up_at || isWon) return false;
          if (isBefore(new Date(lead.next_follow_up_at), startOfDay(new Date())) || isToday(new Date(lead.next_follow_up_at))) return false;
        } else if (radarFilter === 'duplicate') {
          const clean = (lead.contact_phone || '').replace(/\D/g, '');
          if (!clean || !duplicatePhones.has(clean)) return false;
        }
      }

      // 1. Tab filter
      if (activeTab === 'new' && lead.status !== 'new') return false;
      if (activeTab === 'on_progress') {
        if (!['contacted', 'interested', 'on_progress', 'qualified', 'quoted', 'negotiating'].includes(lead.status)) return false;
      }
      if (activeTab === 'converted' && lead.status !== 'converted' && (lead.total_amount || 0) <= 0) return false;
      if (activeTab === 'today') {
        if (!lead.next_follow_up_at) return false;
        const followUpDate = new Date(lead.next_follow_up_at).toDateString();
        const todayDate = new Date().toDateString();
        if (followUpDate !== todayDate) return false;
      }

      // 2. Advanced Status/Follow-up filter
      if (statusFilter === 'followup') {
        if (!lead.next_follow_up_at) return false;
      } else if (statusFilter !== 'all') {
        if (lead.status !== statusFilter) return false;
      }

      // 3. Advanced Source filter
      if (sourceFilter !== 'all') {
        if (lead.source_id !== sourceFilter) return false;
      }

      // 4. Advanced Timeframe filter (created_at date)
      if (timeframeFilter !== 'all') {
        const createdDate = new Date(lead.created_at);
        const now = new Date();
        if (timeframeFilter === 'weekly') {
          const last7Days = new Date();
          last7Days.setDate(now.getDate() - 7);
          if (createdDate < last7Days) return false;
        } else if (timeframeFilter === 'monthly') {
          const last30Days = new Date();
          last30Days.setDate(now.getDate() - 30);
          if (createdDate < last30Days) return false;
        } else if (timeframeFilter === 'yearly') {
          const last365Days = new Date();
          last365Days.setDate(now.getDate() - 365);
          if (createdDate < last365Days) return false;
        } else if (timeframeFilter === 'custom') {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            if (createdDate < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23,59,59,999);
            if (createdDate > end) return false;
          }
        }
      }

      // 5. Search filter
      const query = searchTerm.trim().toLowerCase();
      if (!query) return true;
      return (
        lead.contact_name.toLowerCase().includes(query) ||
        (lead.company_name || '').toLowerCase().includes(query) ||
        (lead.contact_email || '').toLowerCase().includes(query) ||
        (lead.contact_phone || '').includes(query) ||
        (lead.service_required || '').toLowerCase().includes(query)
      );
    });
  }, [leads, radarFilter, activeTab, statusFilter, sourceFilter, timeframeFilter, startDate, endDate, searchTerm, duplicatePhones]);

  // Metrics Reference Calculation
  const metrics = useMemo(() => {
    const list = leads || [];
    let leadsAddedCount = 0;
    let connectedCount = 0;
    let pendingCount = 0;
    let followUpCount = 0;
    let expectedDealsCount = 0;
    let expectedProfitSum = 0;
    let closedDealsCount = 0;
    let totalSalesSum = 0;
    let netProfitSum = 0;

    list.forEach(l => {
      // 1. Leads Added: excludes transferred away leads from sender, credits receiver
      if (!l.is_reassigned || l.assigned_to === effectiveRepId || isAllReps) {
        leadsAddedCount++;
      }

      // 2. Connected: 1st Call Done or Connected Through Watsapp
      if (l.call_status === '1st Call Done' || l.call_status === 'Connected Through Watsapp') {
        connectedCount++;
      }

      // 3. Pending: Call Status is Pending or empty
      if (!l.call_status || l.call_status === 'Pending') {
        pendingCount++;
      }

      // 4. Follow Up
      if (l.next_follow_up_at || l.second_followup_status === 'Follow Up Required') {
        followUpCount++;
      }

      // 5. Expected Deals & Expected Profit
      const qAmt = Number(l.quoted_amount) || 0;
      const expGovt = Number(l.expected_govt_fee) || 0;
      const isWon = l.status === 'converted' || (Number(l.total_amount) || 0) > 0;
      if (qAmt > 0 && !isWon && l.status !== 'lost') {
        expectedDealsCount++;
        const expProf = l.expected_profit != null ? Number(l.expected_profit) : Math.max(0, qAmt - expGovt);
        expectedProfitSum += expProf;
      }

      // 6. Closed Deals, Sales & Profit
      const tot = Number(l.total_amount) || 0;
      const gf = Number(l.govt_fee) || 0;
      if (isWon) {
        closedDealsCount++;
        totalSalesSum += tot;
        const prof = l.profit != null ? Number(l.profit) : (tot - gf);
        netProfitSum += prof;
      }
    });

    const conversionRate = leadsAddedCount > 0 
      ? ((closedDealsCount / leadsAddedCount) * 100).toFixed(1) 
      : '0.0';

    return {
      leadsAddedCount,
      connectedCount,
      pendingCount,
      followUpCount,
      expectedDealsCount,
      expectedProfitSum,
      closedDealsCount,
      totalSalesSum,
      netProfitSum,
      conversionRate,
    };
  }, [leads, effectiveRepId, isAllReps]);

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    try {
      await deleteLeadMutation.mutateAsync(leadToDelete.id);
      toast.success('Lead deleted successfully');
      setLeadToDelete(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete lead');
    }
  };

  const handleToggleCoordinator = (employeeId: string, currentStatus: boolean) => {
    updateEmployeeMutation.mutate({
      id: employeeId,
      updates: {
        can_assign_leads: !currentStatus
      } as any
    }, {
      onSuccess: () => {
        toast.success(`Lead Coordinator role ${!currentStatus ? 'assigned' : 'removed'}`);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to update role');
      }
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      case 'contacted':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'interested':
      case 'qualified':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'on_progress':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'quoted':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'negotiating':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'converted':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'cancelled':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'lost':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'on_hold':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-[1650px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Top Banner / Sales Head Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border border-border rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Zap size={160} className="text-primary" />
        </div>
        
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-primary/20">
              Sales Portal 2.0
            </span>
            {isSalesHead && (
              <span className="bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-amber-500/20 flex items-center gap-1">
                <Crown size={12} /> Sales Head View
              </span>
            )}
            {canAssignLeads && !isSalesHead && (
              <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-indigo-500/20 flex items-center gap-1">
                <Target size={12} /> Lead Coordinator
              </span>
            )}
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-syne font-bold text-foreground">
            {isSalesHead ? 'Team Sales Pipeline' : 'My Sales Workspace'}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xl">
            Single living deal row from initial inquiry to closed sale. Real-time follow-up radar, automatic net profit calculation.
          </p>

          {/* Sales Head Team Rep Switcher */}
          {isSalesHead && (
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Viewing Rep:
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedRepId}
                  onChange={e => setSelectedRepId(e.target.value)}
                  className="bg-muted/80 border border-primary/40 text-foreground font-bold text-xs px-4 py-2 rounded-xl outline-none shadow-sm cursor-pointer hover:border-primary transition-all"
                >
                  <option value="all">👑 All Sales Reps (Whole Team)</option>
                  {salesReps.map(rep => (
                    <option key={rep.id} value={rep.id}>
                      {rep.full_name} {rep.is_sales_head ? '👑 (Head)' : rep.can_assign_leads ? '🎯 (Coordinator)' : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsCoordinatorModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                  title="Assign Lead Coordinator role to team member"
                >
                  <Target size={14} />
                  <span>Manage Coordinator</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 relative z-10 shrink-0 flex-wrap">
          <button 
            onClick={() => refetch()}
            className="p-3 rounded-2xl bg-muted/50 hover:bg-white/10 text-foreground transition-all border border-border"
            title="Refresh Deals"
          >
            <RefreshCw size={16} />
          </button>
          
          <button
            onClick={() => setIsDailySheetOpen(true)}
            className="p-3 rounded-2xl bg-muted/50 hover:bg-white/10 text-foreground border border-border transition-all flex items-center gap-2 text-xs font-bold shadow-sm active:scale-95"
            title="Open Daily Sales Sheet (DSR)"
          >
            <FileSpreadsheet size={16} />
            <span>Daily Sheet</span>
          </button>

          <button
            onClick={() => setIsExportCenterOpen(true)}
            className="p-3 rounded-2xl bg-gradient-to-r from-primary/10 to-gold/20 hover:from-primary/20 hover:to-gold/30 text-primary border border-primary/40 transition-all flex items-center gap-2 text-xs font-bold shadow-md shadow-gold/10 active:scale-95"
            title="1-Click Multi-Role Export Center (Excel, CSV, PDF)"
          >
            <Download size={16} />
            <span>1-Click Export Center</span>
          </button>

          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-primary text-[#0A0F1E] font-bold px-5 py-3 rounded-xl hover:shadow-lg hover:shadow-gold/20 active:scale-95 transition-all flex items-center gap-2 text-sm"
          >
            <Plus size={18} />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* METRICS REFERENCE (7 Live Business Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Metric 1: Leads Added */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Leads Added</span>
            <Users size={14} className="text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-foreground">{metrics.leadsAddedCount}</span>
            <span className="text-[10px] text-muted-foreground">inquiries</span>
          </div>
        </div>

        {/* Metric 2: Connected */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Connected</span>
            <PhoneCall size={14} className="text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-blue-400">{metrics.connectedCount}</span>
            <span className="text-[10px] text-muted-foreground">calls/chat</span>
          </div>
        </div>

        {/* Metric 3: Pending 1st Call */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pending Call</span>
            <AlertCircle size={14} className="text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-amber-400">{metrics.pendingCount}</span>
            <span className="text-[10px] text-muted-foreground">to call</span>
          </div>
        </div>

        {/* Metric 4: Expected Deals */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm group hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Pipeline Exp.</span>
            <TrendingUp size={14} className="text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-purple-400">{metrics.expectedDealsCount}</span>
              <span className="text-[10px] text-muted-foreground">quoted</span>
            </div>
            <div className="text-[10px] font-mono text-purple-300 font-bold mt-0.5 truncate">
              Exp: OMR {metrics.expectedProfitSum.toFixed(3)}
            </div>
          </div>
        </div>

        {/* Metric 5: Won Deals */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Closed Deals</span>
            <Award size={14} className="text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-emerald-400">{metrics.closedDealsCount}</span>
            <span className="text-[10px] text-muted-foreground">won</span>
          </div>
        </div>

        {/* Metric 6: Net Profit */}
        <div className="bg-gradient-to-br from-emerald-950/20 to-emerald-900/10 border border-emerald-500/30 rounded-2xl p-4 shadow-sm group hover:border-emerald-500/60 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Net Profit</span>
            <Sparkles size={14} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-lg font-black font-mono text-emerald-400 block truncate">
              OMR {metrics.netProfitSum.toFixed(3)}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono block mt-0.5 truncate">
              Sale: OMR {metrics.totalSalesSum.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Metric 7: Conversion Rate % */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm group hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Win Rate</span>
            <Percent size={14} className="text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-foreground">{metrics.conversionRate}%</span>
            <span className="text-[10px] text-muted-foreground">conversion</span>
          </div>
        </div>
      </div>

      {/* FOLLOW-UP RADAR (Interactive Action Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card/70 border border-border rounded-2xl">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Follow-Up Radar:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Overdue Button Pill */}
          <button
            type="button"
            onClick={() => setRadarFilter(radarFilter === 'overdue' ? 'all' : 'overdue')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95",
              radarFilter === 'overdue'
                ? "bg-red-500 text-white border-red-400 shadow-md shadow-red-500/20"
                : radarCounts.overdue > 0
                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                : "bg-muted/40 text-muted-foreground border-border hover:bg-white/5"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span>🔴 OVERDUE ({radarCounts.overdue})</span>
          </button>

          {/* Today Button Pill */}
          <button
            type="button"
            onClick={() => setRadarFilter(radarFilter === 'today' ? 'all' : 'today')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95",
              radarFilter === 'today'
                ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20 font-black"
                : radarCounts.today > 0
                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-muted/40 text-muted-foreground border-border hover:bg-white/5"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>🟡 DUE TODAY ({radarCounts.today})</span>
          </button>

          {/* Upcoming Button Pill */}
          <button
            type="button"
            onClick={() => setRadarFilter(radarFilter === 'upcoming' ? 'all' : 'upcoming')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95",
              radarFilter === 'upcoming'
                ? "bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/20"
                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>🟢 UPCOMING ({radarCounts.upcoming})</span>
          </button>

          {/* Duplicate Phone Pill */}
          {radarCounts.duplicate > 0 && (
            <button
              type="button"
              onClick={() => setRadarFilter(radarFilter === 'duplicate' ? 'all' : 'duplicate')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95",
                radarFilter === 'duplicate'
                  ? "bg-orange-500 text-white border-orange-400 shadow-md shadow-orange-500/20"
                  : "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30"
              )}
            >
              <AlertTriangle size={13} />
              <span>DUPLICATES ({radarCounts.duplicate})</span>
            </button>
          )}

          {/* Clear Active Radar Filter */}
          {radarFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setRadarFilter('all')}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-muted hover:bg-white/10 text-foreground border border-border flex items-center gap-1"
            >
              <X size={12} />
              <span>Clear Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs, Search & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 border border-border rounded-2xl p-4">
        {/* Quick Filter Tabs */}
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/40 w-fit">
          {(['all', 'today', 'new', 'on_progress', 'converted'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap capitalize",
                activeTab === tab 
                  ? "bg-primary text-[#0A0F1E] shadow-md shadow-gold/10" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === 'today' ? "Today's Follow-ups" : tab === 'on_progress' ? "On Progress" : tab}
            </button>
          ))}
        </div>

        {/* Search, Filter Panel & View Mode Toggle */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search client, phone, service..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-muted/30 border border-border/80 text-foreground text-xs pl-10 pr-4 py-2 rounded-xl outline-none focus:border-primary transition-all placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Advanced Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-xl border border-border/80 transition-all flex items-center justify-center gap-1.5 text-xs font-bold shrink-0",
              showFilters ? "bg-primary text-[#0A0F1E]" : "bg-muted/30 text-foreground hover:bg-white/5"
            )}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Filters</span>
          </button>

          {/* View Mode Toggle: Living Table vs Cards vs List */}
          <div className="flex items-center p-1 bg-muted/40 rounded-xl border border-border/40 shrink-0">
            <button
              onClick={() => setViewMode('living')}
              className={cn(
                "p-1.5 rounded-lg transition-all flex items-center gap-1 text-[11px] font-bold px-2",
                viewMode === 'living' ? "bg-primary text-[#0A0F1E]" : "text-muted-foreground hover:text-foreground"
              )}
              title="Living Deal Spreadsheet Grid (Continuous Deals)"
            >
              <Table size={14} />
              <span className="hidden sm:inline">Living Grid</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-primary text-[#0A0F1E]" : "text-muted-foreground hover:text-foreground"
              )}
              title="Visual Cards View"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'list' ? "bg-primary text-[#0A0F1E]" : "text-muted-foreground hover:text-foreground"
              )}
              title="Compact List View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card border border-border rounded-2xl p-5 overflow-hidden shadow-xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Filter 1: Timeframe */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">Timeframe</label>
                <select 
                  value={timeframeFilter}
                  onChange={e => setTimeframeFilter(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="all">All Time</option>
                  <option value="weekly">This Week</option>
                  <option value="monthly">This Month</option>
                  <option value="yearly">This Year</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* Filter 2: Custom dates */}
              {timeframeFilter === 'custom' && (
                <div className="space-y-1.5 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">Start Date</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">End Date</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Filter 3: Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">Stage Status</label>
                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="all">All Statuses</option>
                  <option value="followup">With Follow-up Scheduled</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="quoted">Quoted</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              {/* Filter 4: Lead Source */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">Source</label>
                <select 
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="all">All Sources</option>
                  {sources?.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredLeads.length > 0 ? (
        viewMode === 'living' ? (
          /* ── 1. LIVING DEALS SINGLE-ROW GRID ── */
          <LivingDealsTable
            leads={filteredLeads}
            allLeads={leads || []}
            salesReps={salesReps}
            canAssignLeads={canAssignLeads}
            isSalesHead={isSalesHead}
            currentUserId={profile?.id}
            onSelectLead={lead => setSelectedLead(lead)}
            onOpenQuickInteraction={lead => setQuickLogLead(lead)}
          />
        ) : viewMode === 'grid' ? (
          /* ── 2. VISUAL CARD GRID ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLeads.map(lead => {
              const isOverdue = lead.next_follow_up_at && isBefore(new Date(lead.next_follow_up_at), startOfDay(new Date()));
              return (
                <div 
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="bg-card border border-border hover:border-gold/20 rounded-3xl p-6 shadow-xl transition-all relative overflow-hidden group flex flex-col justify-between min-h-[220px] cursor-pointer"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border">
                        {lead.lead_code || 'DEAL'}
                      </span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        getStatusBadgeClass(lead.status)
                      )}>
                        {lead.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                        {lead.contact_name}
                      </h3>
                      {lead.company_name && (
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{lead.company_name}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border/40">
                      {lead.contact_phone ? (
                        <a 
                          href={`tel:${lead.contact_phone}`}
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Phone size={12} />
                          <span>{lead.contact_phone}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground/40 italic">No phone</span>
                      )}

                      {lead.call_status && (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                          {lead.call_status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {lead.next_follow_up_at ? (
                        <span className={cn("font-medium", isOverdue && "text-red-400 font-bold")}>
                          {format(new Date(lead.next_follow_up_at), 'MMM dd')}
                          {isOverdue && ' (Overdue)'}
                        </span>
                      ) : (
                        <span className="opacity-40">No follow-up</span>
                      )}
                    </div>
                    {lead.profit != null && Number(lead.profit) > 0 && (
                      <span className="font-mono font-bold text-emerald-400">
                        Profit: OMR {Number(lead.profit).toFixed(3)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── 3. COMPACT LIST VIEW ── */
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-muted/60 border-b border-border text-[10px] uppercase font-bold text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3">Call Status</th>
                    <th className="px-6 py-3">Next Action</th>
                    <th className="px-6 py-3">Total Sale</th>
                    <th className="px-6 py-3">Net Profit</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLeads.map(lead => (
                    <tr 
                      key={lead.id} 
                      onClick={() => setSelectedLead(lead)}
                      className="hover:bg-white/[0.02] cursor-pointer"
                    >
                      <td className="px-6 py-4 font-bold text-foreground">
                        {lead.contact_name}
                      </td>
                      <td className="px-6 py-4 font-mono text-muted-foreground">
                        {lead.contact_phone || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {lead.call_status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {lead.next_follow_up_at ? format(new Date(lead.next_follow_up_at), 'MMM dd, yyyy') : '—'}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-foreground">
                        OMR {Number(lead.total_amount || 0).toFixed(3)}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-400">
                        OMR {Number(lead.profit || 0).toFixed(3)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLeadToDelete(lead);
                          }}
                          className="p-1 rounded-lg text-muted-foreground hover:text-red-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-card border border-border rounded-[2.5rem] text-center px-6">
          <div className="w-20 h-20 bg-muted/30 rounded-3xl flex items-center justify-center text-muted-foreground/40 mb-6">
            <Compass size={40} className="opacity-40" />
          </div>
          <h4 className="text-foreground font-bold text-lg mb-2">No deals found</h4>
          <p className="text-muted-foreground/60 text-sm max-w-xs mb-6">
            No deals found matching the current criteria. Click "Add Lead" to register an opportunity.
          </p>
        </div>
      )}

      {/* SlideOvers & Modals */}
      <AddLeadSlideOver
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      <LeadDetailSlideOver
        isOpen={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        lead={leads?.find(l => l.id === selectedLead?.id) || selectedLead}
      />

      <DailySalesSheetModal
        isOpen={isDailySheetOpen}
        onClose={() => setIsDailySheetOpen(false)}
      />

      {/* 1-Click Multi-Report Export Center Modal */}
      <SalesExportCenterModal
        isOpen={isExportCenterOpen}
        onClose={() => setIsExportCenterOpen(false)}
        leads={filteredLeads}
        salesReps={salesReps}
        leadSources={sources}
        currentUserId={profile?.id}
        isSalesHead={isSalesHead}
      />

      <QuickInteractionModal
        isOpen={quickLogLead !== null}
        onClose={() => setQuickLogLead(null)}
        lead={quickLogLead}
      />

      {/* Delete Confirmation Modal */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground">Delete Deal</h3>
            <p className="text-xs text-muted-foreground">
              Are you sure you want to delete lead for <strong>{leadToDelete.contact_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setLeadToDelete(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Head: Delegate Lead Coordinator Modal */}
      {isCoordinatorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-indigo-400" />
                <h3 className="text-base font-bold text-foreground">Lead Coordinator Delegation</h3>
              </div>
              <button
                onClick={() => setIsCoordinatorModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Employees with the <strong>Lead Coordinator</strong> role (e.g. Sandra) can reassign inbound leads among team members using the dedicated Reassignment columns.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {salesReps.map(rep => {
                const isCoordinator = Boolean(rep.can_assign_leads);
                return (
                  <div 
                    key={rep.id} 
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border hover:border-indigo-500/30 transition-all"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">{rep.full_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{rep.employee_code}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleCoordinator(rep.id, isCoordinator)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                        isCoordinator 
                          ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" 
                          : "bg-muted text-muted-foreground hover:text-foreground border border-border"
                      )}
                    >
                      {isCoordinator ? (
                        <>
                          <Check size={12} />
                          <span>Coordinator</span>
                        </>
                      ) : (
                        <span>Assign</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCoordinatorModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-primary text-[#0A0F1E] font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
