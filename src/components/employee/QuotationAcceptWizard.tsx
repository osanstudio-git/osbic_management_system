import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, UserPlus, Users, Sparkles, Loader2, FileText, AlertTriangle, CreditCard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useConvertQuotation } from '../../hooks/employee/useConvertQuotation';
import { useAdminServices } from '../../hooks/admin/useAdminServices';
import CreateClientSlideOver from '../shared/clients/CreateClientSlideOver';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
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

  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const [clientId, setClientId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [clientPaysMinistryFee, setClientPaysMinistryFee] = useState(false);

  // Hold mappings of { [itemIndex]: { serviceId: string, serviceName: string, opsEmployeeId: string } }
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

  // Handle client initial binding
  useEffect(() => {
    const bindClient = async () => {
      if (quotation) {
        if (quotation.client_id) {
          setClientId(quotation.client_id);
          setClientName(quotation.client?.full_name || 'Active Client');
          setActiveStep(2); // Jump to step 2 directly
        } else if (quotation.lead?.contact_email) {
          // Check if a client profile already exists with this lead's email to avoid signup conflict
          const { data: existingClient } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('email', quotation.lead.contact_email)
            .eq('role', 'client')
            .maybeSingle();

          if (existingClient) {
            setClientId(existingClient.id);
            setClientName(existingClient.full_name);
            setActiveStep(2); // Jump directly to step 2
          } else {
            setClientId('');
            setClientName('');
            setActiveStep(1); // Force step 1 to convert lead
          }
        } else {
          setClientId('');
          setClientName('');
          setActiveStep(1); // Force step 1 to convert lead
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
      }
    };

    bindClient();
  }, [quotation, allServices]);

  const handleClientCreated = (newClient: any) => {
    setClientId(newClient.id);
    setClientName(newClient.full_name);
    toast.success(`Client profile created for ${newClient.full_name}!`);
    setActiveStep(2); // Set step 2 in background; user will close the credentials slideover manually
  };

  const handleAssignmentChange = (idx: number, key: string, val: string) => {
    setTaskAssignments(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });
  };

  const handleLaunch = async () => {
    const unmappedIndex = taskAssignments.findIndex(a => !a.serviceId);
    if (unmappedIndex !== -1) {
      toast.error(`Please select a Service Category Mapping for item #${unmappedIndex + 1}: "${taskAssignments[unmappedIndex].serviceName}"`);
      return;
    }

    const assignmentsPayload = taskAssignments.map(a => ({
      serviceId: a.serviceId || null,
      serviceName: a.serviceName,
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

      toast.success('Client Job launched successfully! Workers notified.');
      onClose();
    } catch (err: any) {
      toast.error('Failed to launch job: ' + err.message);
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
        <div className="p-6 lg:p-8 border-b border-border/60 flex justify-between items-start">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-xl font-syne font-bold text-foreground leading-tight">LAUNCH CLIENT JOB FILE</h2>
              <p className="text-xs text-muted-foreground">Approve Quote & Delegate Operational Workload</p>
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
          <div className={cn(
            "py-4 transition-all border-b-2",
            activeStep === 1 ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent"
          )}>
            1. Client Conversion
          </div>
          <div className={cn(
            "py-4 transition-all border-b-2",
            activeStep === 2 ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent"
          )}>
            2. Operational Assignment
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 scrollbar-thin scrollbar-thumb-border">
          {activeStep === 1 && (
            <div className="space-y-6">
              <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-4 text-xs">
                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                <div className="space-y-1 text-muted-foreground">
                  <p className="font-bold text-foreground">Lead Profile Detected</p>
                  <p>Before launching a client file and delegating tasks to operations, you must convert the lead and register an official Client Account profile.</p>
                </div>
              </div>

              <div className="p-5 border border-border bg-muted/20 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Lead Details Summary</p>
                <div className="text-xs space-y-2">
                  <p><span className="text-muted-foreground">Name:</span> <span className="font-semibold">{quotation.lead?.contact_name || 'N/A'}</span></p>
                  <p><span className="text-muted-foreground">Company:</span> <span className="font-medium text-foreground">{quotation.lead?.company_name || 'Individual'}</span></p>
                  <p><span className="text-muted-foreground">Contact:</span> <span>{quotation.lead?.contact_phone || 'N/A'} • {quotation.lead?.contact_email || 'N/A'}</span></p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateClientOpen(true)}
                className="w-full py-4 border border-primary/20 hover:border-primary text-primary hover:bg-primary/5 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
              >
                <UserPlus size={16} /> Register Client Profile & Convert Lead
              </button>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6">
              {/* Client summary */}
              <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-xs">
                <span className="text-muted-foreground">Active Client Profile Linked:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={14} /> {clientName}
                </span>
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">How will the Ministry Fee be paid?</p>
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
                        ? 'border-primary/50 bg-primary/5'
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
                      <p className="text-[9px] text-muted-foreground mt-0.5">Subject to standard locks & fund allocation.</p>
                    </div>
                  </button>

                  {/* Option B: Client Card directly */}
                  <button
                    type="button"
                    onClick={() => setClientPaysMinistryFee(true)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                      clientPaysMinistryFee
                        ? 'border-blue-500/50 bg-blue-500/10'
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
                      <p className="text-[9px] text-muted-foreground mt-0.5">Bypass fund allocation. Immediate unlock for Ops.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Service Assignments */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-card p-4 border border-border rounded-2xl shadow-sm">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5"><Users size={14}/> Delegate Tasks</h3>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{taskAssignments.length} Operational Services</p>
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
                  {taskAssignments.map((asg, idx) => (
                    <div key={idx} className="p-4 bg-card border border-border rounded-2xl space-y-3.5 shadow-sm">
                      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                        <span className="text-[10px] w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{idx + 1}</span>
                        <span className="text-xs font-bold text-foreground">{asg.serviceName}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Map Service Template */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Service Category Mapping</label>
                          <select
                            value={asg.serviceId}
                            onChange={e => handleAssignmentChange(idx, 'serviceId', e.target.value)}
                            className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold transition-all"
                          >
                            <option value="" className="bg-card text-foreground">-- Custom / Unmapped Service --</option>
                            {allServices?.filter(s => s.is_active).map(s => (
                              <option key={s.id} value={s.id} className="bg-card text-foreground">{s.name_en}</option>
                            ))}
                          </select>
                        </div>

                        {/* Assign ops employee */}
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Assign Operational Worker</label>
                          <select
                            value={asg.opsEmployeeId}
                            onChange={e => handleAssignmentChange(idx, 'opsEmployeeId', e.target.value)}
                            className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold transition-all"
                          >
                            <option value="" className="bg-card text-foreground">-- Choose Worker --</option>
                            {employees?.map(e => (
                              <option key={e.id} value={e.id} className="bg-card text-foreground">{e.full_name} ({e.role})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-5 border-t border-border/40 bg-white/5">
          <span className="text-[10px] text-muted-foreground">Omr {quotation.total_amount.toFixed(3)} Total Quote Amount</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
            >
              Cancel
            </button>
            {activeStep === 2 && (
              <button
                onClick={handleLaunch}
                disabled={isConverting}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/95 text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Launching...
                  </>
                ) : (
                  <>
                    <FileText size={14} /> Accept & Launch Job
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
          full_name: quotation.lead?.contact_name || '',
          email: quotation.lead?.contact_email || '',
          phone: quotation.lead?.contact_phone || '',
          whatsapp: quotation.lead?.contact_whatsapp || '',
          nationality: quotation.lead?.nationality || 'Oman'
        }}
      />
    </div>,
    document.body
  );
}
