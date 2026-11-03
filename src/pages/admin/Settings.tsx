import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Building2, Bell, Mail, Link as LinkIcon, Shield, 
  Save, Upload, Check, AlertCircle, RefreshCw, Smartphone, Globe,
  MapPin, Phone
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useAdminSettings } from '../../hooks/admin/useAdminSettings';
import toast from 'react-hot-toast';

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

                {/* Branches Quick Link Card */}
                <section className="p-5 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Multi-Branch Operations</h4>
                      <p className="text-xs text-muted-foreground">Manage branch locations, appoint branch managers, and oversee staff allocations from the dedicated Branches hub.</p>
                    </div>
                  </div>
                  <Link
                    to="/admin/branches"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-[#0A0F1E] font-bold text-xs rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all shrink-0"
                  >
                    <span>Open Branches Hub</span>
                    <span>→</span>
                  </Link>
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
