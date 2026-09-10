import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminServices } from "../../hooks/admin/useAdminServices";
import { useAdminClients } from "../../hooks/admin/useAdminClients";
import { X, Zap, User, Phone, Search, Shield, Users, Plus, Trash2, CreditCard, Check, FolderKanban } from "lucide-react";
import toast from "react-hot-toast";

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated: () => void;
}

export const WalkInModal = ({ isOpen, onClose, onJobCreated }: WalkInModalProps) => {
  const { profile } = useAuth();
  const { data: services } = useAdminServices();
  const { data: allClients } = useAdminClients();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client Selection Mode: New vs Existing
  const [clientMode, setClientMode] = useState<'new' | 'existing'>('new');
  const [existingClientSearch, setExistingClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientActiveJobs, setClientActiveJobs] = useState<any[]>([]);
  const [selectedTargetJobId, setSelectedTargetJobId] = useState<string>('new');
  const [loadingClientJobs, setLoadingClientJobs] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [notes, setNotes] = useState("");

  const [isDropdownOpen, setIsDropdownOpen] = useState(true);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  // POS / Simple Task States
  const [posDescription, setPosDescription] = useState("");
  const [posAmount, setPosAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const filteredClients = (allClients || []).filter(c => {
    const q = existingClientSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.client_code || '').toLowerCase().includes(q)
    );
  }).slice(0, 10);

  const handleSelectClient = async (c: any) => {
    setSelectedClient(c);
    setClientName(c.full_name);
    setClientPhone(c.phone || '');
    setLoadingClientJobs(true);
    try {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, job_code, status, total_fee, work_fee, ministry_fee, custom_name, created_at, services:service_id(name_en)')
        .eq('client_id', c.id)
        .in('status', ['active', 'awaiting_govt', 'draft'])
        .order('created_at', { ascending: false });
      setClientActiveJobs(jobsData || []);
      setSelectedTargetJobId('new');
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClientJobs(false);
    }
  };

  const toggleService = (s: any) => {
    if (s.isPosPlaceholder) {
      setSelectedServices([{
        id: s.id,
        name: s.name_en,
        workFee: 0,
        ministryFee: 0,
        quantity: 1,
        paidByClientCard: false,
        cardAmountPaid: 0,
        isPosPlaceholder: true
      }]);
      setIsDropdownOpen(false);
      setServiceSearch("");
      return;
    }

    // Clear POS if it was selected
    let list = selectedServices.filter(item => !item.isPosPlaceholder);

    const exists = list.some(item => item.id === s.id);
    if (exists) {
      list = list.filter(item => item.id !== s.id);
    } else {
      list.push({
        id: s.id,
        name: s.name_en,
        workFee: s.work_fee || 0,
        ministryFee: s.ministry_fee || 0,
        quantity: 1,
        paidByClientCard: false,
        cardAmountPaid: 0,
        isPosPlaceholder: false
      });
    }
    setSelectedServices(list);
    setServiceSearch("");
    setIsDropdownOpen(false);
  };

  const addCustomTaskWithName = (name: string) => {
    const list = selectedServices.filter(item => !item.isPosPlaceholder);
    const customId = `custom_${Date.now()}`;
    list.push({
      id: customId,
      name: name,
      workFee: 0,
      ministryFee: 0,
      quantity: 1,
      paidByClientCard: false,
      cardAmountPaid: 0,
      isCustom: true,
      isPosPlaceholder: false
    });
    setSelectedServices(list);
  };

  const addCustomTask = () => {
    addCustomTaskWithName("Custom Service");
  };

  const handleSubmit = async () => {
    if (!clientName.trim() || selectedServices.length === 0) {
      toast.error("Client name and at least one service are required");
      return;
    }
    setIsSubmitting(true);

    try {
      const isPos = selectedServices.length === 1 && selectedServices[0].isPosPlaceholder;

      if (isPos) {
        if (!posDescription.trim() || !posAmount) {
          toast.error("Description and amount are required for simple task");
          setIsSubmitting(false);
          return;
        }

        const { error: rpcErr } = await (supabase.rpc as any)('create_quick_task', {
          p_employee_id: profile?.id,
          p_task_description: posDescription.trim(),
          p_amount: parseFloat(posAmount),
          p_payment_method: paymentMethod,
          p_customer_name: clientName.trim(),
          p_customer_phone: clientPhone.trim() || null,
          p_status: "completed"
        });

        if (rpcErr) throw rpcErr;
        toast.success(`Quick Task completed for ${clientName}!`);
      } else {
        let resolvedClientId = selectedClient?.id;

        if (!resolvedClientId) {
          const dummyEmail = `walkin_${Date.now()}_${Math.floor(Math.random() * 1000)}@osbic.local`;
          const dummyPassword = `Walkin_${Math.random().toString(36).slice(-8)}!`;

          const { createClient } = await import('@supabase/supabase-js');
          const authClient = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY,
            {
              auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
              }
            }
          );

          const { data: authData, error: authError } = await authClient.auth.signUp({
            email: dummyEmail,
            password: dummyPassword,
            options: {
              data: {
                full_name: clientName.trim(),
                role: 'client'
              }
            }
          });

          if (authError) throw authError;
          if (!authData.user) throw new Error("Failed to register walk-in customer auth credentials.");

          const clientCode = `CLT-${Date.now().toString().slice(-7)}`;

          const { data: client, error: cErr } = await (supabase
            .from("profiles")
            .upsert({
              id: authData.user.id,
              full_name: clientName.trim(),
              email: dummyEmail,
              phone: clientPhone.trim() || null,
              role: "client",
              client_code: clientCode,
              is_active: true,
              branch_id: profile?.branch_id,
            }, { onConflict: 'id' })
            .select()
            .single() as any);

          if (cErr) throw cErr;
          resolvedClientId = client.id;
        }

        let totalWorkFee = 0;
        let totalMinistryFee = 0;
        let totalFeeToOsan = 0;

        for (const item of selectedServices) {
          const qty = item.quantity;
          totalWorkFee += item.workFee * qty;
          totalMinistryFee += item.ministryFee * qty;
          
          const minToOsan = item.paidByClientCard ? 0 : item.ministryFee;
          totalFeeToOsan += (item.workFee + minToOsan) * qty;
        }

        const catalogService = selectedServices.find(item => !item.isCustom);
        let mainServiceId = catalogService?.id;

        if (!mainServiceId) {
          const { data: dbS } = await supabase.from('services').select('id').eq('name_en', 'Quick Task (POS)').maybeSingle();
          mainServiceId = dbS?.id;
        }

        const clientPaysMinistryFee = selectedServices.some(item => item.paidByClientCard);

        if (clientMode === 'existing' && selectedTargetJobId && selectedTargetJobId !== 'new') {
          const targetJob = clientActiveJobs.find(j => j.id === selectedTargetJobId);
          const targetJobId = selectedTargetJobId;

          const rows = [];
          for (const item of selectedServices) {
            for (let i = 0; i < item.quantity; i++) {
              rows.push({
                job_id: targetJobId,
                service_id: item.isCustom ? mainServiceId : item.id,
                service_name: item.name,
                display_order: rows.length + 1,
                quantity: item.quantity,
                item_number: i + 1,
                status: "pending",
                work_fee: item.workFee,
                ministry_fee: item.ministryFee,
                total_fee: item.paidByClientCard ? item.workFee : (item.workFee + item.ministryFee),
                ministry_fee_allocated: item.paidByClientCard ? item.ministryFee : 0,
                is_funded: item.paidByClientCard ? true : false,
                ops_employee_id: profile?.id,
                assigned_by: profile?.id,
                assigned_at: new Date().toISOString(),
                notes: item.paidByClientCard ? `[PAID BY CLIENT CARD] ${notes || ''}` : (notes || null),
              });
            }
          }

          const { error: sErr } = await (supabase.from("job_services").insert(rows as any) as any);
          if (sErr) throw sErr;

          if (targetJob) {
            const newTotalFee = (targetJob.total_fee || 0) + totalFeeToOsan;
            const newWorkFee = (targetJob.work_fee || 0) + totalWorkFee;
            const newMinistryFee = (targetJob.ministry_fee || 0) + totalMinistryFee;
            await supabase.from("jobs").update({
              total_fee: newTotalFee,
              work_fee: newWorkFee,
              ministry_fee: newMinistryFee,
              remaining_amount: (targetJob.remaining_amount || 0) + totalFeeToOsan,
              client_pays_ministry_fee: targetJob.client_pays_ministry_fee || clientPaysMinistryFee
            } as any).eq('id', targetJobId);
          }

          toast.success(`Services added to active project ${targetJob?.job_code || ''}!`);
        } else {
          const { data: job, error: jErr } = await (supabase.from("jobs").insert({
            job_code: `WI-${Math.floor(Math.random() * 100000)}`,
            client_id: resolvedClientId,
            employee_id: profile?.id,
            assigned_by: profile?.id,
            service_id: mainServiceId,
            status: "active",
            total_fee: totalFeeToOsan,
            work_fee: totalWorkFee,
            ministry_fee: totalMinistryFee,
            ministry_fee_type: "fixed",
            client_pays_ministry_fee: clientPaysMinistryFee,
            advance_percentage: 0,
            advance_amount: 0,
            remaining_amount: totalFeeToOsan,
            advance_paid: false,
            remaining_paid: false,
            entry_type: "walkin",
            sales_employee_id: profile?.id,
            ops_employee_id: profile?.id,
            branch_id: profile?.branch_id,
          } as any).select().single() as any);
          if (jErr) throw jErr;

          const rows = [];
          for (const item of selectedServices) {
            for (let i = 0; i < item.quantity; i++) {
              rows.push({
                job_id: job.id,
                service_id: item.isCustom ? mainServiceId : item.id,
                service_name: item.name,
                display_order: rows.length + 1,
                quantity: item.quantity,
                item_number: i + 1,
                status: "pending",
                work_fee: item.workFee,
                ministry_fee: item.ministryFee,
                total_fee: item.paidByClientCard ? item.workFee : (item.workFee + item.ministryFee),
                ministry_fee_allocated: item.paidByClientCard ? item.ministryFee : 0,
                is_funded: item.paidByClientCard ? true : false,
                ops_employee_id: profile?.id,
                assigned_by: profile?.id,
                assigned_at: new Date().toISOString(),
                notes: item.paidByClientCard ? `[PAID BY CLIENT CARD] ${notes || ''}` : (notes || null),
              });
            }
          }

          const { error: sErr } = await (supabase.from("job_services").insert(rows as any) as any);
          if (sErr) throw sErr;

          toast.success(`Walk-in job created for ${clientName}!`);
        }
      }

      setClientName("");
      setClientPhone("");
      setSelectedClient(null);
      setClientActiveJobs([]);
      setSelectedTargetJobId('new');
      setExistingClientSearch('');
      setPosDescription("");
      setPosAmount("");
      setSelectedServices([]);
      setNotes("");
      onJobCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit walk-in");
    } finally {
      setIsSubmitting(false);
    }
  };

  const posServiceOption = {
    id: "pos_task_simple",
    name_en: "Simple Task / Typing / Printing (POS)",
    name_ar: "مهمة سريعة / طباعة / تخليص فوري",
    work_fee: 0,
    ministry_fee: 0,
    requires_pro: false,
    isPosPlaceholder: true
  };

  const rawOptions = [
    posServiceOption,
    ...(services?.filter(s => s.is_active) || [])
  ];

  const matched = rawOptions.filter(s =>
    s.name_en.toLowerCase().includes(serviceSearch.toLowerCase()) ||
    (s.name_ar && s.name_ar.includes(serviceSearch))
  );

  const dropdownOptions = [...matched];
  const hasExactMatch = matched.some(m => m.name_en.toLowerCase() === serviceSearch.trim().toLowerCase());
  
  if (serviceSearch.trim() && !hasExactMatch) {
    dropdownOptions.push({
      id: "virtual_custom_task",
      name_en: `✨ Press Enter to add custom task: "${serviceSearch.trim()}"`,
      name_ar: `إضافة خدمة مخصصة: "${serviceSearch.trim()}"`,
      work_fee: 0,
      ministry_fee: 0,
      requires_pro: false,
      isPosPlaceholder: false,
      isCustomVirtual: true
    } as any);
  }

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [serviceSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveSearchIndex(prev => (prev + 1) % dropdownOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveSearchIndex(prev => (prev - 1 + dropdownOptions.length) % dropdownOptions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (dropdownOptions.length > 0) {
        const selected = dropdownOptions[activeSearchIndex];
        if (selected) {
          if (selected.isCustomVirtual) {
            addCustomTaskWithName(serviceSearch.trim());
            setServiceSearch("");
            setIsDropdownOpen(false);
          } else {
            toggleService(selected);
          }
        }
      } else if (serviceSearch.trim()) {
        addCustomTaskWithName(serviceSearch.trim());
        setServiceSearch("");
        setIsDropdownOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-[#1a2130] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10"
          >
            <div className="p-6 pb-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gold/10 flex items-center justify-center text-gold">
                  <Zap size={20} />
                </div>
                <div>
                  <h2 className="font-syne font-bold text-white text-lg">Walk-in Entry</h2>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Quick counter registration</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Client & File Details</p>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setClientMode('new');
                        setSelectedClient(null);
                        setClientActiveJobs([]);
                        setSelectedTargetJobId('new');
                      }}
                      className={`px-3 py-1 rounded-lg transition-colors ${clientMode === 'new' ? 'bg-gold text-[#0A0F1E]' : 'text-white/60 hover:text-white'}`}
                    >
                      New Walk-in
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientMode('existing')}
                      className={`px-3 py-1 rounded-lg transition-colors ${clientMode === 'existing' ? 'bg-gold text-[#0A0F1E]' : 'text-white/60 hover:text-white'}`}
                    >
                      Existing Client & Files
                    </button>
                  </div>
                </div>

                {clientMode === 'new' ? (
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Full Name *"
                        className="w-full bg-black/30 border border-white/10 focus:border-gold rounded-xl pl-9 pr-3 py-3 text-sm text-white outline-none transition-all placeholder:text-white/20"
                      />
                    </div>
                    <div className="flex-1 relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        type="tel"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Phone (optional)"
                        className="w-full bg-black/30 border border-white/10 focus:border-gold rounded-xl pl-9 pr-3 py-3 text-sm text-white outline-none transition-all placeholder:text-white/20"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!selectedClient ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                          <input
                            type="text"
                            value={existingClientSearch}
                            onChange={(e) => setExistingClientSearch(e.target.value)}
                            placeholder="Search registered clients by name, phone, or code..."
                            className="w-full bg-black/30 border border-white/10 focus:border-gold rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none transition-all placeholder:text-white/30"
                          />
                        </div>
                        <div className="max-h-36 overflow-y-auto bg-black/40 border border-white/10 rounded-xl divide-y divide-white/5">
                          {filteredClients.length > 0 ? (
                            filteredClients.map((c: any) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectClient(c)}
                                className="w-full text-left px-3.5 py-2 hover:bg-gold/10 transition-colors flex items-center justify-between"
                              >
                                <div>
                                  <p className="text-xs font-bold text-white">{c.full_name}</p>
                                  <p className="text-[10px] text-white/40">{c.phone || 'No phone'} • {c.client_code || 'CLT'}</p>
                                </div>
                                <span className="text-[9px] font-bold text-gold uppercase tracking-wider">Select</span>
                              </button>
                            ))
                          ) : (
                            <p className="p-3 text-center text-xs text-white/30">No clients found matching search</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gold/10 border border-gold/30 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono font-bold bg-gold/20 text-gold px-2 py-0.5 rounded border border-gold/30">
                              {selectedClient.client_code || 'CLIENT'}
                            </span>
                            <h4 className="text-xs font-bold text-white">{selectedClient.full_name}</h4>
                            <span className="text-[10px] text-white/50">({selectedClient.phone || 'No phone'})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClient(null);
                              setClientName('');
                              setClientPhone('');
                              setClientActiveJobs([]);
                              setSelectedTargetJobId('new');
                            }}
                            className="text-[10px] text-red-400 hover:underline font-bold"
                          >
                            Change Client
                          </button>
                        </div>

                        <div className="space-y-1 pt-1 border-t border-gold/20">
                          <label className="text-[9px] font-bold text-gold/80 uppercase tracking-widest block">
                            Target Project / Job File
                          </label>
                          {loadingClientJobs ? (
                            <p className="text-[10px] text-white/40 animate-pulse">Loading active client projects...</p>
                          ) : (
                            <select
                              value={selectedTargetJobId}
                              onChange={(e) => setSelectedTargetJobId(e.target.value)}
                              className="w-full bg-[#141b26] border border-gold/30 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold"
                            >
                              <option value="new">📁 Create as New Walk-in File</option>
                              {clientActiveJobs.map((j: any) => (
                                <option key={j.id} value={j.id}>
                                  🔗 Attach to Active File: {j.job_code} - {j.services?.name_en || j.custom_name || 'Project'} (Status: {j.status})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2 relative">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Select or Create Task *</label>
                  <button
                    type="button"
                    onClick={addCustomTask}
                    className="text-[10px] font-bold text-gold hover:text-yellow-400 uppercase tracking-widest flex items-center gap-1 hover:underline"
                  >
                    ➕ Add Custom Task
                  </button>
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={serviceSearch}
                    autoFocus
                    onChange={(e) => {
                      setServiceSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search services or type custom work & hit Enter..."
                    className="w-full bg-black/30 border border-white/10 focus:border-gold rounded-xl pl-9 pr-3 py-3 text-sm text-white outline-none transition-all placeholder:text-white/20 font-bold"
                  />
                </div>

                {/* Combobox Absolute Dropdown */}
                {isDropdownOpen && dropdownOptions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-[220px] overflow-y-auto bg-[#1b2331] border border-white/10 rounded-xl shadow-2xl z-[300] py-1">
                    {dropdownOptions.map((s, idx) => {
                      const isHighlighted = idx === activeSearchIndex;
                      const isAlreadySelected = selectedServices.some(item => item.id === s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={(e) => {
                            // Prevent input blur before selecting
                            e.preventDefault();
                          }}
                          onMouseEnter={() => setActiveSearchIndex(idx)}
                          onClick={() => {
                            if (s.isCustomVirtual) {
                              addCustomTaskWithName(serviceSearch.trim());
                              setServiceSearch("");
                              setIsDropdownOpen(false);
                            } else {
                              toggleService(s);
                            }
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between border-b border-white/5 last:border-b-0 transition-colors ${
                            isHighlighted
                              ? "bg-gold/10 text-gold font-bold"
                              : "text-white/80 hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="line-clamp-1">{s.name_en}</span>
                            {s.requires_pro && <Shield size={10} className="text-amber-400 shrink-0" />}
                          </div>
                          {isAlreadySelected && !s.isCustomVirtual && (
                            <span className="text-[9px] text-gold font-bold bg-gold/15 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check size={9} /> Selected
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Services Editor List */}
              {selectedServices.length > 0 && !selectedServices[0].isPosPlaceholder && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Selected Services ({selectedServices.length})</p>
                    <p className="text-[9px] text-white/30 font-medium">Configure items below</p>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {selectedServices.map((item) => (
                      <div key={item.id} className="border border-white/5 bg-[#141b26]/50 rounded-2xl p-3.5 space-y-3 transition-all hover:border-white/10">
                        {/* Row 1: Name and Trash Icon */}
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex-1">
                            {item.isCustom ? (
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  setSelectedServices(prev => prev.map(p => p.id === item.id ? { ...p, name: e.target.value } : p));
                                }}
                                className="w-full bg-black/40 border border-white/10 focus:border-gold rounded-lg px-2.5 py-1 text-xs text-white font-bold outline-none placeholder:text-white/20"
                                placeholder="Enter Custom Service Name..."
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0"></span>
                                <h4 className="text-xs font-bold text-white leading-tight">{item.name}</h4>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedServices(prev => prev.filter(p => p.id !== item.id))}
                            className="p-1 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Row 2: Grid of Inputs */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {/* Qty Dropdown/Input */}
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest block">Qty / Applicants</span>
                            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setSelectedServices(prev => prev.map(p => p.id === item.id ? { ...p, quantity: val } : p));
                                }}
                                className="w-full bg-transparent outline-none text-[11px] text-white font-bold text-center font-mono"
                              />
                            </div>
                          </div>

                          {/* Work Fee */}
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest block">Work Fee (OMR)</span>
                            <div className="flex items-center bg-black/40 border border-white/10 focus-within:border-gold rounded-lg px-2 py-1.5">
                              <input
                                type="number"
                                step="0.001"
                                value={item.workFee}
                                onChange={(e) => {
                                  setSelectedServices(prev => prev.map(p => p.id === item.id ? { ...p, workFee: Number(e.target.value) } : p));
                                }}
                                className="w-full bg-transparent outline-none text-[11px] text-white font-bold text-right font-mono"
                              />
                            </div>
                          </div>

                          {/* Gov Fee */}
                          <div className="space-y-1">
                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest block">Gov Fee (OMR)</span>
                            <div className={`flex items-center bg-black/40 border border-white/10 focus-within:border-gold rounded-lg px-2 py-1.5 ${item.paidByClientCard ? 'opacity-40' : ''}`}>
                              <input
                                type="number"
                                step="0.001"
                                value={item.ministryFee}
                                disabled={item.paidByClientCard}
                                onChange={(e) => {
                                  setSelectedServices(prev => prev.map(p => p.id === item.id ? { ...p, ministryFee: Number(e.target.value) } : p));
                                }}
                                className="w-full bg-transparent outline-none text-[11px] text-white font-bold text-right font-mono disabled:cursor-not-allowed"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Paid using Client Card Option */}
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <label htmlFor={`client_card_${item.id}`} className="text-[9px] font-semibold text-white/45 hover:text-white cursor-pointer select-none flex items-center gap-1">
                              <CreditCard size={10} className="text-gold" />
                              Client paid government fee directly using their card
                            </label>
                            <input
                              type="checkbox"
                              id={`client_card_${item.id}`}
                              checked={item.paidByClientCard}
                              onChange={(e) => {
                                const isChecking = e.target.checked;
                                if (isChecking) {
                                  // Validate gov fee is filled in
                                  if (!item.ministryFee || Number(item.ministryFee) <= 0) {
                                    toast.error('Please fill in the Gov Fee amount before marking it as paid by client card.');
                                    return;
                                  }
                                  // Pre-fill cardAmountPaid with the gov fee value
                                  setSelectedServices(prev => prev.map(p => p.id === item.id
                                    ? { ...p, paidByClientCard: true, cardAmountPaid: item.ministryFee }
                                    : p
                                  ));
                                } else {
                                  setSelectedServices(prev => prev.map(p => p.id === item.id
                                    ? { ...p, paidByClientCard: false, cardAmountPaid: 0 }
                                    : p
                                  ));
                                }
                              }}
                              className="rounded border-white/10 bg-black/40 text-gold focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                            />
                          </div>

                          {/* Card Amount Input — appears when checkbox is ticked */}
                          {item.paidByClientCard && (
                            <div className="flex items-center gap-2 bg-gold/5 border border-gold/20 rounded-xl px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                              <CreditCard size={12} className="text-gold shrink-0" />
                              <div className="flex-1">
                                <p className="text-[8px] font-bold text-gold/70 uppercase tracking-widest mb-1">Amount paid by client's card (OMR)</p>
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={item.cardAmountPaid || ''}
                                  onChange={(e) => {
                                    setSelectedServices(prev => prev.map(p => p.id === item.id
                                      ? { ...p, cardAmountPaid: Number(e.target.value) }
                                      : p
                                    ));
                                  }}
                                  placeholder="0.000"
                                  className="w-full bg-transparent outline-none text-sm text-white font-bold text-right font-mono placeholder:text-white/20"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedServices.length === 1 && selectedServices[0].isPosPlaceholder && (
                <>
                  {/* Task Description */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Task Description *</label>
                    <textarea
                      value={posDescription}
                      onChange={(e) => setPosDescription(e.target.value)}
                      rows={2}
                      placeholder="e.g. Translation and Xerox copying of 5 passports..."
                      className="w-full bg-black/30 border border-white/10 focus:border-gold rounded-xl px-4 py-3 text-sm text-white outline-none transition-all resize-none placeholder:text-white/20"
                    />
                  </div>

                  {/* Amount and Payment Method */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Amount (OMR) *</label>
                      <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 focus-within:border-gold rounded-xl px-3 py-2.5 transition-colors">
                        <span className="text-white/30 text-[10px] font-bold">OMR</span>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          value={posAmount}
                          onChange={(e) => setPosAmount(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm text-white font-bold text-right"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 focus:border-gold rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none cursor-pointer transition-colors"
                      >
                        <option value="cash" className="bg-[#1a2130]">Cash</option>
                        <option value="card" className="bg-[#1a2130]">Card</option>
                        <option value="bank" className="bg-[#1a2130]">Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {selectedServices.length > 0 && !selectedServices[0].isPosPlaceholder && (
                <>
                  {/* Total */}
                  <div className="bg-gold/5 border border-gold/20 rounded-2xl px-5 py-4 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Total Amount</span>
                    <span className="text-2xl font-bold text-gold font-syne">
                      {selectedServices.reduce((sum, item) => {
                        const minFee = item.paidByClientCard ? 0 : item.ministryFee;
                        return sum + (item.workFee + minFee) * item.quantity;
                      }, 0).toFixed(3)} <span className="text-sm text-white/40">OMR</span>
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest block">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Any special instructions or applicant details..."
                      className="w-full bg-black/30 border border-white/10 focus:border-gold rounded-xl px-4 py-3 text-sm text-white outline-none transition-all resize-none placeholder:text-white/20"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-bold rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !clientName.trim() || selectedServices.length === 0}
                className="flex-1 py-3 bg-gold hover:bg-yellow-400 text-black font-bold rounded-xl transition-all text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  "Submitting..."
                ) : (selectedServices.length === 1 && selectedServices[0].isPosPlaceholder) ? (
                  <>
                    <Zap size={16} /> Complete Walk-in Task
                  </>
                ) : (
                  <>
                    <Zap size={16} /> Create Job
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WalkInModal;
