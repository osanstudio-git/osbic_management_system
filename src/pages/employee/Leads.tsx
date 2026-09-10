import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLeads } from '../../hooks/shared/useLeads';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Phone, Calendar, Info, Search, 
  ChevronRight, AlertCircle, RefreshCw, Zap,
  Compass, LayoutGrid, List, SlidersHorizontal, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isBefore, startOfDay } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AddLeadSlideOver from '../../components/employee/AddLeadSlideOver';
import LeadDetailSlideOver from '../../components/employee/LeadDetailSlideOver';
import { type Lead } from '../../hooks/shared/useLeads';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function EmployeeLeads() {
  const { profile } = useAuth();
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

  const { useLeadsList, useLeadSourcesList } = useLeads(profile?.id);
  const { data: leads, isLoading, refetch } = useLeadsList();
  const { data: sources } = useLeadSourcesList();
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'new' | 'on_progress' | 'converted'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Filtering leads
  const filteredLeads = (leads || []).filter(lead => {
    // 1. Tab filter
    if (activeTab === 'new' && lead.status !== 'new') return false;
    if (activeTab === 'on_progress') {
      if (!['contacted', 'interested', 'on_progress', 'qualified', 'quoted', 'negotiating'].includes(lead.status)) return false;
    }
    if (activeTab === 'converted' && lead.status !== 'converted') return false;
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
      (lead.contact_phone || '').includes(query)
    );
  });

  const exportLeadsToCSV = () => {
    if (!filteredLeads.length) {
      toast.error('No leads found for export');
      return;
    }

    const headers = [
      'Lead Code',
      'Contact Name',
      'Phone Number',
      'Email Address',
      'Company Name',
      'Lead Source',
      'Status',
      'Interested Services',
      'Next Follow-up',
      'Created Date'
    ];

    const csvData = filteredLeads.map(lead => {
      const sourceName = sources?.find(s => s.id === lead.source_id)?.name || 'Direct / Unknown';
      const interestedServices = (lead.interested_services || [])
        .map((s: any) => s.name || s.name_en || s)
        .join('; ') || 'N/A';

      return [
        lead.lead_code || 'N/A',
        lead.contact_name || 'N/A',
        lead.contact_phone || 'N/A',
        lead.contact_email || 'N/A',
        lead.company_name || 'N/A',
        sourceName,
        lead.status?.toUpperCase() || 'N/A',
        interestedServices,
        lead.next_follow_up_at ? format(new Date(lead.next_follow_up_at), 'yyyy-MM-dd') : 'N/A',
        format(new Date(lead.created_at), 'yyyy-MM-dd HH:mm')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Leads_Export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredLeads.length} leads to CSV`);
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
    <div className="space-y-8 pb-24 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Zap size={150} className="text-primary" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-primary/20">
              CRM Pipeline
            </span>
          </div>
          <h1 className="text-3xl font-syne font-bold text-foreground mb-2">My Leads</h1>
          <p className="text-muted-foreground text-sm font-medium">Track your potential clients, active communications, and follow-ups.</p>
        </div>

        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <button 
            onClick={() => refetch()}
            className="p-3 rounded-2xl bg-muted/50 hover:bg-white/10 text-foreground transition-all border border-border"
            title="Refresh Leads"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={exportLeadsToCSV}
            className="p-3 rounded-2xl bg-muted/50 hover:bg-white/10 text-foreground transition-all border border-border flex items-center gap-2 text-xs font-bold"
            title="Export Filtered Leads (CSV)"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-primary text-[#0A0F1E] font-bold px-6 py-3 rounded-xl hover:shadow-lg hover:shadow-gold/20 active:scale-95 transition-all flex items-center gap-2 text-sm"
          >
            <Plus size={18} />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Search & Tabs bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/50 border border-border rounded-2xl p-4">
        {/* Filter Tabs */}
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1 bg-muted/30 rounded-xl border border-border/40 w-fit">
          {(['all', 'today', 'new', 'on_progress', 'converted'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap capitalize",
                activeTab === tab 
                  ? "bg-primary text-[#0A0F1E] shadow-lg shadow-gold/10" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === 'today' ? "Today's Follow-ups" : tab === 'on_progress' ? "On Progress" : tab}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-muted/30 border border-border/80 text-foreground text-sm pl-11 pr-4 py-2.5 rounded-xl outline-none focus:border-primary transition-all placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Filters Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2.5 rounded-xl border border-border/80 transition-all flex items-center justify-center gap-1.5 text-xs font-bold shrink-0",
              showFilters ? "bg-primary text-[#0A0F1E]" : "bg-muted/30 text-foreground hover:bg-white/5"
            )}
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
          </button>

          {/* Grid/List Toggle */}
          <div className="flex items-center p-1 bg-muted/30 rounded-xl border border-border/40 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-primary text-[#0A0F1E]" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                viewMode === 'list' ? "bg-primary text-[#0A0F1E]" : "text-muted-foreground hover:text-foreground"
              )}
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
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="bg-card border border-border rounded-2xl p-5 overflow-hidden shadow-xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Filter 1: Timeframe */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">Timeframe (Created)</label>
                <select 
                  value={timeframeFilter}
                  onChange={e => setTimeframeFilter(e.target.value as any)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
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
                <div className="space-y-1.5 md:col-span-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">Start Date</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">End Date</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Filter 3: Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">Lead Status</label>
                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="all">All Statuses</option>
                  <option value="followup">With Follow-up Scheduled</option>
                  <option value="new">New</option>
                  <option value="on_progress">On Progress</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="qualified">Qualified</option>
                  <option value="quoted">Quoted</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="converted">Converted</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="lost">Lost</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>

              {/* Filter 4: Lead Source */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block ml-1">Lead Source</label>
                <select 
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
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

      {/* Leads List Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredLeads.length > 0 ? (
        viewMode === 'grid' ? (
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
                    {/* Status Badge & Code */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border">
                        {lead.lead_code || 'LEAD'}
                      </span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        getStatusBadgeClass(lead.status)
                      )}>
                        {lead.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Client Info */}
                    <div>
                      <h3 className="text-lg font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                        {lead.contact_name}
                      </h3>
                      {lead.company_name && (
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{lead.company_name}</p>
                      )}
                    </div>

                    {/* Phone & Source */}
                    <div className="flex items-center justify-between flex-wrap gap-4 pt-1 border-t border-border/40">
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

                      {lead.lead_sources?.name && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">
                          {lead.lead_sources.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Follow up Date info */}
                  {lead.next_follow_up_at && (
                    <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">Next Action</span>
                      <span className={cn(
                        "text-xs font-bold inline-flex items-center gap-1.5",
                        isOverdue ? "text-red-400" : "text-muted-foreground"
                      )}>
                        <Calendar size={12} />
                        <span>{format(new Date(lead.next_follow_up_at), 'MMM dd, yyyy')}</span>
                        {isOverdue && <span className="text-[9px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20">Overdue</span>}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/20">
                    <th className="px-6 py-4">Lead Code</th>
                    <th className="px-6 py-4">Contact Name</th>
                    <th className="px-6 py-4">Company</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Next Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredLeads.map(lead => {
                    const isOverdue = lead.next_follow_up_at && isBefore(new Date(lead.next_follow_up_at), startOfDay(new Date()));
                    return (
                      <tr 
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-muted-foreground">{lead.lead_code || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-foreground hover:text-primary transition-colors">{lead.contact_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-muted-foreground">{lead.company_name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-muted-foreground">
                          {lead.contact_phone ? (
                            <a href={`tel:${lead.contact_phone}`} onClick={e => e.stopPropagation()} className="hover:text-primary hover:underline">{lead.contact_phone}</a>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          {lead.lead_sources?.name ? (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg">{lead.lead_sources.name}</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", getStatusBadgeClass(lead.status))}>
                            {lead.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {lead.next_follow_up_at ? (
                            <span className={cn("text-xs font-bold flex items-center gap-1.5", isOverdue ? "text-red-400" : "text-muted-foreground")}>
                              <Calendar size={12} />
                              <span>{format(new Date(lead.next_follow_up_at), 'MMM dd, yyyy')}</span>
                              {isOverdue && <span className="text-[9px] font-black uppercase tracking-wider text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 leading-none">Overdue</span>}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
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
          <h4 className="text-foreground font-bold text-lg mb-2">No leads found</h4>
          <p className="text-muted-foreground/60 text-sm max-w-xs mb-6">
            You don't have any leads in this category. Click the add button to insert a new client opportunity.
          </p>
        </div>
      )}

      <AddLeadSlideOver
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      <LeadDetailSlideOver
        isOpen={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        lead={leads?.find(l => l.id === selectedLead?.id) || selectedLead}
      />
    </div>
  );
}
