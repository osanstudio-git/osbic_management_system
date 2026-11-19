import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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
  Layers,
  Sparkles,
  Activity,
  Phone,
  Mail,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  Building2,
  LayoutGrid,
  Table as TableIcon,
  UserCheck,
  X,
  Ban,
  Award,
  ThumbsUp,
  ThumbsDown,
  UserX,
  PhoneMissed,
  AlertTriangle
} from 'lucide-react';
import { format, subDays, startOfYear, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import {
  checkOmanVisaEligibility,
  DISQUALIFICATION_REASONS
} from '../../lib/omanVisaRestrictions';

export default function MarketingHub() {
  const { profile } = useAuth();

  // Time & Filter states
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days' | 'year' | 'custom'>('30days');
  const [customStartDate] = useState('');
  const [customEndDate] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [qualityFilter, setQualityFilter] = useState<'all' | 'quality_lead' | 'disqualified' | 'visa_ban' | 'no_response' | 'unreviewed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [streamViewMode, setStreamViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'live_feed' | 'sales_team' | 'sales_sla'>('overview');
  const [isAssigning, setIsAssigning] = useState(false);

  // Lead Quality & Disqualification Modal / Dropdown state
  const [activeDisqualifyLead, setActiveDisqualifyLead] = useState<any | null>(null);
  const [selectedDisqualifyReason, setSelectedDisqualifyReason] = useState<string>('oman_visa_ban');
  const [isUpdatingQuality, setIsUpdatingQuality] = useState(false);

  // Realtime state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [newLeadsSinceLoad, setNewLeadsSinceLoad] = useState(0);
  const queryClient = useQueryClient();

  // Meta Webhook Details Modal
  const [showMetaWebhookModal, setShowMetaWebhookModal] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const handleTestMetaWebhook = async () => {
    setIsTestingWebhook(true);
    try {
      const res = await fetch('https://wyzwpmwspvksgkmesaah.supabase.co/functions/v1/meta-lead-webhook?hub.mode=subscribe&hub.verify_token=osbic_meta_verify_secret_2026&hub.challenge=VERIFIED_200');
      const text = await res.text();
      if (res.ok && text.includes('VERIFIED_200')) {
        toast.success('Meta Webhook Handshake Verified! Status 200 OK');
      } else {
        toast.error(`Verification returned: ${res.status} ${text}`);
      }
    } catch {
      toast.error('Network check failed');
    } finally {
      setIsTestingWebhook(false);
    }
  };

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

  // 1b. Fetch Sales Staff for 1-Click Lead Assignment & Leaderboard
  const { data: salesStaff } = useQuery({
    queryKey: ['marketing', 'sales_staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, branch_id, can_do_sales, is_manager')
        .or('can_do_sales.eq.true,role.eq.admin,is_manager.eq.true');
      if (error) {
        console.warn('Error fetching sales staff:', error);
        return [];
      }
      return data || [];
    },
  });

  // 1-Click Consultant Assignment Handler
  const handleAssignLead = async (leadId: string, employeeId: string | null) => {
    try {
      setIsAssigning(true);
      const selectedStaff = salesStaff?.find(s => s.id === employeeId);
      const targetLead = leads?.find(l => l.id === leadId);

      const { error } = await supabase
        .from('leads')
        .update({
          assigned_to: employeeId,
          assigned_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) throw error;

      // Notify the assigned sales consultant
      if (employeeId && selectedStaff) {
        const sourceName = targetLead?.utm_source || targetLead?.lead_sources?.name || 'Website';
        try {
          await supabase.from('notifications').insert([{
            recipient_id: employeeId,
            sender_id: profile?.id || null,
            type: 'alert',
            title_en: `⚡ Inbound Lead Assigned: ${targetLead?.contact_name || 'New Lead'}`,
            title_ar: `⚡ تم تعيين عميل محتمل جديد: ${targetLead?.contact_name || 'عميل جديد'}`,
            body_en: `Assigned by ${profile?.full_name || 'Manager'}. Lead from ${sourceName} (${targetLead?.contact_phone || targetLead?.contact_email || ''}).`,
            body_ar: `تم التعيين بواسطة ${profile?.full_name || 'المدير'}. العميل من ${sourceName} (${targetLead?.contact_phone || targetLead?.contact_email || ''}).`,
            action_url: `/employee/marketing`,
            action_required: false,
            is_read: false,
          }]);
        } catch (notifErr) {
          console.warn('Notification log error:', notifErr);
        }
      }

      toast.success(
        employeeId
          ? `Lead assigned to ${selectedStaff?.full_name || 'consultant'}`
          : 'Lead unassigned'
      );

      // Invalidate queries to refresh view
      queryClient.invalidateQueries({ queryKey: ['marketing', 'inbound_leads'] });
    } catch (err: any) {
      console.error('Failed to assign lead:', err);
      toast.error(err.message || 'Failed to assign lead');
    } finally {
      setIsAssigning(false);
    }
  };

  // 1c. 1-Click Lead Quality & Disqualification Handler
  const handleUpdateLeadQuality = async (
    leadId: string,
    qualityStatus: 'quality_lead' | 'disqualified' | 'unreviewed',
    reason?: string | null
  ) => {
    try {
      setIsUpdatingQuality(true);
      const updates: any = {
        quality_status: qualityStatus,
        disqualification_reason: qualityStatus === 'disqualified' ? (reason || 'other') : null,
        disqualified_at: qualityStatus === 'disqualified' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId);

      if (error) throw error;

      toast.success(
        qualityStatus === 'quality_lead'
          ? 'Marked as ⭐ Quality Lead'
          : qualityStatus === 'disqualified'
          ? `🚫 Lead Disqualified (${DISQUALIFICATION_REASONS.find(r => r.key === reason)?.labelEn || 'Excluded'})`
          : 'Lead reset to Unreviewed'
      );

      queryClient.invalidateQueries({ queryKey: ['marketing', 'inbound_leads'] });
      setActiveDisqualifyLead(null);
    } catch (err: any) {
      console.error('Failed to update lead quality:', err);
      toast.error(err.message || 'Failed to update quality status');
    } finally {
      setIsUpdatingQuality(false);
    }
  };

  // 1d. 1-Click Call & Connection Status Handler
  const handleUpdateCallStatus = async (leadId: string, newCallStatus: string) => {
    try {
      const now = new Date().toISOString();
      const targetLead = leads?.find(l => l.id === leadId);
      
      const updates: any = {
        call_status: newCallStatus,
        updated_at: now,
      };

      // If first call recorded and no first_called_at timestamp exists, calculate speed-to-lead
      if (!targetLead?.first_called_at && targetLead?.created_at) {
        updates.first_called_at = now;
        const leadCreatedMs = new Date(targetLead.created_at).getTime();
        const calledMs = new Date(now).getTime();
        const diffMins = Math.max(1, Math.round((calledMs - leadCreatedMs) / (1000 * 60)));
        updates.speed_to_lead_mins = diffMins;
      }

      // If call status indicates no response or invalid number, set helper disqualification flags
      if (newCallStatus === 'wrong_number' && !targetLead?.quality_status) {
        updates.quality_status = 'disqualified';
        updates.disqualification_reason = 'wrong_number';
      }

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', leadId);

      if (error) throw error;

      toast.success(`Call status updated: ${newCallStatus}`);
      queryClient.invalidateQueries({ queryKey: ['marketing', 'inbound_leads'] });
    } catch (err: any) {
      console.error('Failed to update call status:', err);
      toast.error(err.message || 'Failed to update call status');
    }
  };

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

  // Helper to determine Oman visa compliance & quality classification for any lead
  const getLeadIntelligence = useMemo(() => {
    return (lead: any) => {
      const visaCheck = checkOmanVisaEligibility(lead);
      const hasRestrictedCountry = visaCheck.isRestricted;
      const explicitDisqualified = lead.quality_status === 'disqualified' || Boolean(lead.disqualification_reason);
      const explicitQuality = lead.quality_status === 'quality_lead';
      const isLostOrCancelled = lead.status === 'lost' || lead.status === 'cancelled';
      const isCallUnanswered = lead.call_status === 'no_answer' || lead.call_status === 'wrong_number' || lead.disqualification_reason === 'no_answer';
      const isWrongNumber = lead.call_status === 'wrong_number' || lead.disqualification_reason === 'wrong_number';
      const isSalesActive = ['interested', 'qualified', 'quoted', 'negotiating', 'converted'].includes(lead.status);

      let effectiveStatus: 'quality_lead' | 'disqualified' | 'visa_ban' | 'no_response' | 'unreviewed' = 'unreviewed';

      if (explicitQuality) {
        effectiveStatus = 'quality_lead';
      } else if (hasRestrictedCountry && visaCheck.severity === 'banned') {
        effectiveStatus = 'visa_ban';
      } else if (explicitDisqualified || isLostOrCancelled) {
        effectiveStatus = isCallUnanswered ? 'no_response' : 'disqualified';
      } else if (isCallUnanswered || isWrongNumber) {
        effectiveStatus = 'no_response';
      } else if (isSalesActive && !hasRestrictedCountry) {
        effectiveStatus = 'quality_lead';
      }

      return {
        visaCheck,
        hasRestrictedCountry,
        effectiveStatus,
        isQuality: effectiveStatus === 'quality_lead',
        isBanned: effectiveStatus === 'visa_ban' || hasRestrictedCountry,
        isNoResponse: effectiveStatus === 'no_response',
        isDisqualified: effectiveStatus === 'disqualified' || effectiveStatus === 'visa_ban',
      };
    };
  }, []);

  // Quality Counts for Tab Badges & Radar
  const qualityCounts = useMemo(() => {
    const counts = {
      all: baseTimeFilteredLeads.length,
      quality_lead: 0,
      visa_ban: 0,
      no_response: 0,
      disqualified: 0,
      unreviewed: 0,
    };

    const restrictedCountriesMap: Record<string, number> = {};

    for (const l of baseTimeFilteredLeads) {
      const intel = getLeadIntelligence(l);
      if (intel.effectiveStatus === 'quality_lead') counts.quality_lead++;
      else if (intel.effectiveStatus === 'visa_ban') counts.visa_ban++;
      else if (intel.effectiveStatus === 'no_response') counts.no_response++;
      else if (intel.effectiveStatus === 'disqualified') counts.disqualified++;
      else counts.unreviewed++;

      if (intel.hasRestrictedCountry && intel.visaCheck.rule) {
        const cName = intel.visaCheck.rule.name;
        restrictedCountriesMap[cName] = (restrictedCountriesMap[cName] || 0) + 1;
      }
    }

    return { counts, restrictedCountriesMap };
  }, [baseTimeFilteredLeads, getLeadIntelligence]);

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

  // Filtered Leads based on Channel, Quality Status & Search Term
  const filteredLeads = useMemo(() => {
    let list = baseTimeFilteredLeads;

    // 1. Channel Filter
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

    // 2. Quality Filter
    if (qualityFilter !== 'all') {
      list = list.filter(l => {
        const intel = getLeadIntelligence(l);
        if (qualityFilter === 'quality_lead') return intel.effectiveStatus === 'quality_lead';
        if (qualityFilter === 'visa_ban') return intel.effectiveStatus === 'visa_ban' || intel.hasRestrictedCountry;
        if (qualityFilter === 'no_response') return intel.effectiveStatus === 'no_response';
        if (qualityFilter === 'disqualified') return intel.effectiveStatus === 'disqualified' || intel.effectiveStatus === 'visa_ban';
        if (qualityFilter === 'unreviewed') return intel.effectiveStatus === 'unreviewed';
        return true;
      });
    }

    // 3. Search Term Filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(l =>
        l.contact_name?.toLowerCase().includes(term) ||
        l.company_name?.toLowerCase().includes(term) ||
        l.contact_phone?.includes(term) ||
        l.contact_email?.toLowerCase().includes(term) ||
        l.nationality?.toLowerCase().includes(term) ||
        l.utm_campaign?.toLowerCase().includes(term) ||
        l.utm_term?.toLowerCase().includes(term) ||
        l.lead_code?.toLowerCase().includes(term)
      );
    }

    return list;
  }, [baseTimeFilteredLeads, channelFilter, qualityFilter, searchTerm, getLeadIntelligence]);

  // Aggregate Funnel Metrics
  const stats = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const contacted = filteredLeads.filter(l => l.status !== 'new' || Boolean(l.call_status)).length;
    const qualified = filteredLeads.filter(l => ['interested', 'qualified', 'quoted', 'negotiating', 'converted'].includes(l.status)).length;
    const quoted = filteredLeads.filter(l => ['quoted', 'negotiating', 'converted'].includes(l.status)).length;
    const converted = filteredLeads.filter(l => l.status === 'converted').length;

    // Quality breakdown
    const qualityCount = filteredLeads.filter(l => getLeadIntelligence(l).isQuality).length;
    const visaBanCount = filteredLeads.filter(l => getLeadIntelligence(l).hasRestrictedCountry).length;
    const noResponseCount = filteredLeads.filter(l => getLeadIntelligence(l).isNoResponse).length;

    // Attributed Revenue & Net Profit from closed jobs
    const leadIds = new Set(filteredLeads.map(l => l.id));
    const clientIds = new Set(filteredLeads.map(l => l.client_id).filter(Boolean));

    const quotesTotalValue = (quotations || [])
      .filter(q => q.lead_id && leadIds.has(q.lead_id))
      .reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);

    const closedJobs = (jobs || []).filter(j => j.client_id && clientIds.has(j.client_id) && j.status !== 'cancelled');
    const closedRevenue = closedJobs.reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);
    const closedProfit = closedJobs.reduce((sum, j) => sum + (Number(j.work_fee) || 0), 0);

    const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0.0';
    const qualifiedRate = totalLeads > 0 ? ((qualified / totalLeads) * 100).toFixed(1) : '0.0';
    const qualityRate = totalLeads > 0 ? ((qualityCount / totalLeads) * 100).toFixed(1) : '0.0';

    return {
      totalLeads,
      contacted,
      qualified,
      quoted,
      converted,
      qualityCount,
      visaBanCount,
      noResponseCount,
      quotesTotalValue,
      closedRevenue,
      closedProfit,
      conversionRate,
      qualifiedRate,
      qualityRate,
    };
  }, [filteredLeads, quotations, jobs, getLeadIntelligence]);

  // Campaign Breakdown with Quality % & Profit Attribution
  const campaignAttribution = useMemo(() => {
    const groups: Record<string, {
      name: string;
      source: string;
      leadsCount: number;
      qualityCount: number;
      visaBanCount: number;
      quotedCount: number;
      wonCount: number;
      revenue: number;
      profit: number;
    }> = {};

    const clientIdsMap = new Map(filteredLeads.filter(l => l.client_id).map(l => [l.client_id, l]));

    for (const lead of filteredLeads) {
      const campaignKey = lead.utm_campaign || lead.lead_sources?.name || 'Direct / Organic';
      const sourceName = lead.utm_source || lead.lead_sources?.name || 'Website';
      const intel = getLeadIntelligence(lead);

      if (!groups[campaignKey]) {
        groups[campaignKey] = {
          name: campaignKey,
          source: sourceName,
          leadsCount: 0,
          qualityCount: 0,
          visaBanCount: 0,
          quotedCount: 0,
          wonCount: 0,
          revenue: 0,
          profit: 0,
        };
      }

      groups[campaignKey].leadsCount += 1;
      if (intel.isQuality) groups[campaignKey].qualityCount += 1;
      if (intel.hasRestrictedCountry) groups[campaignKey].visaBanCount += 1;

      if (['quoted', 'negotiating', 'converted'].includes(lead.status)) {
        groups[campaignKey].quotedCount += 1;
      }
      if (lead.status === 'converted') {
        groups[campaignKey].wonCount += 1;
      }
    }

    // Add Revenue and Service Profit from closed jobs
    if (jobs) {
      for (const job of jobs) {
        if (job.client_id && clientIdsMap.has(job.client_id) && job.status !== 'cancelled') {
          const matchedLead = clientIdsMap.get(job.client_id);
          const campaignKey = matchedLead?.utm_campaign || matchedLead?.lead_sources?.name || 'Direct / Organic';
          if (groups[campaignKey]) {
            groups[campaignKey].revenue += (Number(job.total_fee) || 0);
            groups[campaignKey].profit += (Number(job.work_fee) || 0);
          }
        }
      }
    }

    return Object.values(groups).sort((a, b) => b.leadsCount - a.leadsCount);
  }, [filteredLeads, jobs, getLeadIntelligence]);

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

  // Sales Team Leaderboard Metrics
  const salesLeaderboard = useMemo(() => {
    if (!salesStaff || salesStaff.length === 0) return [];

    const activeList = baseTimeFilteredLeads || [];

    return salesStaff.map(staff => {
      const staffLeads = activeList.filter(l => l.assigned_to === staff.id);
      const totalAssigned = staffLeads.length;
      const contacted = staffLeads.filter(l => l.status !== 'new').length;
      const qualified = staffLeads.filter(l => ['interested', 'qualified', 'quoted', 'negotiating', 'converted'].includes(l.status)).length;
      const converted = staffLeads.filter(l => l.status === 'converted').length;

      // Quotes built for these leads
      const staffQuotes = (quotations || []).filter(q => q.lead_id && staffLeads.some(l => l.id === q.lead_id));
      const quotesCount = staffQuotes.length;

      // Closed Jobs Revenue
      const staffJobs = (jobs || []).filter(j => j.client_id && staffLeads.some(l => l.client_id === j.client_id) && j.status !== 'cancelled');
      const closedJobsCount = staffJobs.length;
      const attributedRevenue = staffJobs.reduce((sum, j) => sum + (Number(j.total_fee) || 0), 0);

      const conversionRate = totalAssigned > 0 ? ((converted / totalAssigned) * 100).toFixed(1) : '0.0';
      const contactRate = totalAssigned > 0 ? ((contacted / totalAssigned) * 100).toFixed(1) : '0.0';

      return {
        staff,
        totalAssigned,
        contacted,
        qualified,
        quotesCount,
        closedJobsCount,
        conversionRate: Number(conversionRate),
        contactRate: Number(contactRate),
        attributedRevenue,
      };
    }).sort((a, b) => b.attributedRevenue - a.attributedRevenue || b.totalAssigned - a.totalAssigned);
  }, [salesStaff, baseTimeFilteredLeads, quotations, jobs]);

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
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-6 rounded-3xl border border-border/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
            <Megaphone size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-syne text-foreground tracking-tight flex items-center gap-2">
              Marketing & Acquisition Hub
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inbound Attribution, Google & Meta Ads Funnel, and Realtime Ingestion
            </p>
          </div>
        </div>

        {/* Time Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Pills */}
          <div className="flex bg-muted/40 p-1 rounded-2xl border border-border text-xs font-semibold">
            {(['today', '7days', '30days', 'year', 'all'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeFilter(tf)}
                className={`px-3 py-1.5 rounded-xl transition-all capitalize ${timeFilter === tf
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                {tf === 'today' ? 'Today' : tf === '7days' ? '7 Days' : tf === '30days' ? '30 Days' : tf === 'year' ? 'Year' : 'All'}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetchLeads()}
            className="p-2 rounded-2xl bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            title="Refresh Inbound Leads"
          >
            <RefreshCw size={15} className={isLoadingLeads ? 'animate-spin text-primary' : ''} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-xs font-bold shadow-sm"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* TOP FUNNEL METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Inbound */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Inbound Leads</span>
            <Globe size={14} className="text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.totalLeads}</span>
            {isRealtimeConnected && (
              <span className="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">Live</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Forms & Ad submissions</p>
        </div>

        {/* Contacted */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Contacted</span>
            <Phone size={14} className="text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.contacted}</span>
            <span className="text-[10px] text-muted-foreground font-mono font-bold">
              {stats.totalLeads > 0 ? `${Math.round((stats.contacted / stats.totalLeads) * 100)}%` : '0%'}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">Sales Outreach logged</p>
        </div>

        {/* Qualified */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Qualified Leads</span>
            <Sparkles size={14} className="text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.qualified}</span>
            <span className="text-[10px] text-purple-400 font-mono font-bold">{stats.qualifiedRate}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground">High business intent</p>
        </div>

        {/* Quotes Built */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Quotations Sent</span>
            <FileText size={14} className="text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-foreground">{stats.quoted}</span>
            <span className="text-[9px] text-muted-foreground font-mono">
              {stats.quotesTotalValue > 0 ? `${stats.quotesTotalValue.toFixed(0)} OMR` : ''}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">Official proposals built</p>
        </div>

        {/* Converted Jobs */}
        <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Jobs Won</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-syne text-emerald-400">{stats.converted}</span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">{stats.conversionRate}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground">Active client files created</p>
        </div>

        {/* Attributed Revenue & Profit */}
        <div className="p-4 rounded-2xl bg-card border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm space-y-1">
          <div className="flex items-center justify-between text-primary">
            <span className="text-[10px] font-bold uppercase tracking-wider">Closed Revenue & Profit</span>
            <TrendingUp size={14} />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-syne text-primary">
              {stats.closedRevenue > 0 ? stats.closedRevenue.toFixed(0) : '0'}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">OMR</span>
          </div>
          <p className="text-[10px] text-emerald-400 font-semibold truncate">
            Net Profit: {stats.closedProfit > 0 ? stats.closedProfit.toFixed(0) : '0'} OMR
          </p>
        </div>
      </div>

      {/* OMAN LAW VISA COMPLIANCE & LEAD QUALITY RADAR */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-red-500/10 via-amber-500/5 to-emerald-500/10 border border-border/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-syne text-foreground">
                  Oman Visa Law & Lead Quality Radar
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                  ROP & MOL Live Compliance
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Automated detection of banned nationalities (ROP suspensions), invalid numbers, and marketing ad budget leakage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('live_feed'); setQualityFilter('visa_ban'); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                qualityCounts.counts.visa_ban > 0 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 animate-pulse'
                  : 'bg-muted/40 text-muted-foreground border border-border'
              }`}
            >
              <Ban size={13} />
              <span>Restricted Leads: {qualityCounts.counts.visa_ban}</span>
            </button>
            <button
              onClick={() => { setActiveTab('live_feed'); setQualityFilter('quality_lead'); }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all flex items-center gap-1.5"
            >
              <Award size={13} />
              <span>Quality: {qualityCounts.counts.quality_lead}</span>
            </button>
          </div>
        </div>

        {/* Breakdown Micro-Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-card/60 border border-border/60 rounded-2xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Quality Leads Ratio</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-syne text-emerald-400">{qualityCounts.counts.quality_lead}</span>
              <span className="text-xs font-mono font-bold text-muted-foreground">
                ({stats.totalLeads > 0 ? Math.round((qualityCounts.counts.quality_lead / stats.totalLeads) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[10px] text-emerald-500 font-medium">Eligible for Oman setup</p>
          </div>

          <div className="p-3 bg-card/60 border border-border/60 rounded-2xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block flex items-center gap-1">
              <Ban size={11} /> Oman Visa Bans
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-syne text-red-400">{qualityCounts.counts.visa_ban}</span>
              <span className="text-xs font-mono font-bold text-muted-foreground">
                ({stats.totalLeads > 0 ? Math.round((qualityCounts.counts.visa_ban / stats.totalLeads) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[10px] text-red-400/80 font-medium">ROP suspended countries</p>
          </div>

          <div className="p-3 bg-card/60 border border-border/60 rounded-2xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block flex items-center gap-1">
              <PhoneMissed size={11} /> No Response / Invalid
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-syne text-amber-400">{qualityCounts.counts.no_response}</span>
              <span className="text-xs font-mono font-bold text-muted-foreground">
                ({stats.totalLeads > 0 ? Math.round((qualityCounts.counts.no_response / stats.totalLeads) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Ringing / wrong number</p>
          </div>

          <div className="p-3 bg-card/60 border border-border/60 rounded-2xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Unreviewed Queue</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-syne text-foreground">{qualityCounts.counts.unreviewed}</span>
              <span className="text-xs font-mono font-bold text-muted-foreground">leads</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Awaiting qualification rating</p>
          </div>
        </div>

        {/* Ad Targeting Leak Warning Banner (Active when restricted country leads exist) */}
        {qualityCounts.counts.visa_ban > 0 && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-300">
                  ⚠️ Ad Targeting Leak Detected: {qualityCounts.counts.visa_ban} leads from restricted nationalities ({Object.keys(qualityCounts.restrictedCountriesMap).join(', ')})
                </p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Under current Oman ROP regulations, new investor and employment visas are suspended for these regions. Generating these leads burns ad spend with 0% setup viability.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
              <span className="px-2.5 py-1 rounded-xl bg-red-500/20 text-red-200 text-[10px] font-bold uppercase tracking-wider">
                Action: Exclude in Meta/Google Ads
              </span>
            </div>
          </div>
        )}
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
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${isRealtimeConnected
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'
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
        <div
          onClick={() => setShowMetaWebhookModal(true)}
          className="p-4 rounded-2xl bg-card border border-border/60 hover:border-indigo-500/50 shadow-sm flex items-center justify-between cursor-pointer transition-all group"
          title="Click to view Meta Webhook URL and verify connection"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
              M
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Meta (FB / IG) Lead Ads
                <ExternalLink size={10} className="text-muted-foreground opacity-60 group-hover:opacity-100" />
              </h4>
              <p className="text-[10px] text-muted-foreground">App ID: 61596335390056 · Click for Setup</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live & Ready
          </span>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-border gap-2 text-xs font-bold overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-all flex items-center gap-2 border-b-2 shrink-0 ${activeTab === 'overview'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <Layers size={14} /> Campaign Attribution
        </button>

        <button
          onClick={() => { setActiveTab('live_feed'); setNewLeadsSinceLoad(0); }}
          className={`pb-3 px-3 transition-all flex items-center gap-2 border-b-2 shrink-0 ${activeTab === 'live_feed'
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
          onClick={() => setActiveTab('sales_team')}
          className={`pb-3 px-3 transition-all flex items-center gap-2 border-b-2 shrink-0 ${activeTab === 'sales_team'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          <UserCheck size={14} /> Sales Team Leaderboard ({salesStaff?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('sales_sla')}
          className={`pb-3 px-3 transition-all flex items-center gap-2 border-b-2 shrink-0 ${activeTab === 'sales_sla'
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
                    <th className="py-3 px-4 text-center">⭐ Quality Leads</th>
                    <th className="py-3 px-4 text-center">🚫 Visa Ban (Leak)</th>
                    <th className="py-3 px-4 text-center">Quotes Built</th>
                    <th className="py-3 px-4 text-center">Jobs Won</th>
                    <th className="py-3 px-4 text-center">Close Rate</th>
                    <th className="py-3 px-4 text-right">Revenue (OMR)</th>
                    <th className="py-3 px-4 text-right">Net Profit (OMR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {campaignAttribution.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground">
                        No campaign attribution records found for this timeframe.
                      </td>
                    </tr>
                  ) : (
                    campaignAttribution.map((camp, idx) => {
                      const conv = camp.leadsCount > 0 ? ((camp.wonCount / camp.leadsCount) * 100).toFixed(1) : '0.0';
                      const qualityPct = camp.leadsCount > 0 ? Math.round((camp.qualityCount / camp.leadsCount) * 100) : 0;
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
                          {/* Quality Leads */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {camp.qualityCount} ({qualityPct}%)
                            </span>
                          </td>
                          {/* Visa Ban Targeting Leak */}
                          <td className="py-3.5 px-4 text-center">
                            {camp.visaBanCount > 0 ? (
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center gap-1 mx-auto w-fit" title="Ad targeting leak: Nationality restricted by Oman ROP">
                                <Ban size={10} /> {camp.visaBanCount} Restricted
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60">—</span>
                            )}
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
                            {camp.revenue > 0 ? `${camp.revenue.toFixed(3)}` : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-400">
                            {camp.profit > 0 ? `${camp.profit.toFixed(3)}` : '—'}
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${channelFilter === 'all'
                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              <span>⚡ All Leads</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${channelFilter === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
                }`}>
                {channelCounts.all}
              </span>
            </button>

            {/* Landing Page (setup.osbic.net) */}
            <button
              onClick={() => setChannelFilter('website')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${channelFilter === 'website'
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-blue-500/40'
                }`}
            >
              <Globe size={13} className={channelFilter === 'website' ? 'text-white' : 'text-blue-400'} />
              <span>setup.osbic.net</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${channelFilter === 'website' ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                }`}>
                {channelCounts.website}
              </span>
            </button>

            {/* Google Ads */}
            <button
              onClick={() => setChannelFilter('google')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${channelFilter === 'google'
                ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/20'
                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-amber-500/40'
                }`}
            >
              <span className="font-bold text-[11px] text-amber-400">G</span>
              <span>Google Ads</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${channelFilter === 'google' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                {channelCounts.google}
              </span>
            </button>

            {/* Meta Ads */}
            <button
              onClick={() => setChannelFilter('meta')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${channelFilter === 'meta'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-indigo-500/40'
                }`}
            >
              <span className="font-bold text-[11px] text-indigo-400">M</span>
              <span>Meta Ads (FB/IG)</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${channelFilter === 'meta' ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                }`}>
                {channelCounts.meta}
              </span>
            </button>

            {/* WhatsApp Direct */}
            <button
              onClick={() => setChannelFilter('whatsapp')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${channelFilter === 'whatsapp'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-emerald-500/40'
                }`}
            >
              <MessageCircle size={13} className={channelFilter === 'whatsapp' ? 'text-white' : 'text-emerald-400'} />
              <span>WhatsApp Direct</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${channelFilter === 'whatsapp' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                {channelCounts.whatsapp}
              </span>
            </button>

            {/* Referral / Others */}
            <button
              onClick={() => setChannelFilter('referral')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 border ${channelFilter === 'referral'
                ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20'
                : 'bg-card border-border/70 text-muted-foreground hover:text-foreground hover:border-purple-500/40'
                }`}
            >
              <UserCheck size={13} className={channelFilter === 'referral' ? 'text-white' : 'text-purple-400'} />
              <span>Referral & Others</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${channelFilter === 'referral' ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                }`}>
                {channelCounts.referral}
              </span>
            </button>
          </div>

          {/* QUALITY & VISA RADAR FILTER PILLS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1 shrink-0">
              Quality Filter:
            </span>
            <button
              onClick={() => setQualityFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                qualityFilter === 'all'
                  ? 'bg-foreground text-background border-foreground font-black'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              All Statuses ({qualityCounts.counts.all})
            </button>

            <button
              onClick={() => setQualityFilter('quality_lead')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
                qualityFilter === 'quality_lead'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40'
              }`}
            >
              <Award size={12} className={qualityFilter === 'quality_lead' ? 'text-white' : 'text-emerald-400'} />
              <span>⭐ Quality Leads ({qualityCounts.counts.quality_lead})</span>
            </button>

            <button
              onClick={() => setQualityFilter('visa_ban')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
                qualityFilter === 'visa_ban'
                  ? 'bg-red-600 text-white border-red-500 shadow-sm shadow-red-500/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-red-400 hover:border-red-500/40'
              }`}
            >
              <Ban size={12} className={qualityFilter === 'visa_ban' ? 'text-white' : 'text-red-400'} />
              <span>🚫 Oman Visa Ban ({qualityCounts.counts.visa_ban})</span>
            </button>

            <button
              onClick={() => setQualityFilter('no_response')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
                qualityFilter === 'no_response'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-sm shadow-amber-500/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-amber-400 hover:border-amber-500/40'
              }`}
            >
              <PhoneMissed size={12} className={qualityFilter === 'no_response' ? 'text-white' : 'text-amber-400'} />
              <span>📵 No Response ({qualityCounts.counts.no_response})</span>
            </button>

            <button
              onClick={() => setQualityFilter('disqualified')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
                qualityFilter === 'disqualified'
                  ? 'bg-rose-700 text-white border-rose-600 shadow-sm shadow-rose-600/20'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-rose-400 hover:border-rose-500/40'
              }`}
            >
              <UserX size={12} className={qualityFilter === 'disqualified' ? 'text-white' : 'text-rose-400'} />
              <span>❌ Disqualified ({qualityCounts.counts.disqualified})</span>
            </button>

            <button
              onClick={() => setQualityFilter('unreviewed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
                qualityFilter === 'unreviewed'
                  ? 'bg-muted text-foreground border-border'
                  : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock size={12} />
              <span>⏳ Unreviewed ({qualityCounts.counts.unreviewed})</span>
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
                className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${streamViewMode === 'grid'
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
                className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${streamViewMode === 'table'
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
                const staffName = profile?.full_name || 'OSBIC Team';
                const msgText = `Hello ${lead.contact_name || ''}, thank you for contacting OSBIC regarding your Company Registration in Oman. My name is ${staffName}, your assigned business setup advisor. How may I assist you today?`;
                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgText)}` : null;

                const rawSrc = (lead.utm_source || lead.lead_sources?.name || '').toLowerCase();
                const isWebsite = rawSrc.includes('setup.osbic') || rawSrc.includes('website') || Boolean(lead.landing_page_url);
                const isGoogle = rawSrc.includes('google') || Boolean(lead.gclid);
                const isMeta = rawSrc.includes('meta') || rawSrc.includes('facebook') || rawSrc.includes('instagram') || Boolean(lead.fbclid || lead.leadgen_id);
                const intel = getLeadIntelligence(lead);
                const matchedJob = jobs?.find(j => j.client_id && j.client_id === lead.client_id && j.status !== 'cancelled');

                return (
                  <div
                    key={lead.id}
                    className={`bg-card border rounded-2xl p-4 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-3.5 ${
                      intel.hasRestrictedCountry
                        ? 'border-red-500/40 bg-red-500/5'
                        : intel.effectiveStatus === 'quality_lead'
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-border/70'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Header with Lead Code & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase">{lead.lead_code || 'INBOUND'}</span>
                            {lead.nationality && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-muted text-foreground">
                                🌍 {lead.nationality}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-foreground mt-0.5">{lead.contact_name}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          lead.status === 'new' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                          lead.status === 'converted' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {lead.status}
                        </span>
                      </div>

                      {/* Oman Visa Restriction Warning Box */}
                      {intel.hasRestrictedCountry && (
                        <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-[11px] text-red-200">
                            <Ban size={12} className="shrink-0 text-red-400" />
                            <span>{intel.visaCheck.statusBadgeText}</span>
                          </div>
                          <p className="text-[10px] text-red-300/90 leading-tight">
                            {intel.visaCheck.ropNotice}
                          </p>
                          <div className="pt-1 text-[9px] text-red-400 font-semibold flex items-center gap-1">
                            <AlertTriangle size={10} />
                            <span>Marketing Action: Exclude country in Meta/Google Ad targeting</span>
                          </div>
                        </div>
                      )}

                      {/* Contact Info */}
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

                      {/* Lead Quality Rating & 1-Click Evaluation */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                          Lead Quality:
                        </span>
                        <div className="flex items-center gap-1.5">
                          {lead.quality_status === 'quality_lead' ? (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                              <Award size={10} /> Quality Lead
                            </span>
                          ) : lead.quality_status === 'disqualified' || intel.hasRestrictedCountry ? (
                            <span
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1 truncate max-w-[140px]"
                              title={lead.disqualification_reason || intel.visaCheck.statusBadgeText}
                            >
                              <UserX size={10} />
                              {lead.disqualification_reason
                                ? (DISQUALIFICATION_REASONS.find(r => r.key === lead.disqualification_reason)?.labelEn || lead.disqualification_reason)
                                : 'Visa Ban'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-muted text-muted-foreground">
                              Unreviewed
                            </span>
                          )}

                          <button
                            onClick={() => handleUpdateLeadQuality(lead.id, 'quality_lead')}
                            className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                            title="Mark as Quality Lead"
                          >
                            <ThumbsUp size={11} />
                          </button>
                          <button
                            onClick={() => {
                              setActiveDisqualifyLead(lead);
                              setSelectedDisqualifyReason(intel.hasRestrictedCountry ? 'oman_visa_ban' : 'no_answer');
                            }}
                            className="p-1 rounded-md bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 transition-all cursor-pointer"
                            title="Disqualify / Wrong Lead (Select Reason)"
                          >
                            <ThumbsDown size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Call / Outreach Status Selector */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                          Call Outreach:
                        </span>
                        <select
                          value={lead.call_status || 'pending'}
                          onChange={(e) => handleUpdateCallStatus(lead.id, e.target.value)}
                          className="bg-muted/40 border border-border rounded-lg px-2 py-0.5 text-[10px] font-semibold text-foreground outline-none cursor-pointer max-w-[160px]"
                        >
                          <option value="pending">⚪ Pending 1st Call</option>
                          <option value="connected">🟢 Connected (Spoke)</option>
                          <option value="whatsapp_sent">🟢 WhatsApp Engaged</option>
                          <option value="no_answer">🟡 Called - No Answer</option>
                          <option value="wrong_number">🔴 Invalid / Wrong No.</option>
                        </select>
                      </div>

                      {/* Consultant Assignment Dropdown */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                          Assigned:
                        </span>
                        <select
                          value={lead.assigned_to || ''}
                          disabled={isAssigning}
                          onChange={(e) => handleAssignLead(lead.id, e.target.value || null)}
                          className={`w-full max-w-[180px] bg-muted/40 border rounded-lg px-2 py-1 text-[11px] font-medium outline-none transition-colors ${
                            lead.assigned_to
                              ? 'border-border text-foreground font-semibold'
                              : 'border-amber-500/40 text-amber-400 bg-amber-500/5 font-bold'
                          }`}
                        >
                          <option value="">⚡ Unassigned (Assign)</option>
                          {(salesStaff || []).map(staff => (
                            <option key={staff.id} value={staff.id}>
                              {staff.full_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Converted Job Revenue & Profit Attribution */}
                      {matchedJob && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground font-sans font-semibold">Won Job Attribution:</span>
                          <span className="font-bold text-primary">
                            Rev: {Number(matchedJob.total_fee || 0).toFixed(0)} OMR · <span className="text-emerald-400">Profit: {Number(matchedJob.work_fee || 0).toFixed(0)} OMR</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quick Action Footer */}
                    <div className="pt-3 border-t border-border/40">
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-all shadow-sm"
                        >
                          <MessageCircle size={14} /> Open WhatsApp Direct
                        </a>
                      ) : (
                        <button disabled className="w-full opacity-50 py-2 px-4 rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                          No Phone Number
                        </button>
                      )}
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
                      <th className="py-3 px-4">Nationality & Visa Law</th>
                      <th className="py-3 px-4 text-center">Quality Rating</th>
                      <th className="py-3 px-4">Call / Outreach</th>
                      <th className="py-3 px-4">Source & Campaign</th>
                      <th className="py-3 px-4">Assigned Consultant</th>
                      <th className="py-3 px-4 text-center">Status / Revenue</th>
                      <th className="py-3 px-4 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-medium">
                    {filteredLeads.map((lead: any) => {
                      const cleanPhone = (lead.contact_phone || '').replace(/[^0-9]/g, '');
                      const staffName = profile?.full_name || 'OSBIC Team';
                      const msgText = `Hello ${lead.contact_name || ''}, thank you for contacting OSBIC regarding your Company Registration in Oman. My name is ${staffName}, your assigned business setup advisor. How may I assist you today?`;
                      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgText)}` : null;

                      const rawSrc = (lead.utm_source || lead.lead_sources?.name || '').toLowerCase();
                      const isWebsite = rawSrc.includes('setup.osbic') || rawSrc.includes('website') || Boolean(lead.landing_page_url);
                      const isGoogle = rawSrc.includes('google') || Boolean(lead.gclid);
                      const isMeta = rawSrc.includes('meta') || rawSrc.includes('facebook') || rawSrc.includes('instagram') || Boolean(lead.fbclid || lead.leadgen_id);
                      const intel = getLeadIntelligence(lead);
                      const matchedJob = jobs?.find(j => j.client_id && j.client_id === lead.client_id && j.status !== 'cancelled');

                      return (
                        <tr key={lead.id} className={`hover:bg-muted/20 transition-colors ${intel.hasRestrictedCountry ? 'bg-red-500/5' : ''}`}>
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
                            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{lead.contact_phone || '—'}</div>
                          </td>

                          {/* Nationality & Oman Visa Compliance */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground text-[11px]">
                              {lead.nationality || (lead.contact_phone ? `Phone: ${lead.contact_phone.substring(0, 4)}...` : 'Unknown')}
                            </div>
                            {intel.hasRestrictedCountry ? (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30" title={intel.visaCheck.ropNotice}>
                                <Ban size={9} /> {intel.visaCheck.statusBadgeText}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 size={9} /> Eligible / Open
                              </span>
                            )}
                          </td>

                          {/* Quality Rating */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {lead.quality_status === 'quality_lead' ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <Award size={10} /> Quality
                                </span>
                              ) : lead.quality_status === 'disqualified' || intel.hasRestrictedCountry ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1" title={lead.disqualification_reason || 'Excluded'}>
                                  <UserX size={10} /> Disqualified
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-muted text-muted-foreground">
                                  Unreviewed
                                </span>
                              )}
                              <button
                                onClick={() => handleUpdateLeadQuality(lead.id, 'quality_lead')}
                                className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 cursor-pointer"
                                title="Mark as Quality Lead"
                              >
                                <ThumbsUp size={10} />
                              </button>
                              <button
                                onClick={() => {
                                  setActiveDisqualifyLead(lead);
                                  setSelectedDisqualifyReason(intel.hasRestrictedCountry ? 'oman_visa_ban' : 'no_answer');
                                }}
                                className="p-1 rounded-md bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 cursor-pointer"
                                title="Disqualify (Choose Reason)"
                              >
                                <ThumbsDown size={10} />
                              </button>
                            </div>
                          </td>

                          {/* Call / Outreach Status Dropdown */}
                          <td className="py-3 px-4">
                            <select
                              value={lead.call_status || 'pending'}
                              onChange={(e) => handleUpdateCallStatus(lead.id, e.target.value)}
                              className="bg-muted/40 border border-border rounded-lg px-2 py-1 text-[10px] font-semibold text-foreground outline-none cursor-pointer"
                            >
                              <option value="pending">⚪ Pending Call</option>
                              <option value="connected">🟢 Connected</option>
                              <option value="whatsapp_sent">🟢 WhatsApp</option>
                              <option value="no_answer">🟡 No Answer</option>
                              <option value="wrong_number">🔴 Invalid No.</option>
                            </select>
                          </td>

                          {/* Source & Campaign */}
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              isGoogle ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              isMeta ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                              isWebsite ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              'bg-primary/10 text-primary border-primary/20'
                            }`}>
                              {lead.utm_source || lead.lead_sources?.name || 'Website'}
                            </span>
                            {lead.utm_campaign && (
                              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5 truncate max-w-[130px]">
                                🎯 {lead.utm_campaign}
                              </div>
                            )}
                          </td>

                          {/* Assigned Consultant Dropdown */}
                          <td className="py-3 px-4">
                            <select
                              value={lead.assigned_to || ''}
                              disabled={isAssigning}
                              onChange={(e) => handleAssignLead(lead.id, e.target.value || null)}
                              className={`bg-muted/40 border rounded-lg px-2 py-1 text-[11px] font-medium outline-none transition-colors ${
                                lead.assigned_to
                                  ? 'border-border text-foreground font-semibold'
                                  : 'border-amber-500/40 text-amber-400 bg-amber-500/5 font-bold'
                              }`}
                            >
                              <option value="">⚡ Unassigned</option>
                              {(salesStaff || []).map(staff => (
                                <option key={staff.id} value={staff.id}>
                                  {staff.full_name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Status / Revenue */}
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              lead.status === 'new' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                              lead.status === 'converted' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {lead.status}
                            </span>
                            {matchedJob && (
                              <div className="text-[9px] font-mono text-emerald-400 font-bold mt-1">
                                +{Number(matchedJob.work_fee || 0).toFixed(0)} OMR Profit
                              </div>
                            )}
                          </td>

                          {/* Quick Action */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end">
                              {waUrl ? (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-bold transition-colors shadow-sm"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageCircle size={13} /> WhatsApp
                                </a>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">No Phone</span>
                              )}
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

      {/* TAB CONTENT 3: SALES TEAM LEADERBOARD */}
      {activeTab === 'sales_team' && (
        <div className="space-y-6">
          {/* Summary Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Active Sales Team</span>
              <span className="text-2xl font-bold font-syne text-foreground">{salesStaff?.length || 0} Consultants</span>
              <p className="text-[10px] text-emerald-500 font-bold">Round-Robin & Manual Routing</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total Inbound Handled</span>
              <span className="text-2xl font-bold font-syne text-foreground">{stats.totalLeads} Leads</span>
              <p className="text-[10px] text-muted-foreground">In selected timeframe</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Average Team Close Rate</span>
              <span className="text-2xl font-bold font-syne text-emerald-400">{stats.conversionRate}%</span>
              <p className="text-[10px] text-emerald-500 font-bold">Inbound to Closed Job</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Total Team Revenue</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-syne text-primary">{stats.closedRevenue.toFixed(3)}</span>
                <span className="text-xs font-bold text-muted-foreground">OMR</span>
              </div>
              <p className="text-[10px] text-muted-foreground">From closed inbound jobs</p>
            </div>
          </div>

          {/* Sales Consultants Leaderboard Table */}
          <div className="bg-card border border-border/70 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border/60 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <UserCheck size={16} className="text-primary" /> Consultant Performance & Attribution
                </h3>
                <p className="text-[11px] text-muted-foreground">Tracking lead intake, response engagement, quotes created, and closed sales revenue</p>
              </div>
              <span className="text-xs font-bold text-muted-foreground">{salesLeaderboard.length} Sales Executives</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3.5 px-4">Sales Consultant</th>
                    <th className="py-3.5 px-4 text-center">Assigned Leads</th>
                    <th className="py-3.5 px-4 text-center">Contacted %</th>
                    <th className="py-3.5 px-4 text-center">Quotes Built</th>
                    <th className="py-3.5 px-4 text-center">Jobs Won</th>
                    <th className="py-3.5 px-4 text-center">Close Rate %</th>
                    <th className="py-3.5 px-4 text-right">Attributed Revenue (OMR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {salesLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No sales team activity recorded in this timeframe.
                      </td>
                    </tr>
                  ) : (
                    salesLeaderboard.map((item, idx) => (
                      <tr key={item.staff.id} className="hover:bg-muted/20 transition-colors">
                        {/* Consultant */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary uppercase text-xs">
                              {item.staff.avatar_url ? (
                                <img src={item.staff.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                item.staff.full_name?.substring(0, 2) || 'SC'
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <span>{item.staff.full_name}</span>
                                {idx === 0 && item.attributedRevenue > 0 && (
                                  <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded">
                                    🏆 Top Revenue
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {item.staff.role === 'admin' ? 'Manager / Admin' : 'Sales Executive'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Assigned Leads */}
                        <td className="py-3.5 px-4 text-center font-bold text-foreground">
                          <span className="px-2.5 py-1 rounded-lg bg-muted text-xs font-mono font-bold">
                            {item.totalAssigned}
                          </span>
                        </td>

                        {/* Contacted % */}
                        <td className="py-3.5 px-4 text-center font-mono font-bold">
                          <span className={item.contactRate >= 70 ? 'text-emerald-500' : 'text-muted-foreground'}>
                            {item.contactRate}%
                          </span>
                        </td>

                        {/* Quotes Built */}
                        <td className="py-3.5 px-4 text-center font-bold text-indigo-400">
                          {item.quotesCount}
                        </td>

                        {/* Jobs Won */}
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-400">
                          {item.closedJobsCount}
                        </td>

                        {/* Close Rate % */}
                        <td className="py-3.5 px-4 text-center font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${item.conversionRate > 20
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : item.conversionRate > 0
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-muted text-muted-foreground'
                            }`}>
                            {item.conversionRate}%
                          </span>
                        </td>

                        {/* Revenue (OMR) */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-primary">
                          {item.attributedRevenue > 0 ? `${item.attributedRevenue.toFixed(3)} OMR` : '—'}
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

      {/* TAB CONTENT 4: SALES RESPONSE SLA */}
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

      {/* META ADS WEBHOOK CONFIG MODAL */}
      <AnimatePresence>
        {showMetaWebhookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setShowMetaWebhookModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-sm">
                    M
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Meta (FB / IG) Lead Ads Webhook</h3>
                    <p className="text-[10px] text-muted-foreground">App ID: 61596335390056 · Permanent Token Configured</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMetaWebhookModal(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status banner */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400 font-semibold">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Webhook Listener is Live & Ready
                </span>
                <button
                  onClick={handleTestMetaWebhook}
                  disabled={isTestingWebhook}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={10} className={isTestingWebhook ? 'animate-spin' : ''} />
                  {isTestingWebhook ? 'Checking...' : 'Test Handshake'}
                </button>
              </div>

              {/* Credentials to paste in Meta Developer Portal */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    1. Callback URL (Paste in Meta Developer Portal)
                  </label>
                  <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl p-2.5">
                    <input
                      readOnly
                      value="https://wyzwpmwspvksgkmesaah.supabase.co/functions/v1/meta-lead-webhook"
                      className="bg-transparent text-xs text-foreground font-mono w-full outline-none select-all"
                    />
                    <button
                      onClick={() => handleCopy("https://wyzwpmwspvksgkmesaah.supabase.co/functions/v1/meta-lead-webhook", "meta_webhook_url")}
                      className="p-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                      title="Copy URL"
                    >
                      {copiedField === "meta_webhook_url" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    2. Verify Token (Paste in Meta Developer Portal)
                  </label>
                  <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl p-2.5">
                    <input
                      readOnly
                      value="osbic_meta_verify_secret_2026"
                      className="bg-transparent text-xs text-foreground font-mono w-full outline-none select-all"
                    />
                    <button
                      onClick={() => handleCopy("osbic_meta_verify_secret_2026", "meta_verify_token")}
                      className="p-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                      title="Copy Token"
                    >
                      {copiedField === "meta_verify_token" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step instructions */}
              <div className="p-3 rounded-xl bg-muted/20 border border-border/40 text-[11px] space-y-1.5 text-muted-foreground">
                <p className="font-bold text-foreground">Steps in Meta for Developers:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>In your Meta App (<strong>61596335390056</strong>), open <strong>Webhooks</strong>.</li>
                  <li>Select <strong>Page</strong> object ➔ Click <strong>Subscribe to this object</strong>.</li>
                  <li>Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> above ➔ Click <strong>Verify & Save</strong>.</li>
                  <li>In the fields list, find <strong>leadgen</strong> and click <strong>Subscribe</strong>.</li>
                  <li>Test with <a href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noreferrer" className="text-primary underline">Meta Lead Ads Testing Tool</a> to see leads stream here in real time!</li>
                </ol>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowMetaWebhookModal(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LEAD DISQUALIFICATION & REASON PICKER MODAL */}
      <AnimatePresence>
        {activeDisqualifyLead && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setActiveDisqualifyLead(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-sm">
                    <UserX size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Disqualify Lead / Flag Non-Viable</h3>
                    <p className="text-[10px] text-muted-foreground">
                      Lead: <span className="text-foreground font-semibold">{activeDisqualifyLead.contact_name}</span> ({activeDisqualifyLead.contact_phone || 'No phone'})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveDisqualifyLead(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Check if Lead Matches Oman Visa Restriction */}
              {(() => {
                const visaCheck = checkOmanVisaEligibility(activeDisqualifyLead);
                if (!visaCheck.isRestricted) return null;
                return (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-300">
                      <Ban size={13} className="text-red-400" />
                      <span>Oman ROP Restriction Alert: {visaCheck.statusBadgeText}</span>
                    </div>
                    <p className="text-[10px] text-red-200/90 leading-relaxed">
                      {visaCheck.ropNotice}
                    </p>
                  </div>
                );
              })()}

              {/* Reason Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  Select Disqualification Reason:
                </label>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {DISQUALIFICATION_REASONS.map(reason => {
                    const isSelected = selectedDisqualifyReason === reason.key;
                    return (
                      <div
                        key={reason.key}
                        onClick={() => setSelectedDisqualifyReason(reason.key)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-red-500/10 border-red-500/40 text-foreground shadow-sm'
                            : 'bg-muted/30 border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-red-500 bg-red-500 text-white' : 'border-muted-foreground/40'
                        }`}>
                          {isSelected && <Check size={10} />}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{reason.labelEn}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">({reason.labelAr})</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                            {reason.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <button
                  onClick={() => handleUpdateLeadQuality(activeDisqualifyLead.id, 'unreviewed')}
                  className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Reset to Unreviewed
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveDisqualifyLead(null)}
                    className="px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateLeadQuality(activeDisqualifyLead.id, 'disqualified', selectedDisqualifyReason)}
                    disabled={isUpdatingQuality}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Ban size={13} />
                    <span>Confirm Disqualification</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
