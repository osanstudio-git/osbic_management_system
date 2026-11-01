import { motion } from 'framer-motion';
import { 
  Building2, Bell, Mail, Link as LinkIcon, Shield, 
  Save, Upload, Check, AlertCircle, RefreshCw, Smartphone, Globe,
  MapPin, Plus, Pencil, ToggleLeft, ToggleRight, Phone, X, Loader2,
  UserCheck, UserX, User
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { useQuery } from '@tanstack/react-query';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useAdminSettings } from '../../hooks/admin/useAdminSettings';
import { useBranch } from '../../contexts/BranchContext';
import { supabase } from '../../lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Tiptap Toolbar Component
const EditorToolbar = ({ editor }: { editor: any }) => {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/50">
      <button 
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn("p-1.5 rounded hover:bg-muted transition-colors", editor.isActive('bold') && "bg-white/20 text-foreground")}
      >
        <span className="font-bold">B</span>
      </button>
      <button 
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn("p-1.5 rounded hover:bg-muted transition-colors", editor.isActive('italic') && "bg-white/20 text-foreground")}
      >
        <span className="italic">I</span>
      </button>
      <div className="w-[1px] h-4 bg-muted mx-1 mt-2.5" />
      <button 
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn("p-1.5 rounded hover:bg-muted transition-colors", editor.isActive('bulletList') && "bg-white/20 text-foreground")}
      >
        List
      </button>
    </div>
  );
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Branch management state
  const { branches, loadingBranches, createBranch, updateBranch } = useBranch();
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', code: '', address: '', phone: '', manager_id: '' });
  const [savingBranch, setSavingBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<string | null>(null);
  const [editBranchForm, setEditBranchForm] = useState({ name: '', code: '', address: '', phone: '', manager_id: '' });

  // Fetch active employees to assign as branch managers
  const { data: employees = [], refetch: refetchEmployees } = useQuery({
    queryKey: ['admin_employees_for_branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, employee_code, branch_id, is_manager, role, is_active')
        .eq('role', 'employee')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        full_name: string;
        email: string;
        phone: string;
        employee_code: string;
        branch_id: string | null;
        is_manager: boolean;
      }>;
    }
  });
  const { settings, logo: logoPreview, updateSettings, uploadLogo, isLoading } = useAdminSettings();
  const [localSettings, setLocalSettings] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync settings to local state on load
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your email template content here...',
      }),
    ],
    content: `<p>Dear {{client_name}},</p><p>We are pleased to inform you that your service for <strong>{{service_name}}</strong> has reached a new milestone.</p><p>Best Regards,<br>OSBIC Team</p>`,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[200px] p-4 text-sm text-muted-foreground',
      },
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings.mutateAsync(localSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsSaving(true);
      try {
        await uploadLogo.mutateAsync(file);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        console.error('Logo upload failed:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'branches', label: 'Branches', icon: MapPin },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'templates', label: 'Email Templates', icon: Mail },
    { id: 'integrations', label: 'Integrations', icon: LinkIcon },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-syne font-bold text-foreground mb-1">System Settings</h1>
          <p className="text-sm text-muted-foreground">Configure platform identity, automation thresholds, and security policies.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-300",
            saveSuccess 
              ? "bg-emerald-500 text-foreground"
              : "bg-primary text-[#0A0F1E] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] active:scale-95"
          )}
        >
          {isSaving ? <RefreshCw className="animate-spin" size={18} /> : saveSuccess ? <Check size={18} /> : <Save size={18} />}
          {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Controls'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar Tabs */}
        <div className="lg:w-64 shrink-0">
          <div className="bg-card border border-border rounded-2xl p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                  activeTab === tab.id 
                    ? "bg-primary/10 text-primary shadow-inner" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <tab.icon size={18} className={cn("transition-colors", activeTab === tab.id ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground")} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card border border-border rounded-3xl p-6 sm:p-8"
          >
            
            {activeTab === 'company' && (
              <div className="space-y-8">
                <section>
                  <h3 className="text-lg font-bold text-foreground mb-4">Identity & Branding</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Company Name</label>
                        <input 
                          type="text" 
                          value={localSettings.company_name || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, company_name: e.target.value })}
                          className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-gold outline-none transition-all focus:ring-4 focus:ring-gold/5" 
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Primary Email</label>
                        <input 
                          type="email" 
                          value={localSettings.company_email || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, company_email: e.target.value })}
                          className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-gold outline-none" 
                        />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-foreground mb-4">Official Logo</h3>
                  <div className="flex items-center gap-6 p-6 border-2 border-dashed border-border rounded-2xl bg-white/[0.02]">
                    <div className="w-24 h-24 rounded-2xl bg-primary/10 border border-gold/20 flex items-center justify-center font-syne font-bold text-3xl text-primary overflow-hidden">
                       {logoPreview ? (
                         <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                       ) : (
                         "O"
                       )}
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">Preferred format: SVG or transparent PNG (400x400px)</p>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleLogoChange} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors"
                      >
                         <Upload size={14} /> Replace Logo
                      </button>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-bold text-foreground mb-4">Contact Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">WhatsApp Business</label>
                        <input 
                          type="text" 
                          value={localSettings.company_phone || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, company_phone: e.target.value })}
                          className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-gold outline-none" 
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                       <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">VAT Number</label>
                       <input 
                         type="text" 
                         defaultValue="OM123456789"
                         className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-gold outline-none" 
                       />
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-2">
                       <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Office Address</label>
                        <textarea 
                          rows={2}
                          value={localSettings.company_address || ''}
                          onChange={(e) => setLocalSettings({ ...localSettings, company_address: e.target.value })}
                          className="bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-gold outline-none resize-none" 
                        />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-10">
                <section>
                  <h3 className="text-lg font-bold text-foreground mb-6">Channel Delivery</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Client Email Alerts', desc: 'Send automated updates to clients via email.', channel: 'mail' },
                      { label: 'WhatsApp Status Updates', desc: 'Notify clients via WhatsApp when steps are completed.', channel: 'whatsapp' },
                      { label: 'Employee Assignments', desc: 'Notify employees when a new job is assigned to them.', channel: 'system' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl border border-border">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground/60">{item.desc}</p>
                        </div>
                        <div className="w-12 h-6 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center px-1 cursor-pointer">
                          <div className="w-4 h-4 bg-emerald-500 rounded-full ml-auto" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                   <h3 className="text-lg font-bold text-foreground mb-6">Automation Offsets</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">First Expiry Warning</label>
                            <div className="flex gap-2">
                               <input type="number" defaultValue={180} className="w-20 bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground outline-none" />
                               <span className="flex items-center text-sm text-muted-foreground">Days before</span>
                            </div>
                         </div>
                         <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Final Expiry Pulse</label>
                            <div className="flex gap-2">
                               <input type="number" defaultValue={30} className="w-20 bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground outline-none" />
                               <span className="flex items-center text-sm text-muted-foreground">Days before</span>
                            </div>
                         </div>
                      </div>
                      <div className="space-y-4">
                         <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Advance Payment Trigger</label>
                            <div className="flex gap-2">
                               <input type="number" defaultValue={50} className="w-20 bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground outline-none" />
                               <span className="flex items-center text-sm text-muted-foreground">% total fee</span>
                            </div>
                         </div>
                         <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Final Fee Buffer</label>
                            <div className="flex gap-2">
                               <input type="number" defaultValue={2} className="w-20 bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground outline-none" />
                               <span className="flex items-center text-sm text-muted-foreground">Steps from end</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </section>
              </div>
            )}

            {activeTab === 'templates' && (
              <div className="space-y-8">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <div className="sm:w-1/3 bg-background rounded-2xl border border-border p-2 space-y-1 self-start">
                       {['Welcome Email', 'Step Update', 'Payment Link', 'Expiry Alert'].map(t => (
                         <button key={t} className={cn("w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all", t === 'Step Update' ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground")}>
                           {t}
                         </button>
                       ))}
                    </div>
                    <div className="flex-1 border border-border rounded-2xl overflow-hidden bg-background">
                       <EditorToolbar editor={editor} />
                       <EditorContent editor={editor} />
                    </div>
                 </div>
                 <div className="bg-muted/50 p-4 rounded-2xl border border-border space-y-3">
                    <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                       <AlertCircle size={14} /> Available Variables
                    </p>
                    <div className="flex flex-wrap gap-2">
                       {['{{client_name}}', '{{job_code}}', '{{service_name}}', '{{due_amount}}', '{{expiry_date}}'].map(v => (
                         <code key={v} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-lg border border-gold/20 leading-none">{v}</code>
                       ))}
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="space-y-6">
                {[
                  { name: 'Twilio (WhatsApp)', status: 'Connected', icon: Smartphone, color: 'emerald' },
                  { name: 'Resend (Email)', status: 'Connected', icon: Mail, color: 'emerald' },
                  { name: 'Adobe Sign', status: 'Not Configured', icon: Globe, color: 'slate' }
                ].map((int, i) => (
                  <div key={i} className="flex items-center gap-6 p-6 build bg-background border border-border rounded-2xl">
                     <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border", int.color === 'emerald' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-muted/50 border-border text-muted-foreground/60")}>
                        <int.icon size={20} />
                     </div>
                     <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{int.name}</p>
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter border", int.color === 'emerald' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted/50 text-muted-foreground/60 border-border")}>
                             {int.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-1">API Key: ••••••••••••••••••••••••••••F4B2</p>
                     </div>
                     <button className="px-4 py-2 bg-muted/50 hover:bg-muted text-foreground rounded-lg text-xs font-bold transition-colors">
                        Configure
                     </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'branches' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      <MapPin size={18} className="text-primary" /> Branch Management
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage company branches. Employees and jobs are assigned to branches.</p>
                  </div>
                  <button
                    onClick={() => { setShowAddBranch(true); setBranchForm({ name: '', code: '', address: '', phone: '', manager_id: '' }); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0A0F1E] font-bold text-xs rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all"
                  >
                    <Plus size={14} /> Add Branch
                  </button>
                </div>

                {/* Add Branch Form */}
                {showAddBranch && (
                  <div className="p-5 bg-card border border-primary/30 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <MapPin size={16} className="text-primary" />
                        <span>New Branch Setup</span>
                      </h4>
                      <button onClick={() => setShowAddBranch(false)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Branch Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Sohar Branch"
                          value={branchForm.name}
                          onChange={e => setBranchForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Branch Code * (2-4 letters)</label>
                        <input
                          type="text"
                          placeholder="e.g. SHR"
                          maxLength={4}
                          value={branchForm.code}
                          onChange={e => setBranchForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground font-mono uppercase"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Location Details / Address</label>
                        <input
                          type="text"
                          placeholder="e.g. Building 12, Sohar Industrial Area, Oman"
                          value={branchForm.address}
                          onChange={e => setBranchForm(p => ({ ...p, address: e.target.value }))}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Branch Phone</label>
                        <input
                          type="text"
                          placeholder="e.g. +968 2345 6789"
                          value={branchForm.phone}
                          onChange={e => setBranchForm(p => ({ ...p, phone: e.target.value }))}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                          Appoint Branch Manager
                        </label>
                        <select
                          value={branchForm.manager_id}
                          onChange={e => setBranchForm(p => ({ ...p, manager_id: e.target.value }))}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary text-foreground cursor-pointer"
                        >
                          <option value="">— No Branch Manager (Unassigned) —</option>
                          {employees.map(emp => {
                            const curBranch = branches.find(b => b.id === emp.branch_id);
                            return (
                              <option key={emp.id} value={emp.id}>
                                {emp.full_name} ({emp.employee_code || 'EMP'}) {emp.is_manager ? `• Currently Manager (${curBranch?.name || 'Other'})` : curBranch ? `• Assigned to ${curBranch.name}` : ''}
                              </option>
                            );
                          })}
                        </select>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          Appointing a manager grants them supervisory control over this branch&apos;s cases, leads, and operational approvals.
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={savingBranch || !branchForm.name || !branchForm.code}
                      onClick={async () => {
                        if (!branchForm.name || !branchForm.code) return;
                        setSavingBranch(true);
                        try {
                          const newBranch = await createBranch({
                            name: branchForm.name,
                            code: branchForm.code,
                            address: branchForm.address || null,
                            phone: branchForm.phone || null,
                            is_active: true
                          } as any);

                          if (branchForm.manager_id && newBranch?.id) {
                            await supabase
                              .from('profiles')
                              .update({ branch_id: newBranch.id, is_manager: true })
                              .eq('id', branchForm.manager_id);
                            await refetchEmployees();
                          }

                          setShowAddBranch(false);
                          setBranchForm({ name: '', code: '', address: '', phone: '', manager_id: '' });
                        } catch (err: any) { alert(err.message); }
                        finally { setSavingBranch(false); }
                      }}
                      className="px-6 py-2 bg-primary text-[#0A0F1E] font-bold text-xs rounded-xl disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingBranch ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {savingBranch ? 'Saving...' : 'Create Branch'}
                    </button>
                  </div>
                )}

                {/* Branches List */}
                {loadingBranches ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
                ) : branches.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No branches created yet.</div>
                ) : (
                  <div className="space-y-3">
                    {branches.map(branch => {
                      const branchManager = employees.find(e => e.branch_id === branch.id && e.is_manager);

                      return (
                        <div key={branch.id} className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all ${
                          branch.is_active ? 'bg-card border-border' : 'bg-muted/20 border-border/40 opacity-60'
                        }`}>
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-primary font-mono">{branch.code}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              {editingBranch === branch.id ? (
                                <div className="space-y-3">
                                  <div className="flex gap-2">
                                    <input
                                      value={editBranchForm.name}
                                      onChange={e => setEditBranchForm(p => ({ ...p, name: e.target.value }))}
                                      className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground outline-none focus:border-primary flex-1"
                                      placeholder="Branch name"
                                    />
                                    <input
                                      value={editBranchForm.code}
                                      onChange={e => setEditBranchForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                      maxLength={4}
                                      className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground outline-none focus:border-primary font-mono w-16"
                                      placeholder="Code"
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input
                                      value={editBranchForm.address}
                                      onChange={e => setEditBranchForm(p => ({ ...p, address: e.target.value }))}
                                      className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                                      placeholder="Address / Location Details"
                                    />
                                    <input
                                      value={editBranchForm.phone}
                                      onChange={e => setEditBranchForm(p => ({ ...p, phone: e.target.value }))}
                                      className="w-full bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                                      placeholder="Phone Number"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">
                                      Branch Manager
                                    </label>
                                    <select
                                      value={editBranchForm.manager_id}
                                      onChange={e => setEditBranchForm(p => ({ ...p, manager_id: e.target.value }))}
                                      className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                                    >
                                      <option value="">— No Branch Manager (Unassigned) —</option>
                                      {employees.map(emp => {
                                        const curBranch = branches.find(b => b.id === emp.branch_id);
                                        return (
                                          <option key={emp.id} value={emp.id}>
                                            {emp.full_name} ({emp.employee_code || 'EMP'}) {emp.is_manager ? `• Manager (${curBranch?.name || 'Other'})` : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                    {branch.name}
                                    {branch.code === 'GHL' && <span className="text-[9px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Main HQ</span>}
                                    {!branch.is_active && <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Inactive</span>}
                                  </p>
                                  {branch.address && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                      <MapPin size={12} className="text-primary/70 shrink-0" />
                                      <span>{branch.address}</span>
                                    </p>
                                  )}
                                  {branch.phone && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                      <Phone size={12} className="text-primary/70 shrink-0" />
                                      <span>{branch.phone}</span>
                                    </p>
                                  )}

                                  {/* Appointed Branch Manager Badge */}
                                  <div className="mt-3 flex items-center gap-2">
                                    {branchManager ? (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs">
                                        <UserCheck size={13} className="shrink-0" />
                                        <span className="font-bold">Manager: {branchManager.full_name}</span>
                                        <span className="text-[10px] opacity-75 font-mono">({branchManager.employee_code || 'MGR'})</span>
                                        {branchManager.phone && <span className="text-[10px] opacity-60 ml-1">• {branchManager.phone}</span>}
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-muted/40 border border-border text-muted-foreground text-[11px] italic">
                                        <UserX size={12} className="shrink-0" />
                                        <span>No Branch Manager Appointed</span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                            {editingBranch === branch.id ? (
                              <>
                                <button
                                  onClick={async () => {
                                    await updateBranch(branch.id, {
                                      name: editBranchForm.name,
                                      code: editBranchForm.code,
                                      address: editBranchForm.address,
                                      phone: editBranchForm.phone
                                    });

                                    const prevManager = employees.find(e => e.branch_id === branch.id && e.is_manager);
                                    if (editBranchForm.manager_id !== prevManager?.id) {
                                      if (prevManager) {
                                        await supabase.from('profiles').update({ is_manager: false }).eq('id', prevManager.id);
                                      }
                                      if (editBranchForm.manager_id) {
                                        await supabase.from('profiles').update({ branch_id: branch.id, is_manager: true }).eq('id', editBranchForm.manager_id);
                                      }
                                      await refetchEmployees();
                                    }
                                    setEditingBranch(null);
                                  }}
                                  className="px-3 py-1.5 bg-primary text-[#0A0F1E] font-bold text-xs rounded-lg"
                                >Save</button>
                                <button onClick={() => setEditingBranch(null)} className="px-3 py-1.5 bg-muted text-foreground text-xs rounded-lg">Cancel</button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    const currentMgr = employees.find(e => e.branch_id === branch.id && e.is_manager);
                                    setEditingBranch(branch.id);
                                    setEditBranchForm({
                                      name: branch.name,
                                      code: branch.code,
                                      address: branch.address || '',
                                      phone: branch.phone || '',
                                      manager_id: currentMgr?.id || ''
                                    });
                                  }}
                                  className="p-2 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                                  title="Edit branch"
                                ><Pencil size={14} /></button>
                                <button
                                  onClick={() => updateBranch(branch.id, { is_active: !branch.is_active })}
                                  className={`p-2 rounded-lg transition-colors ${
                                    branch.is_active ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                  }`}
                                  title={branch.is_active ? 'Deactivate branch' : 'Activate branch'}
                                >
                                  {branch.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-8">
                 <section className="p-6 bg-background border border-border rounded-3xl">
                    <h3 className="text-base font-bold text-foreground mb-6">User Access Policies</h3>
                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground">Require 2FA for Admin</p>
                            <p className="text-xs text-muted-foreground/60">All administrative credentials must utilize multi-factor authentication.</p>
                         </div>
                         <div className="w-12 h-6 bg-muted/50 border border-border rounded-full flex items-center px-1 opacity-50">
                           <div className="w-4 h-4 bg-white/20 rounded-full" />
                         </div>
                       </div>
                       <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <p className="text-sm font-bold text-foreground">Session Timeout</p>
                            <p className="text-xs text-muted-foreground/60">Auto-logout user after 1 hour of inactivity.</p>
                         </div>
                         <div className="w-12 h-6 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center px-1">
                           <div className="w-4 h-4 bg-emerald-500 rounded-full ml-auto" />
                         </div>
                       </div>
                    </div>
                 </section>

                 <section className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl">
                    <h3 className="text-base font-bold text-red-400 mb-2">Danger Zone</h3>
                    <p className="text-xs text-red-400/60 mb-6">Irreversible administrative actions affecting the entire system state.</p>
                    <div className="space-y-4">
                       <button className="w-full flex items-center justify-between px-6 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all font-bold text-sm">
                          Delete All Test Data
                          <AlertCircle size={18} />
                       </button>
                       <button className="w-full flex items-center justify-between px-6 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl transition-all font-bold text-sm">
                          Factory Reset Configuration
                          <RefreshCw size={18} />
                       </button>
                    </div>
                 </section>
              </div>
            )}

          </motion.div>
        </div>

      </div>

    </div>
  );
};

export default Settings;
