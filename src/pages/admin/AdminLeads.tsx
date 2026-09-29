import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBranch } from '../../contexts/BranchContext';
import { 
  Zap, Users, UserCheck, AlertCircle, Search, 
  RefreshCw, Loader2, Compass, Calendar, ChevronDown, Check
} from 'lucide-react';
import { useAdminLeads } from '../../hooks/shared/useLeads';
import { useAdminEmployees } from '../../hooks/admin/useAdminEmployees';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  new: '#94A3B8',       // Zinc
  contacted: '#3B82F6', // Blue
  interested: '#6366F1',// Indigo
  qualified: '#8B5CF6', // Purple
  quoted: '#F59E0B',    // Amber
  negotiating: '#EC4899',// Pink
  converted: '#10B981',  // Emerald
  lost: '#EF4444',      // Red
  on_hold: '#F97316'    // Orange
};

export default function AdminLeads() {
  const { selectedBranchId } = useBranch();
  const { useAllLeadsList, useReassignLead } = useAdminLeads();
  const { data: leads, isLoading, refetch } = useAllLeadsList();
  const { data: employees } = useAdminEmployees();
  const reassignLeadMutation = useReassignLead();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [reassigningLeadId, setReassigningLeadId] = useState<string | null>(null);

  const employeesList = employees || [];
  
  // Filter by branch first (leads assigned to employees in this branch OR unassigned leads)
  const branchLeads = (leads || []).filter(lead => {
    if (selectedBranchId) {
      return lead.assigned_to_profile?.branch_id === selectedBranchId || !lead.assigned_to;
    }
    return true;
  });

  // Calculate KPIs
  const totalLeads = branchLeads.length;
  const convertedLeads = branchLeads.filter(l => l.status === 'converted').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  const activeLeads = branchLeads.filter(l => !['converted', 'lost'].includes(l.status)).length;

  // Filter Leads
  const filteredLeads = branchLeads.filter(lead => {
    // 1. Search Query
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || 
      lead.contact_name.toLowerCase().includes(query) ||
      (lead.contact_phone || '').includes(query) ||
      (lead.contact_email || '').toLowerCase().includes(query) ||
      (lead.company_name || '').toLowerCase().includes(query) ||
      (lead.lead_code || '').toLowerCase().includes(query);

    // 2. Status Filter
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;

    // 3. Employee Filter
    const matchesEmployee = employeeFilter === 'all' || lead.assigned_to === employeeFilter;

    return matchesSearch && matchesStatus && matchesEmployee;
  });

  // Calculate Funnel / Chart Data
  const statusCounts: Record<string, number> = {
    new: 0, contacted: 0, interested: 0, qualified: 0,
    quoted: 0, negotiating: 0, converted: 0, lost: 0, on_hold: 0
  };
  branchLeads.forEach(l => {
    if (statusCounts[l.status] !== undefined) {
      statusCounts[l.status]++;
    }
  });

  const chartData = Object.keys(statusCounts).map(status => ({
    name: status.replace('_', ' ').toUpperCase(),
    value: statusCounts[status],
    color: STATUS_COLORS[status]
  })).filter(item => item.value > 0);

  const handleReassign = async (leadId: string, employeeId: string) => {
    if (!employeeId) return;
    setReassigningLeadId(leadId);
    try {
      await reassignLeadMutation.mutateAsync({ leadId, employeeId });
      toast.success('Lead reassigned successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Reassignment failed');
    } finally {
      setReassigningLeadId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status] || '#94A3B8';
    return (
      <span 
        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border"
        style={{ 
          backgroundColor: `${color}10`, 
          borderColor: `${color}30`, 
          color: color 
        }}
      >
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card border border-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Compass size={150} className="text-primary" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-syne font-bold text-foreground">Leads CRM Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor leads status, sales conversions, and reassign representatives.</p>
        </div>
        <button 
          onClick={() => refetch()}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border hover:bg-white/5 transition-all text-xs font-bold text-foreground relative z-10 shrink-0"
        >
          <RefreshCw size={14} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Total Leads</p>
          <h3 className="text-3xl font-bold font-mono text-foreground mt-2">{totalLeads}</h3>
          <span className="text-[10px] text-muted-foreground/50">All captured prospects</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Converted Deals</p>
          <h3 className="text-3xl font-bold font-mono text-emerald-500 mt-2">{convertedLeads}</h3>
          <span className="text-[10px] text-emerald-500/50">Successfully onboarded clients</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Conversion Rate</p>
          <h3 className="text-3xl font-bold font-mono text-primary mt-2">{conversionRate}%</h3>
          <span className="text-[10px] text-primary/50">Average close performance</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Active Follow-ups</p>
          <h3 className="text-3xl font-bold font-mono text-blue-400 mt-2">{activeLeads}</h3>
          <span className="text-[10px] text-blue-400/50">Leads currently in negotiation</span>
        </div>
      </section>

      {/* Visual Pipeline Funnel Chart */}
      {chartData.length > 0 && (
        <section className="bg-card border border-border rounded-[2rem] p-6 lg:p-8 shadow-xl">
          <h3 className="text-lg font-syne font-bold text-foreground mb-6">Lead Pipeline Funnel</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#D4AF37', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Filters and Table */}
      <section className="bg-card border border-border rounded-[2rem] shadow-xl overflow-hidden">
        {/* Filters Header */}
        <div className="p-6 lg:p-8 border-b border-border bg-white/[0.01] flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by code, client, or company..."
              className="w-full bg-background border border-border rounded-xl py-2.5 pl-12 pr-4 text-sm text-foreground focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-xl py-2.5 px-4 text-xs text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="quoted">Quoted</option>
              <option value="negotiating">Negotiating</option>
              <option value="converted">Converted</option>
              <option value="cancelled">Cancelled</option>
              <option value="on_hold">On Hold</option>
            </select>

            <select
              value={employeeFilter}
              onChange={e => setEmployeeFilter(e.target.value)}
              className="bg-background border border-border rounded-xl py-2.5 px-4 text-xs text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="all">All Representatives</option>
              {employeesList.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Leads Table */}
        <div className="overflow-x-auto min-h-[280px]">
          {filteredLeads.length > 0 ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest bg-white/[0.01]">
                  <th className="p-5 font-semibold">Lead Code</th>
                  <th className="p-5 font-semibold">Contact Info</th>
                  <th className="p-5 font-semibold">Lead Source</th>
                  <th className="p-5 font-semibold">Status</th>
                  <th className="p-5 font-semibold">Assigned Agent</th>
                  <th className="p-5 font-semibold">Date Created</th>
                  <th className="p-5 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="p-5 align-middle">
                      <span className="text-xs font-mono font-bold text-primary">{lead.lead_code || '—'}</span>
                    </td>
                    <td className="p-5 align-middle space-y-1">
                      <p className="text-xs font-bold text-foreground leading-none">{lead.contact_name}</p>
                      <p className="text-[10px] text-muted-foreground">{lead.contact_phone || lead.contact_email || 'No contact info'}</p>
                      {lead.company_name && (
                        <p className="text-[9px] text-[#D4AF37] uppercase font-bold tracking-wider">{lead.company_name}</p>
                      )}
                    </td>
                    <td className="p-5 align-middle">
                      <span className="text-xs text-foreground">{lead.lead_sources?.name || 'Unknown'}</span>
                    </td>
                    <td className="p-5 align-middle">
                      {getStatusBadge(lead.status)}
                    </td>
                    <td className="p-5 align-middle text-xs text-foreground font-medium">
                      {(lead as any).assigned_to_profile?.full_name || 'Unassigned'}
                    </td>
                    <td className="p-5 align-middle text-[11px] text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-5 align-middle text-center">
                      <div className="relative inline-block">
                        <select
                          value=""
                          onChange={(e) => handleReassign(lead.id, e.target.value)}
                          disabled={reassigningLeadId === lead.id}
                          className="appearance-none bg-background hover:bg-white/5 border border-border hover:border-gold/30 rounded-lg pl-3.5 pr-8 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer outline-none transition-all disabled:opacity-50"
                        >
                          <option value="" disabled>
                            {reassigningLeadId === lead.id ? 'Saving...' : 'Reassign'}
                          </option>
                          {employeesList.map(emp => (
                            <option key={emp.id} value={emp.id}>
                              {emp.full_name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-20 text-center text-muted-foreground">
              <AlertCircle className="mx-auto mb-4 text-muted-foreground/30" size={36} />
              <p className="text-sm">No leads match your active filters.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
