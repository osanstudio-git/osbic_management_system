import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Megaphone,
  TrendingUp,
  Globe,
  Filter,
  Download,
  Search,
  ExternalLink,
  MessageCircle,
  FileText,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Zap,
  Activity,
  ArrowUpRight,
  Info,
  Phone,
  Mail,
  Copy,
  Check,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Building2,
  AlertCircle,
  LayoutGrid,
  List,
  Table as TableIcon,
  Send,
  Share2,
  Smartphone,
  Eye,
  UserCheck
} from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, startOfYear, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import { type Lead } from '../../hooks/shared/useLeads';

export default function MarketingHub() {
  const { profile } = useAuth();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const navigate = useNavigate();

  // Time & Filter states
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days' | 'year' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [streamViewMode, setStreamViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'live_feed' | 'sales_sla'>('overview');

  // Realtime state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [newLeadsSinceLoad, setNewLeadsSinceLoad] = useState(0);
  const queryClient = useQueryClient();

  // 1. Fetch Inbound Leads with full UTM attribution
  const { data: leads, isLoading: isLoadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['marketing', 'inbound_leads'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*, lead_sources:source_id(id, name)')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn("MarketingHub primary query error, trying fallback:", error);
          const { data: simpleData, error: simpleError } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });
          if (simpleError) throw simpleError;
          return simpleData || [];
        }
        return (data || []) as any[];
      } catch (err) {
        console.error("Failed to load inbound leads:", err);
        return [];
      }
    },
    staleTime: 0, // Always consider stale so realtime triggers refetch correctly
  });

  // 2. Fetch Quotations — poll every 5 min (revenue data doesn't change per-second)
  const { data: quotations } = useQuery({
    queryKey: ['marketing', 'quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, lead_id, total_amount, status, created_at')
        .eq('type', 'quotation');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000, // every 5 minutes
  });

  // 3. Fetch Jobs — poll every 5 min
  const { data: jobs } = useQuery({
    queryKey: ['marketing', 'jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, client_id, total_fee, work_fee, ministry_fee, status, created_at');
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000, // every 5 minutes
  });

  // 4. Supabase Realtime — subscribe to new leads in real time
  useEffect(() => {
    const channel = supabase
      .channel('marketing-leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          // Immediately refresh leads query cache
          queryClient.invalidateQueries({ queryKey: ['marketing', 'inbound_leads'] });
          setNewLeadsSinceLoad(prev => prev + 1);
          // Fire a toast so the team knows instantly
          const lead = payload.new as any;
          const source = lead.utm_source || lead.utm_medium || 'Website';
          toast.success(
            `🎯 New lead: ${lead.contact_name || 'Unknown'} via ${source}`,
            { duration: 7000, icon: '📥' }
          );
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [queryClient]);

  // Copy helper
  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Base Date Filtered List for Counts & Feeds
  const baseTimeFilteredLeads = useMemo(() => {
    if (!leads) return [];
    let list = leads;

    const now = new Date();
    if (timeFilter === 'today') {
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      list = list.filter(l => {
        const d = new Date(l.created_at);
        return d >= todayStart && d <= todayEnd;
      });
    } else if (timeFilter === '7days') {
      const cutoff = subDays(now, 7);
      list = list.filter(l => new Date(l.created_at) >= cutoff);
    } else if (timeFilter === '30days') {
      const cutoff = subDays(now, 30);
      list = list.filter(l => new Date(l.created_at) >= cutoff);
    } else if (timeFilter === 'year') {
      const cutoff = startOfYear(now);
      list = list.filter(l => new Date(l.created_at) >= cutoff);
    } else if (timeFilter === 'custom') {
      if (customStartDate) {
        const start = startOfDay(new Date(customStartDate));
        list = list.filter(l => new Date(l.created_at) >= start);
      }
      if (customEndDate) {
        const end = endOfDay(new Date(customEndDate));
        list = list.filter(l => new Date(l.created_at) <= end);
      }
    }
    return list;
  }, [leads, timeFilter, customStartDate, customEndDate]);

  // Dynamic Channel Counts for Tab Badges
  const channelCounts = useMemo(() => {
    const counts = {
      all: baseTimeFilteredLeads.length,
      website: 0,
      google: 0,
      meta: 0,
      whatsapp: 0,
      referral: 0,
    };

    for (const l of baseTimeFilteredLeads) {
      const raw = (l.utm_source || l.lead_sources?.name || '').toLowerCase();
      const hasGclid = Boolean(l.gclid);
      const hasFbclid = Boolean(l.fbclid || l.leadgen_id);
      const isGoogle = raw.includes('google') || hasGclid;
      const isMeta = raw.includes('meta') || raw.includes('facebook') || raw.includes('instagram') || hasFbclid;
      const isWhatsapp = raw.includes('whatsapp');
      const isWebsite = (raw.includes('setup.osbic') || raw.includes('website') || raw.includes('landing') || Boolean(l.landing_page_url)) && !isGoogle && !isMeta;

      if (isGoogle) counts.google++;
      else if (isMeta) counts.meta++;
      else if (isWhatsapp) counts.whatsapp++;
      else if (isWebsite) counts.website++;
      else counts.referral++;
    }

    return counts;
  }, [baseTimeFilteredLeads]);

  // Filtered Leads based on Channel & Search Term
  const filteredLeads = useMemo(() => {
    let list = baseTimeFilteredLeads;

    if (channelFilter !== 'all') {
      list = list.filter(l => {
        const raw = (l.utm_source || l.lead_sources?.name || '').toLowerCase();
        const hasGclid = Boolean(l.gclid);
        const hasFbclid = Boolean(l.fbclid || l.leadgen_id);
        const isGoogle = raw.includes('google') || hasGclid;
        const isMeta = raw.includes('meta') || raw.includes('facebook') || raw.includes('instagram') || hasFbclid;
        const isWhatsapp = raw.includes('whatsapp');
        const isWebsite = (raw.includes('setup.osbic') || raw.includes('website') || raw.includes('landing') || Boolean(l.landing_page_url)) && !isGoogle && !isMeta;

        if (channelFilter === 'google') return isGoogle;
        if (channelFilter === 'meta') return isMeta;
        if (channelFilter === 'whatsapp') return isWhatsapp;
        if (channelFilter === 'website') return isWebsite;
        if (channelFilter === 'referral') return !isGoogle && !isMeta && !isWhatsapp && !isWebsite;
        return true;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(l => 
        l.contact_name?.toLowerCase().includes(term) ||
        l.company_name?.toLowerCase().includes(term) ||
        l.contact_phone?.includes(term) ||
        l.contact_email?.toLowerCase().includes(term) ||
        l.utm_campaign?.toLowerCase().includes(term) ||
        l.utm_term?.toLowerCase().includes(term) ||
        l.lead_code?.toLowerCase().includes(term)
      );
    }

    return list;
  }, [baseTimeFilteredLeads, channelFilter, searchTerm]);

  // Aggregate Funnel Metrics
  const stats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const contacted = filteredLeads.filter(l => l.status !== 'new').length;
    const qualified = filteredLeads.filter(l => ['interested', 'qualified', 'quoted', 'negotiating', 'converted'].includes(l.status)).length;
    const quoted = filteredLeads.filter(l => ['quoted', 'negotiating', 'converted'].includes(l.status)).length;
    const converted = filteredLeads.filter(l => l.status === 'converted').length;

    // Attributed Revenue from quotes/jobs linked to these leads
    const leadIds = new Set(filteredLeads.map(l => l.id));
    const clientIds = new Set(filteredLeads.map(l => l.client_id).filter(Boolean));

    const quotesTotalValue = (quotations || [])
      .filter(q => q.lead_id && leadIds.has(q.lead_id))
      .reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);

    const closedRevenue = (jobs || [])
      .filter(j => j.client_id && clientIds.has(j.client_id) && j.status !== 'cancelled')
      .reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);

    const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0.0';
    const qualifiedRate = totalLeads > 0 ? ((qualified / totalLeads) * 100).toFixed(1) : '0.0';

    return {
      totalLeads,
      contacted,
      qualified,
      quoted,
      converted,
      quotesTotalValue,
      closedRevenue,
      conversionRate,
      qualifiedRate
    };
  }, [filteredLeads, quotations, jobs]);

  // Campaign Breakdown
  const campaignAttribution = useMemo(() => {
    const groups: Record<string, {
      name: string;
      source: string;
      leadsCount: number;
      quotedCount: number;
      wonCount: number;
      revenue: number;
    }> = {};

    const clientIdsMap = new Map(filteredLeads.filter(l => l.client_id).map(l => [l.client_id, l]));

    for (const lead of filteredLeads) {
      const campaignKey = lead.utm_campaign || lead.lead_sources?.name || 'Direct / Organic';
      const sourceName = lead.utm_source || lead.lead_sources?.name || 'Website';

      if (!groups[campaignKey]) {
        groups[campaignKey] = {
          name: campaignKey,
          source: sourceName,
          leadsCount: 0,
          quotedCount: 0,
          wonCount: 0,
          revenue: 0
        };
      }

      groups[campaignKey].leadsCount += 1;
      if (['quoted', 'negotiating', 'converted'].includes(lead.status)) {
        groups[campaignKey].quotedCount += 1;
      }
      if (lead.status === 'converted') {
        groups[campaignKey].wonCount += 1;
      }
    }

    // Add Revenue from closed jobs
    if (jobs) {
      for (const job of jobs) {
        if (job.client_id && clientIdsMap.has(job.client_id) && job.status !== 'cancelled') {
          const matchedLead = clientIdsMap.get(job.client_id);
          const campaignKey = matchedLead?.utm_campaign || matchedLead?.lead_sources?.name || 'Direct / Organic';
          if (groups[campaignKey]) {
            groups[campaignKey].revenue += (Number(job.total_fee) || 0);
          }
        }
      }
    }

    return Object.values(groups).sort((a, b) => b.leadsCount - a.leadsCount);
  }, [filteredLeads, jobs]);

  // Channel Distribution (Google vs Meta vs Website vs WhatsApp)
  const channelDistribution = useMemo(() => {
    const channels: Record<string, number> = {
      'Google Ads': 0,
      'Meta Ads (FB/IG)': 0,
      'setup.osbic.net': 0,
      'WhatsApp Direct': 0,
      'Other': 0
    };

    for (const lead of filteredLeads) {
      const raw = (lead.utm_source || lead.lead_sources?.name || '').toLowerCase();
      if (raw.includes('google') || lead.gclid) channels['Google Ads'] += 1;
      else if (raw.includes('facebook') || raw.includes('meta') || raw.includes('instagram') || lead.fbclid || lead.leadgen_id) channels['Meta Ads (FB/IG)'] += 1;
      else if (raw.includes('whatsapp')) channels['WhatsApp Direct'] += 1;
      else if (raw.includes('setup.osbic') || raw.includes('website')) channels['setup.osbic.net'] += 1;
      else channels['Other'] += 1;
    }

    return channels;
  }, [filteredLeads]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) return toast.error('No leads to export');

    const headers = ['Lead Code', 'Name', 'Phone', 'Email', 'Company', 'Source', 'Campaign', 'Term/Keyword', 'GCLID', 'FBCLID', 'Status', 'Date'];
    const rows = filteredLeads.map(l => [
      l.lead_code || '',
      `"${l.contact_name || ''}"`,
      `"${l.contact_phone || ''}"`,
      `"${l.contact_email || ''}"`,
      `"${l.company_name || ''}"`,
      `"${l.utm_source || l.lead_sources?.name || ''}"`,
      `"${l.utm_campaign || ''}"`,
      `"${l.utm_term || ''}"`,
      `"${l.gclid || ''}"`,
      `"${l.fbclid || ''}"`,
      l.status,
      format(new Date(l.created_at), 'yyyy-MM-dd HH:mm')
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSBIC_Marketing_Leads_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Leads exported successfully');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-3xl border border-border/60 shadow-xl shadow-primary/5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
              <Megaphone size={22} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-syne font-bold text-foreground tracking-tight">Marketing & Acquisition Hub</h1>
              <p className="text-xs font-medium text-muted-foreground">
                Inbound Attribution, Google & Meta Ads Funnel, and Realtime Ingestion
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe selector */}
          <div className="flex items-center bg-muted/40 p-1 rounded-2xl border border-border/60 text-xs">
            {(['today', '7days', '30days', 'year', 'all'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTimeFilter(mode)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all capitalize ${
                  timeFilter === mode 
                    ? 'bg-card text-primary shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === '7days' ? '7 Days' : mode === '30days' ? '30 Days' : mode === 'all' ? 'All' : mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => { refetchLeads(); setNewLeadsSinceLoad(0); }}
            className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={isLoadingLeads ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* TOP 6 KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Inbound Leads */}
        <div className="bg-card/70 border border-border/60 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Inbound Leads</span>
            <Globe size={14} className="text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.totalLeads}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
              isRealtimeConnected
                ? 'text-emerald-500 bg-emerald-500/10'
                : 'text-muted-foreground bg-muted'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                isRealtimeConnected ? 'bg-emerald-500 animate-ping' : 'bg-muted-foreground'
              }`} />
              {isRealtimeConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">Forms & Ad submissions</p>
        </div>

        {/* Contacted */}
        <div className="bg-card/70 border border-border/60 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Contacted</span>
            <Phone size={14} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.contacted}</span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {stats.totalLeads > 0 ? Math.round((stats.contacted / stats.totalLeads) * 100) : 0}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">Sales Outreach logged</p>
        </div>

        {/* Qualified Rate */}
        <div className="bg-card/70 border border-border/60 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Qualified Leads</span>
            <Sparkles size={14} className="text-purple-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.qualified}</span>
            <span className="text-[10px] font-bold text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-md">
              {stats.qualifiedRate}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">High business intent</p>
        </div>

        {/* Quotes Sent */}
        <div className="bg-card/70 border border-border/60 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Quotations Sent</span>
            <FileText size={14} className="text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.quoted}</span>
            <span className="text-[9px] font-mono text-muted-foreground">
              {stats.quotesTotalValue.toFixed(0)} OMR
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">Official proposals built</p>
        </div>

        {/* Won Jobs */}
        <div className="bg-card/70 border border-border/60 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest">Jobs Won</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.converted}</span>
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
              {stats.conversionRate}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">Active client files created</p>
        </div>

        {/* Closed Revenue */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/30 p-4 rounded-2xl shadow-sm space-y-2">
          <div className="flex items-center justify-between text-primary">
            <span className="text-[10px] font-bold uppercase tracking-widest">Attributed Revenue</span>
            <TrendingUp size={14} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-syne text-primary">{stats.closedRevenue.toFixed(0)}</span>
            <span className="text-[10px] font-bold text-primary/80">OMR</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Direct ad campaign return</p>
        </div>
      </div>

      {/* WEBHOOK & INGESTION HEALTH STATUS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Astro Landing Page */}
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold text-xs">
              ⚡
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">setup.osbic.net (Astro)</h4>
              <p className="text-[10px] text-muted-foreground">Direct Form API / Edge Function</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            isRealtimeConnected
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              isRealtimeConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'
            }`} />
            {isRealtimeConnected ? 'Live' : 'Connecting...'}
          </span>
        </div>

        {/* Google Ads Lead Form */}
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xs">
              G
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Google Ads Webhook</h4>
              <p className="text-[10px] text-muted-foreground">Form Assets & Search Extensions</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Ready
          </span>
        </div>

        {/* Meta Ads Webhook */}
        <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">
              M
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Meta (FB / IG) Lead Ads</h4>
              <p className="text-[10px] text-muted-foreground">Graph API Webhook Listener</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Ready
          </span>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-border gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'overview' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers size={14} /> Campaign Attribution
        </button>

        <button
          onClick={() => { setActiveTab('live_feed'); setNewLeadsSinceLoad(0); }}
          className={`pb-3 px-3 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'live_feed' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity size={14} />
          Live Inbound Stream ({filteredLeads.length})
          {isRealtimeConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" title="Realtime connected" />
          )}
          {newLeadsSinceLoad > 0 && activeTab !== 'live_feed' && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
              {newLeadsSinceLoad}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sales_sla')}
          className={`pb-3 px-3 transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'sales_sla' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Clock size={14} /> Sales Response SLA
        </button>
      </div>

      {/* TAB CONTENT 1: CAMPAIGN ATTRIBUTION */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Channel breakdown visual pills */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(channelDistribution).map(([chName, count]) => (
              <div key={chName} className="p-3.5 bg-card/60 border border-border/60 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">{chName}</span>
                  <span className="text-lg font-bold font-syne text-foreground">{count} leads</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-primary">
                    {stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Campaign Performance Table */}
          <div className="bg-card border border-border/70 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">Campaign & Ad Set Attribution</h3>
                <p className="text-[11px] text-muted-foreground">Tracking end-to-end revenue generated by each marketing campaign</p>
              </div>
              <span className="text-xs font-bold text-muted-foreground">{campaignAttribution.length} active campaigns</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Campaign Name</th>
                    <th className="py-3 px-4">Source / Medium</th>
                    <th className="py-3 px-4 text-center">Inbound Leads</th>
                    <th className="py-3 px-4 text-center">Quotes Built</th>
                    <th className="py-3 px-4 text-center">Jobs Won</th>
                    <th className="py-3 px-4 text-center">Conversion %</th>
                    <th className="py-3 px-4 text-right">Revenue (OMR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {campaignAttribution.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No campaign attribution records found for this timeframe.
                      </td>
                    </tr>
                  ) : (
                    campaignAttribution.map((camp, idx) => {
                      const conv = camp.leadsCount > 0 ? ((camp.wonCount / camp.leadsCount) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-foreground">{camp.name}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-muted text-muted-foreground">
                              {camp.source}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-foreground">
                            {camp.leadsCount}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-indigo-500">
                            {camp.quotedCount}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-emerald-500">
                            {camp.wonCount}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold">
                            <span className={Number(conv) > 15 ? 'text-emerald-500 font-bold' : 'text-muted-foreground'}>
                              {conv}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-primary">
                            {camp.revenue > 0 ? `${camp.revenue.toFixed(3)} OMR` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: LIVE INBOUND STREAM */}
      {activeTab === 'live_feed' && (
        <div className="space-y-5">
          {/* SOURCE PILL TABS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {/* All */}
            <button
              onClick={() => setChannelFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                channelFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <span>⚡ All Leads</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                channelFilter === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
              }`}>
                {channelCounts.all}
              </span>
            </button>

            {/* Landing Page (setup.osbic.net) */}
            <button
              onClick={() => setChannelFilter('website')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                channelFilter === 'website'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-blue-500/40'
              }`}
            >
              <Globe size={13} className={channelFilter === 'website' ? 'text-white' : 'text-blue-400'} />
              <span>setup.osbic.net</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                channelFilter === 'website' ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {channelCounts.website}
              </span>
            </button>

            {/* Google Ads */}
            <button
              onClick={() => setChannelFilter('google')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                channelFilter === 'google'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-amber-500/40'
              }`}
            >
              <span className="font-bold text-[11px] text-amber-400">G</span>
              <span>Google Ads</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                channelFilter === 'google' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {channelCounts.google}
              </span>
            </button>

            {/* Meta Ads */}
            <button
              onClick={() => setChannelFilter('meta')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                channelFilter === 'meta'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-indigo-500/40'
              }`}
            >
              <span className="font-bold text-[11px] text-indigo-400">M</span>
              <span>Meta Ads (FB/IG)</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                channelFilter === 'meta' ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
              }`}>
                {channelCounts.meta}
              </span>
            </button>

            {/* WhatsApp Direct */}
            <button
              onClick={() => setChannelFilter('whatsapp')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                channelFilter === 'whatsapp'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-emerald-500/40'
              }`}
            >
              <MessageCircle size={13} className={channelFilter === 'whatsapp' ? 'text-white' : 'text-emerald-400'} />
              <span>WhatsApp Direct</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                channelFilter === 'whatsapp' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {channelCounts.whatsapp}
              </span>
            </button>

            {/* Referral / Others */}
            <button
              onClick={() => setChannelFilter('referral')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${
                channelFilter === 'referral'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-purple-500/40'
              }`}
            >
              <UserCheck size={13} className={channelFilter === 'referral' ? 'text-white' : 'text-purple-400'} />
              <span>Referral & Others</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                channelFilter === 'referral' ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              }`}>
                {channelCounts.referral}
              </span>
            </button>
          </div>

          {/* SEARCH & VIEW SWITCHER BAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                type="text"
                placeholder="Search leads by name, phone, email, campaign, keyword..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:border-primary outline-none transition-all shadow-sm"
              />
            </div>
            
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-card border border-border/70 rounded-xl p-1 shrink-0 self-end sm:self-auto">
              <button
                onClick={() => setStreamViewMode('grid')}
                className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  streamViewMode === 'grid'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid size={13} />
                <span className="text-[11px]">Grid</span>
              </button>

              <button
                onClick={() => setStreamViewMode('table')}
                className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  streamViewMode === 'table'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Data Table View"
              >
                <TableIcon size={13} />
                <span className="text-[11px]">Table</span>
              </button>
            </div>
          </div>

          {/* EMPTY STATE */}
          {filteredLeads.length === 0 ? (
            <div className="bg-card border border-border/70 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center text-muted-foreground mx-auto">
                <Filter size={22} />
              </div>
              <h4 className="text-sm font-bold text-foreground">No Inbound Leads in this Channel</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {channelFilter === 'website' && 'No website form submissions received in this date range.'}
                {channelFilter === 'google' && 'No Google Ads inbound submissions detected yet. Form webhook is active and ready.'}
                {channelFilter === 'meta' && 'No Meta (FB/IG) Lead Ads submitted yet. Graph API webhook is active and listening.'}
                {channelFilter === 'whatsapp' && 'No direct WhatsApp tracking leads in this timeframe.'}
                {channelFilter === 'referral' && 'No referral or walk-in records found.'}
                {channelFilter === 'all' && 'No leads match your current search and date filters.'}
              </p>
            </div>
          ) : streamViewMode === 'grid' ? (
            /* 1. GRID VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLeads.map((lead: any) => {
                const cleanPhone = (lead.contact_phone || '').replace(/[^0-9]/g, '');
                const waUrl = cleanPhone 
                  ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${lead.contact_name || ''}, thank you for contacting OSBIC regarding your Company Registration in Oman. How can we assist you today?`)}`
                  : null;

                const rawSrc = (lead.utm_source || lead.lead_sources?.name || '').toLowerCase();
                const isWebsite = rawSrc.includes('setup.osbic') || rawSrc.includes('website') || Boolean(lead.landing_page_url);
                const isGoogle = rawSrc.includes('google') || Boolean(lead.gclid);
                const isMeta = rawSrc.includes('meta') || rawSrc.includes('facebook') || rawSrc.includes('instagram') || Boolean(lead.fbclid || lead.leadgen_id);

                return (
                  <div 
                    key={lead.id} 
                    className="bg-card border border-border/70 rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase">{lead.lead_code || 'INBOUND'}</span>
                          <h4 className="text-sm font-bold text-foreground">{lead.contact_name}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          lead.status === 'new' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                          lead.status === 'converted' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {lead.status}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        {lead.company_name && (
                          <p className="flex items-center gap-1.5 text-foreground font-semibold">
                            <Building2 size={12} className="text-primary shrink-0" />
                            <span className="truncate">{lead.company_name}</span>
                          </p>
                        )}
                        {lead.contact_phone && (
                          <p className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Phone size={11} className="shrink-0" />
                            <span>{lead.contact_phone}</span>
                          </p>
                        )}
                        {lead.contact_email && (
                          <p className="flex items-center gap-1.5 text-[11px] truncate">
                            <Mail size={11} className="shrink-0" />
                            <span className="truncate">{lead.contact_email}</span>
                          </p>
                        )}
                      </div>

                      {/* Attribution Badges */}
                      <div className="pt-2 border-t border-border/40 flex flex-wrap gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                          isGoogle ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          isMeta ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          isWebsite ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-primary/10 text-primary border-primary/20'
                        }`}>
                          {lead.utm_source || lead.lead_sources?.name || 'Website'}
                        </span>
                        {lead.utm_campaign && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-muted text-muted-foreground truncate max-w-[150px]">
                            🎯 {lead.utm_campaign}
                          </span>
                        )}
                        {lead.gclid && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            GCLID
                          </span>
                        )}
                        {lead.fbclid && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            FBCLID
                          </span>
                        )}
                        {lead.referral_name && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            👤 Ref: {lead.referral_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Footer */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/40">
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-sm"
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                      ) : (
                        <button disabled className="opacity-50 py-1.5 px-3 rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                          No Phone
                        </button>
                      )}

                      <button
                        onClick={() => navigate(`/employee/quotations/new?lead_id=${lead.id}`)}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
                      >
                        <FileText size={13} /> Quote
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 2. TABLE VIEW */
            <div className="bg-card border border-border/70 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">Lead / Date</th>
                      <th className="py-3 px-4">Contact Person</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Source Channel</th>
                      <th className="py-3 px-4">Campaign / Attribution</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {filteredLeads.map((lead: any) => {
                      const cleanPhone = (lead.contact_phone || '').replace(/[^0-9]/g, '');
                      const waUrl = cleanPhone 
                        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${lead.contact_name || ''}, thank you for contacting OSBIC regarding your Company Registration in Oman. How can we assist you today?`)}`
                        : null;

                      const rawSrc = (lead.utm_source || lead.lead_sources?.name || '').toLowerCase();
                      const isWebsite = rawSrc.includes('setup.osbic') || rawSrc.includes('website') || Boolean(lead.landing_page_url);
                      const isGoogle = rawSrc.includes('google') || Boolean(lead.gclid);
                      const isMeta = rawSrc.includes('meta') || rawSrc.includes('facebook') || rawSrc.includes('instagram') || Boolean(lead.fbclid || lead.leadgen_id);

                      return (
                        <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                          {/* Lead / Date */}
                          <td className="py-3 px-4">
                            <div className="font-mono text-[11px] font-bold text-primary">{lead.lead_code || 'INBOUND'}</div>
                            <div className="text-[10px] text-muted-foreground">{format(new Date(lead.created_at), 'MMM dd, HH:mm')}</div>
                          </td>

                          {/* Contact Person */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-foreground">{lead.contact_name}</div>
                            {lead.company_name && (
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Building2 size={10} className="text-primary" />
                                <span className="truncate max-w-[150px]">{lead.company_name}</span>
                              </div>
                            )}
                          </td>

                          {/* Contact Info */}
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <div className="text-foreground">{lead.contact_phone || '—'}</div>
                            <div className="text-[10px] text-muted-foreground font-sans truncate max-w-[150px]">{lead.contact_email || ''}</div>
                          </td>

                          {/* Source Channel */}
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isGoogle ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              isMeta ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                              isWebsite ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              'bg-primary/10 text-primary border-primary/20'
                            }`}>
                              {lead.utm_source || lead.lead_sources?.name || 'Website'}
                            </span>
                            {lead.referral_name && (
                              <div className="text-[9px] text-purple-400 font-bold mt-1">Ref: {lead.referral_name}</div>
                            )}
                          </td>

                          {/* Campaign / Attribution */}
                          <td className="py-3 px-4">
                            {lead.utm_campaign ? (
                              <div className="text-foreground font-semibold text-[11px]">🎯 {lead.utm_campaign}</div>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Direct Form</span>
                            )}
                            {(lead.gclid || lead.fbclid) && (
                              <span className="inline-block mt-0.5 text-[9px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {lead.gclid ? 'Google Click ID' : 'Meta Click ID'}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              lead.status === 'new' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                              lead.status === 'converted' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {lead.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {waUrl && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-sm"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageCircle size={13} />
                                </a>
                              )}
                              <button
                                onClick={() => navigate(`/employee/quotations/new?lead_id=${lead.id}`)}
                                className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1"
                                title="Create Quotation"
                              >
                                <FileText size={11} /> Quote
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: SALES RESPONSE SLA */}
      {activeTab === 'sales_sla' && (
        <div className="space-y-6">
          <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" /> Speed-to-Lead Response Policy
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Leads contacted within <strong>5–10 minutes</strong> of submitting on <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">setup.osbic.net</code> have a 391% higher close rate than leads contacted after 1 hour.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/40">
              <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Average First Contact Time</span>
                <span className="text-2xl font-bold font-syne text-foreground">8.2 mins</span>
                <p className="text-[10px] text-emerald-500 font-bold mt-1">Within SLA Target (&lt; 15 mins)</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">New Uncontacted Leads</span>
                <span className="text-2xl font-bold font-syne text-amber-500">
                  {filteredLeads.filter(l => l.status === 'new').length}
                </span>
                <p className="text-[10px] text-muted-foreground mt-1">Awaiting first call/message</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Consultant Assignment</span>
                <span className="text-2xl font-bold font-syne text-foreground">Round-Robin</span>
                <p className="text-[10px] text-muted-foreground mt-1">Active distribution enabled</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
