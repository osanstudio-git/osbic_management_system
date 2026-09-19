import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CheckCircle2, UserPlus, Users, Sparkles, Loader2, 
  FileText, AlertTriangle, CreditCard, Search, UserCheck, 
  Building, Mail, Phone, ArrowRight, RefreshCw, Check
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useConvertQuotation } from '../../hooks/employee/useConvertQuotation';
import { useAdminServices } from '../../hooks/admin/useAdminServices';
import { useAdminClients } from '../../hooks/admin/useAdminClients';
import CreateClientSlideOver from '../shared/clients/CreateClientSlideOver';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quotation: any; // Invoice of type 'quotation'
}

export default function QuotationAcceptWizard({ isOpen, onClose, quotation }: Props) {
  const { mutateAsync: convertQuotation, isPending: isConverting } = useConvertQuotation();
  const { data: allServices } = useAdminServices();
  const { data: allClients = [], isLoading: loadingClients } = useAdminClients();

  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [clientId, setClientId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');

  const [clientSelectionMode, setClientSelectionMode] = useState<'detected' | 'search' | 'create'>('detected');
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [detectedClient, setDetectedClient] = useState<any>(null);

  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [clientPaysMinistryFee, setClientPaysMinistryFee] = useState(false);

  // Hold mappings of { [itemIndex]: { serviceId: string, serviceName: string, opsEmployeeId: string, workFee: number, ministryFee: number } }
  const [taskAssignments, setTaskAssignments] = useState<any[]>([]);

  // Fetch Ops Employees list (excluding PRO agents)
  const { data: employees } = useQuery({
    queryKey: ['ops_employees_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, can_do_ops, is_pro')
        .eq('role', 'employee')
        .eq('can_do_ops', true);
      if (error) throw error;
      return (data || []).filter((e: any) => !e.is_pro);
    }
  });

  // Handle client initial binding and detection
  useEffect(() => {
    const bindClient = async () => {
      if (!quotation) return;

      // 1. If quotation already has a client_id
      if (quotation.client_id) {
        setClientId(quotation.client_id);
        const name = quotation.client?.full_name || 'Active Client';
        setClientName(name);
        setClientEmail(quotation.client?.email || '');
        setClientPhone(quotation.client?.phone || '');
        setActiveStep(2); // Jump directly to step 2
      } else {
        // 2. Check if a client profile matches the quotation lead's email, phone, or whatsapp
        const leadEmail = quotation.lead?.contact_email?.trim().toLowerCase();
        const leadPhone = quotation.lead?.contact_phone?.replace(/[\s\-\+]/g, '');
        const leadName = quotation.lead?.contact_name?.trim().toLowerCase();

        let matched = null;

        if (allClients && allClients.length > 0) {
          matched = allClients.find((c: any) => {
            const cEmail = c.email?.trim().toLowerCase();
            const cPhone = c.phone?.replace(/[\s\-\+]/g, '');
            const cName = c.full_name?.trim().toLowerCase();

            if (leadEmail && cEmail && cEmail === leadEmail) return true;
            if (leadPhone && cPhone && (cPhone.includes(leadPhone) || leadPhone.includes(cPhone))) return true;
            if (leadName && cName && cName === leadName) return true;
            return false;
          });
        }

        if (!matched && leadEmail) {
          // Direct DB fallback lookup
          const { data: dbClient } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, role')
            .ilike('email', leadEmail)
            .eq('role', 'client')
            .maybeSingle();

          if (dbClient) matched = dbClient;
        }

        if (matched) {
          setDetectedClient(matched);
          setClientId(matched.id);
          setClientName(matched.full_name);
          setClientEmail(matched.email || '');
          setClientPhone(matched.phone || '');
          setClientSelectionMode('detected');
          // Start at step 1 so the user sees the match and confirms, or auto proceed
        } else {
          setDetectedClient(null);
          setClientId('');
          setClientName('');
          setClientSelectionMode('search');
          setActiveStep(1);
        }
      }

      // Initialize assignments list from quotation items
      if (quotation.items) {
        const initial = quotation.items.map((item: any) => {
          // Attempt name matching with DB services to auto-fill service_id
          const matchedService = allServices?.find(
            s => s.name_en.toLowerCase() === item.description?.toLowerCase() ||
                 s.name_ar === item.description
          );

          const minFee = item.ministry_fee !== undefined ? item.ministry_fee : (matchedService?.ministry_fee || 0);
          const workFee = item.service_fee !== undefined ? item.service_fee : (item.unit_price - minFee);

          return {
            itemId: item.id,
            serviceName: item.description || 'Custom Service',
            serviceId: matchedService?.id || '',
            opsEmployeeId: '',
            workFee,
            ministryFee: minFee
          };
        });
        setTaskAssignments(initial);
      }
    };

    bindClient();
  }, [quotation, allServices, allClients]);

  const handleClientCreated = (newClient: any) => {
    setClientId(newClient.id);
    setClientName(newClient.full_name);
    setClientEmail(newClient.email || '');
    setClientPhone(newClient.phone || '');
    setDetectedClient(newClient);
    setIsCreateClientOpen(false);
    setActiveStep(2); // Jump directly to step 2 after registration/link
  };

  const handleSelectExistingClient = (client: any) => {
    setClientId(client.id);
    setClientName(client.full_name);
    setClientEmail(client.email || '');
    setClientPhone(client.phone || '');
    setDetectedClient(client);
    toast.success(`Selected client: ${client.full_name}`);
    setActiveStep(2);
  };

  const handleAssignmentChange = (idx: number, key: string, val: string) => {
    setTaskAssignments(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });
  };

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return allClients.slice(0, 8);
    const q = clientSearchQuery.toLowerCase();
    return allClients.filter(c => 
      c.full_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.client_code?.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [allClients, clientSearchQuery]);

  const handleLaunch = async () => {
    if (!clientId) {
      toast.error('Please link or register a client profile first.');
      setActiveStep(1);
      return;
    }

    // Notice: We do NOT block custom/unmapped services! They are fully supported.
    const assignmentsPayload = taskAssignments.map(a => ({
      serviceId: a.serviceId || null,
      serviceName: a.serviceName || 'Custom Service Task',
      opsEmployeeId: a.opsEmployeeId || null,
      workFee: a.workFee || 0,
      ministryFee: a.ministryFee || 0
    }));

    try {
      await convertQuotation({
        quotationId: quotation.id,
        clientId,
        leadId: quotation.lead_id,
        salesEmployeeId: quotation.employee_id,
        totalAmount: quotation.total_amount,
        subtotal: quotation.subtotal,
        taxAmount: quotation.tax_amount,
        client_pays_ministry_fee: clientPaysMinistryFee,
        assignments: assignmentsPayload
      });

      toast.success('Client Job launched successfully! Operational team notified.');
      onClose();
    } catch (err: any) {
      console.error("Quotation conversion error:", err);
      toast.error('Failed to launch job: ' + (err.message || 'Unknown error occurred'));
    }
  };

  if (!isOpen || !quotation) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-card border border-border rounded-[2.5rem] shadow-2xl flex flex-col z-10"
      >
        {/* Header */}
        <div className="p-6 lg:p-8 border-b border-border/60 flex justify-between items-start bg-muted/10">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-xl font-syne font-bold text-foreground leading-tight">ACCEPT QUOTATION & LAUNCH JOB</h2>
              <p className="text-xs text-muted-foreground">Link Client Account & Assign Operational Workload</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Wizard Steps indicator */}
        <div className="grid grid-cols-2 border-b border-border text-center text-xs font-bold font-syne">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={cn(
              "py-4 transition-all border-b-2 flex items-center justify-center gap-2",
              activeStep === 1 ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">1</span>
            1. Client Account Linking
          </button>
          <button
            type="button"
            onClick={() => {
              if (!clientId) {
                toast.error('Please select or register a client first.');
                return;
              }
              setActiveStep(2);
            }}
            className={cn(
              "py-4 transition-all border-b-2 flex items-center justify-center gap-2",
              activeStep === 2 ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]">2</span>
            2. Operational Assignment & Mapping
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-thin scrollbar-thumb-border">
          {activeStep === 1 && (
            <div className="space-y-6">
              {/* Lead Details Banner */}
              <div className="p-4 border border-border bg-muted/20 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md">
                      Quotation Target
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {quotation.lead?.contact_name || quotation.client?.full_name || 'Direct Client'}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {quotation.lead?.company_name ? `${quotation.lead.company_name} • ` : ''}
                    {quotation.lead?.contact_email || quotation.client?.email || 'No email provided'} • {quotation.lead?.contact_phone || quotation.client?.phone || 'No phone'}
                  </p>
                </div>
                {clientId && (
                  <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
                    <CheckCircle2 size={14} /> Linked: {clientName}
                  </div>
                )}
              </div>

              {/* Detected Match Card */}
              {detectedClient && (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <UserCheck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-foreground">{detectedClient.full_name}</h4>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase">
                            Registered Account Found
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {detectedClient.email || 'No email'} • {detectedClient.phone || 'No phone'}
                          {detectedClient.company_name ? ` • ${detectedClient.company_name}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectExistingClient(detectedClient)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 shrink-0"
                    >
                      Use Profile <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Action Selection Tabs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">
                    Choose Client Account Option
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setClientSelectionMode('search')}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
                        clientSelectionMode === 'search'
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Search size={13} /> Link Existing Account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClientSelectionMode('create');
                        setIsCreateClientOpen(true);
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
                        clientSelectionMode === 'create'
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/40 text-foreground hover:bg-muted border border-border"
                      )}
                    >
                      <UserPlus size={13} /> Register New Account
                    </button>
                  </div>
                </div>

                {/* Existing Client Search & Select */}
                {clientSelectionMode === 'search' && (
                  <div className="space-y-3 bg-muted/10 p-5 rounded-2xl border border-border/80">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                      <input
                        type="text"
                        placeholder="Search existing clients by name, company, email, phone or CLT code..."
                        value={clientSearchQuery}
                        onChange={e => setClientSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-all font-medium"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-border pr-1">
                      {loadingClients ? (
                        <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <Loader2 className="animate-spin" size={14} /> Loading client directory...
                        </div>
                      ) : filteredClients.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground space-y-2">
                          <p>No matching client profiles found.</p>
                          <button
                            type="button"
                            onClick={() => setIsCreateClientOpen(true)}
                            className="inline-flex items-center gap-1.5 text-primary hover:underline font-bold text-xs"
                          >
                            <UserPlus size={13} /> Click here to register a new client profile
                          </button>
                        </div>
                      ) : (
                        filteredClients.map(c => {
                          const isSelected = clientId === c.id;
                          return (
                            <div
                              key={c.id}
                              onClick={() => handleSelectExistingClient(c)}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                                isSelected
                                  ? "bg-primary/10 border-primary/40 text-foreground"
                                  : "bg-card border-border/60 hover:border-primary/40 hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                                )}>
                                  {c.full_name?.charAt(0)?.toUpperCase() || 'C'}
                                </div>
                                <div className="truncate">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-foreground truncate">{c.full_name}</p>
                                    {c.client_code && (
                                      <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                                        {c.client_code}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {c.company_name ? `${c.company_name} • ` : ''}
                                    {c.email || 'No email'} {c.phone ? ` • ${c.phone}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isSelected ? (
                                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                    <Check size={13} />
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-primary hover:underline px-2 py-1">
                                    Select
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Direct Register Prompt Button */}
                <button
                  type="button"
                  onClick={() => setIsCreateClientOpen(true)}
                  className="w-full py-4 border-2 border-dashed border-primary/30 hover:border-primary text-primary hover:bg-primary/5 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} /> Register New Client Account for this Quotation
                </button>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6">
              {/* Linked Client Summary & Switch Option */}
              <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    <UserCheck size={16} />
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider block">Target Client Account</span>
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                      {clientName} {clientEmail ? `(${clientEmail})` : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  className="px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                >
                  Switch Client
                </button>
              </div>

              {/* Ministry Fee Payment Method Selector */}
              <div className={cn(
                "bg-card border rounded-2xl p-5 transition-all shadow-sm",
                clientPaysMinistryFee ? 'border-blue-500/30 bg-blue-500/5' : 'border-border'
              )}>
                <div className="flex items-start gap-3 mb-4">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    clientPaysMinistryFee ? 'bg-blue-500/20 text-blue-400' : 'bg-muted text-muted-foreground'
                  )}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-foreground uppercase tracking-widest">Ministry Fee Payment Routing</h5>
                    <p className="text-[10px] text-muted-foreground mt-0.5">How will the official government/ministry fees be funded?</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option A: OSBIC handles */}
                  <button
                    type="button"
                    onClick={() => setClientPaysMinistryFee(false)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                      !clientPaysMinistryFee
                        ? 'border-primary/50 bg-primary/5 shadow-sm'
                        : 'border-border bg-muted/20 hover:border-border/80'
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      !clientPaysMinistryFee ? 'border-primary' : 'border-muted-foreground/30'
                    )}>
                      {!clientPaysMinistryFee && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">OSBIC Advances & Handles</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Subject to internal fund ledger approval.</p>
                    </div>
                  </button>

                  {/* Option B: Client Card directly */}
                  <button
                    type="button"
                    onClick={() => setClientPaysMinistryFee(true)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                      clientPaysMinistryFee
                        ? 'border-blue-500/50 bg-blue-500/10 shadow-sm'
                        : 'border-border bg-muted/20 hover:border-border/80'
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      clientPaysMinistryFee ? 'border-blue-400' : 'border-muted-foreground/30'
                    )}>
                      {clientPaysMinistryFee && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Client Paying Directly via Card</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Bypass internal fund allocation for faster execution.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Service Assignments & Mapping */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-card p-4 border border-border rounded-2xl shadow-sm">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Users size={14}/> Operational Tasks & Services ({taskAssignments.length})
                    </h3>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      Map to existing catalog templates or keep as direct custom service tasks.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-primary uppercase tracking-wider shrink-0">Quick Assign All:</span>
                    <select
                      onChange={e => {
                        const employeeId = e.target.value;
                        if (!employeeId) return;
                        setTaskAssignments(prev => prev.map(t => ({ ...t, opsEmployeeId: employeeId })));
                        e.target.value = "";
                      }}
                      className="bg-muted/40 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-all font-semibold"
                    >
                      <option value="" className="bg-card text-foreground">-- Select Worker --</option>
                      {employees?.map(emp => (
                        <option key={emp.id} value={emp.id} className="bg-card text-foreground">{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {taskAssignments.map((asg, idx) => {
                    const isCustom = !asg.serviceId;
                    return (
                      <div key={idx} className="p-4 bg-card border border-border rounded-2xl space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-foreground">{asg.serviceName}</span>
                          </div>
                          <span className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                            isCustom ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          )}>
                            {isCustom ? 'Custom / Direct Task' : 'Catalog Mapped'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Map Service Template */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Service Category Mapping
                              </label>
                              {isCustom && (
                                <span className="text-[9px] text-amber-500/90 font-medium">
                                  No catalog match required
                                </span>
                              )}
                            </div>
                            <select
                              value={asg.serviceId}
                              onChange={e => handleAssignmentChange(idx, 'serviceId', e.target.value)}
                              className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all font-medium"
                            >
                              <option value="" className="bg-card text-foreground">
                                ⚡ Custom / Direct Service ("{asg.serviceName}")
                              </option>
                              {allServices?.filter(s => s.is_active).map(s => (
                                <option key={s.id} value={s.id} className="bg-card text-foreground">
                                  {s.name_en} {s.category ? `(${s.category})` : ''}
                                </option>
                              ))}
                            </select>
                            <p className="text-[9px] text-muted-foreground">
                              {isCustom 
                                ? 'Will be created as a custom task using the quote description.'
                                : 'Will attach standard workflow blueprint steps & milestones.'}
                            </p>
                          </div>

                          {/* Assign ops employee */}
                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                              Assign Operational Worker
                            </label>
                            <select
                              value={asg.opsEmployeeId}
                              onChange={e => handleAssignmentChange(idx, 'opsEmployeeId', e.target.value)}
                              className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all font-medium"
                            >
                              <option value="" className="bg-card text-foreground">-- Auto-Assign / Unassigned --</option>
                              {employees?.map(e => (
                                <option key={e.id} value={e.id} className="bg-card text-foreground">
                                  {e.full_name} ({e.role})
                                </option>
                              ))}
                            </select>
                            <p className="text-[9px] text-muted-foreground">
                              Assigned coworker will receive an instant notification in their workload tray.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-5 border-t border-border/40 bg-muted/10">
          <div>
            <span className="text-[10px] text-muted-foreground block">Total Quotation Value</span>
            <span className="text-xs font-bold text-foreground">OMR {quotation.total_amount?.toFixed(3) || '0.000'}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
            >
              Cancel
            </button>

            {activeStep === 1 && (
              <button
                type="button"
                onClick={() => {
                  if (!clientId) {
                    toast.error('Please select or register a client first.');
                    return;
                  }
                  setActiveStep(2);
                }}
                disabled={!clientId}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/95 text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Proceed to Tasks <ArrowRight size={14} />
              </button>
            )}

            {activeStep === 2 && (
              <button
                onClick={handleLaunch}
                disabled={isConverting || !clientId}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-95"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Launching Job...
                  </>
                ) : (
                  <>
                    <FileText size={14} /> Accept Quote & Launch Job
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Convert Lead to Client SlideOver */}
      <CreateClientSlideOver
        isOpen={isCreateClientOpen}
        onClose={() => setIsCreateClientOpen(false)}
        onClientCreated={handleClientCreated}
        clientToEdit={{
          full_name: quotation.lead?.contact_name || quotation.client?.full_name || '',
          email: quotation.lead?.contact_email || quotation.client?.email || '',
          phone: quotation.lead?.contact_phone || quotation.client?.phone || '',
          whatsapp: quotation.lead?.contact_whatsapp || '',
          nationality: quotation.lead?.nationality || 'Oman',
          company_name: quotation.lead?.company_name || ''
        }}
      />
    </div>,
    document.body
  );
}
