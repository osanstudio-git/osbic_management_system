import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, Mail, 
  Phone, Shield, Loader2, 
  Copy, Check, UserPlus,
  Eye, EyeOff, Key,
  ChevronRight, Globe, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCreateClient, useUpdateClient } from '../../../hooks/admin/useAdminClients';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  clientToEdit?: any;
  onClientCreated?: (client: any) => void;
}

const CreateClientSlideOver = ({ isOpen, onClose, clientToEdit, onClientCreated }: Props) => {
  const [formData, setFormData] = useState({
    full_name: clientToEdit?.full_name || '',
    email: clientToEdit?.email || '',
    phone: clientToEdit?.phone || '',
    countryCode: '+968',
    customCountryCode: '',
    whatsapp: clientToEdit?.whatsapp || '',
    nationality: clientToEdit?.nationality || 'Oman',
    password: '',
  });

  useEffect(() => {
    if (clientToEdit) {
      let cCode = '+968';
      let pNum = clientToEdit.phone || '';
      if (pNum.startsWith('+')) {
        const parts = pNum.split(' ');
        if (parts.length > 1) {
          cCode = parts[0];
          pNum = parts.slice(1).join(' ');
        }
      }
      setFormData(prev => ({
        ...prev,
        full_name: clientToEdit.full_name || '',
        email: clientToEdit.email || '',
        nationality: clientToEdit.nationality || 'Oman',
        phone: pNum,
        whatsapp: clientToEdit.whatsapp || '',
        countryCode: ['+968', '+971', '+966', '+974', '+973', '+965', '+91', '+92', '+20'].includes(cCode) ? cCode : 'Other',
        customCountryCode: !['+968', '+971', '+966', '+974', '+973', '+965', '+91', '+92', '+20'].includes(cCode) ? cCode : '',
      }));
      setWhatsappSameAsPhone(Boolean(clientToEdit.phone && clientToEdit.whatsapp === clientToEdit.phone));
    }
  }, [clientToEdit]);
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(clientToEdit ? clientToEdit.whatsapp === clientToEdit.phone : false);
  const isEditing = !!(clientToEdit && clientToEdit.id);
  const { profile } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [createdClient, setCreatedClient] = useState<any>(null);

  const applyDomain = (domain: string) => {
    setFormData(prev => {
      let email = (prev.email || '').trim();
      if (domain.startsWith('@')) {
        if (email.includes('@')) {
          const username = email.split('@')[0];
          return { ...prev, email: `${username}${domain}` };
        } else {
          return { ...prev, email: `${email}${domain}` };
        }
      } else if (domain.startsWith('.')) {
        if (!email.endsWith(domain)) {
          return { ...prev, email: `${email}${domain}` };
        }
      }
      return prev;
    });
  };

  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pass }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalCountryCode = formData.countryCode === 'Other' ? (formData.customCountryCode || '+') : formData.countryCode;
      const formattedPhone = formData.phone ? `${finalCountryCode} ${formData.phone}` : undefined;

      const payload = {
        ...formData,
        phone: formattedPhone,
        whatsapp: whatsappSameAsPhone ? formattedPhone : formData.whatsapp,
      };

      const { countryCode, customCountryCode, ...databasePayload } = payload;
      
      if (isEditing) {
        // Exclude password from update payload
        const { password, ...updatePayload } = databasePayload;
        await updateClientMutation.mutateAsync({ id: clientToEdit.id, updates: updatePayload });
        toast.success('Client updated successfully!');
        onClose();
      } else {
        const createPayload = { ...databasePayload, created_by: profile?.id, branch_id: profile?.branch_id };
        const data = await createClientMutation.mutateAsync(createPayload);
        setCreatedClient(data);
        if (data?._isExisting) {
          toast.success(`Existing client "${data.full_name}" linked successfully!`);
        } else {
          toast.success('Client registered successfully!');
        }
        if (onClientCreated) {
          onClientCreated(data);
        }
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${isEditing ? 'update' : 'create'} client`);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleClose = () => {
    setFormData({ full_name: '', email: '', phone: '', countryCode: '+968', customCountryCode: '', whatsapp: '', nationality: 'Oman', password: '' });
    setWhatsappSameAsPhone(false);
    setCreatedClient(null);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border shadow-2xl z-[101] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-card/80 backdrop-blur-md border-b border-border p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-syne font-bold text-foreground mb-1">{isEditing ? 'Edit Client Profile' : 'Register New Client'}</h2>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{isEditing ? 'UPDATE DETAILS' : 'ONBOARDING & CREDENTIALS'}</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-8">
              {!createdClient ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Full Name */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        required
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="e.g. Abdullah Ahmed"
                        className="w-full bg-background border border-border rounded-xl py-3 pl-12 pr-4 text-sm text-foreground focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Username / Email</label>
                      {isEditing && (
                        <span className="text-[10px] text-primary font-medium">Editable</span>
                      )}
                    </div>
                    <div className="relative">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="client@example.com"
                        className="w-full bg-background border border-border rounded-xl py-3 pl-12 pr-4 text-sm text-foreground focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                      />
                    </div>
                    {/* Quick Domain Helpers */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-muted-foreground/70 font-medium">Quick:</span>
                      {['@gmail.com', '@outlook.com', '@hotmail.com', '@icloud.com', '.com', '.om'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => applyDomain(chip)}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/20 hover:text-primary text-muted-foreground border border-border/50 transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center ml-1 h-[16px]">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Phone Number</label>
                      </div>
                      <div className="flex gap-2">
                        <select 
                          value={formData.countryCode} 
                          onChange={(e) => setFormData(prev => ({ ...prev, countryCode: e.target.value }))}
                          className="w-20 bg-background/50 border border-border rounded-xl px-1 py-3 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors cursor-pointer text-center appearance-none"
                        >
                          <option value="+968" className="bg-card text-foreground">+968</option>
                          <option value="+971" className="bg-card text-foreground">+971</option>
                          <option value="+966" className="bg-card text-foreground">+966</option>
                          <option value="+974" className="bg-card text-foreground">+974</option>
                          <option value="+973" className="bg-card text-foreground">+973</option>
                          <option value="+965" className="bg-card text-foreground">+965</option>
                          <option value="+91" className="bg-card text-foreground">+91</option>
                          <option value="+92" className="bg-card text-foreground">+92</option>
                          <option value="+20" className="bg-card text-foreground">+20</option>
                          <option value="Other" className="bg-card text-foreground">Other</option>
                        </select>
                        {formData.countryCode === 'Other' && (
                          <input
                            type="text"
                            value={formData.customCountryCode}
                            onChange={(e) => setFormData(prev => ({ ...prev, customCountryCode: e.target.value }))}
                            className="w-12 bg-background/50 border border-border rounded-xl px-2 py-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors text-center"
                            placeholder="+"
                          />
                        )}
                        <input
                          type="tel"
                          autoComplete="off"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Phone number"
                          className="flex-1 bg-background/50 border border-border rounded-xl py-3 px-4 text-sm text-foreground focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50 w-full min-w-0"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1 h-[16px]">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp</label>
                        <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setWhatsappSameAsPhone(!whatsappSameAsPhone)}>
                          <input type="checkbox" checked={whatsappSameAsPhone} readOnly className="accent-primary w-3 h-3 m-0" />
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground leading-none">Same</span>
                        </div>
                      </div>
                      <div className="relative group">
                        <MessageCircle size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                        <input
                          type="tel"
                          autoComplete="off"
                          disabled={whatsappSameAsPhone}
                          value={whatsappSameAsPhone ? formData.phone : formData.whatsapp}
                          onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                          placeholder="+968 9xxx xxxx"
                          className="w-full bg-background/50 border border-border rounded-xl py-3 pl-12 pr-4 text-sm text-foreground focus:border-emerald-500/50 outline-none transition-all placeholder:text-muted-foreground/50 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">Nationality</label>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="relative group">
                        <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <select
                          value={formData.nationality === 'Other' || !['Oman', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait', 'India', 'Pakistan', 'Egypt', 'Iran'].includes(formData.nationality) ? 'Other' : formData.nationality}
                          onChange={(e) => {
                            if (e.target.value !== 'Other') {
                              setFormData(prev => ({ ...prev, nationality: e.target.value }));
                            } else {
                              setFormData(prev => ({ ...prev, nationality: '' })); // clear for custom input
                            }
                          }}
                          className="w-full bg-background/50 border border-border rounded-xl py-3 pl-12 pr-4 text-sm text-foreground focus:border-primary/50 outline-none transition-all appearance-none"
                        >
                          {['Oman', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait', 'India', 'Pakistan', 'Egypt', 'Iran', 'Other'].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      
                      {(!['Oman', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Kuwait', 'India', 'Pakistan', 'Egypt', 'Iran'].includes(formData.nationality)) && (
                        <div className="relative group">
                          <input
                            type="text"
                            autoComplete="off"
                            value={formData.nationality}
                            onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                            placeholder="Please specify nationality"
                            className="w-full bg-background/50 border border-border rounded-xl py-3 px-4 text-sm text-foreground focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Password - Only for new clients */}
                  {!isEditing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Credentials</label>
                        <button
                          type="button"
                          onClick={generatePassword}
                          className="text-[10px] font-bold text-primary hover:text-foreground uppercase tracking-widest transition-colors"
                        >
                          Auto-Generate
                        </button>
                      </div>
                      <div className="relative group">
                        <Key size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                          required
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Secure Portal Password"
                          className="w-full bg-background/50 border border-border rounded-xl py-3.5 pl-12 pr-12 text-sm text-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={createClientMutation.isPending || updateClientMutation.isPending}
                    className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-primary/10 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
                  >
                    {(createClientMutation.isPending || updateClientMutation.isPending) ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>{clientToEdit ? 'Save Changes' : 'Register Client Portal'} <ChevronRight size={16} /></>
                    )}
                  </button>
                </form>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-[32px] p-8 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                    <Check size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Registration Success</h3>
                  <p className="text-sm text-muted-foreground mb-8">One-time account credentials for {createdClient.full_name}</p>
 
                  <div className="space-y-4">
                    <div className="bg-background border border-border rounded-2xl p-6 relative group overflow-hidden">
                       <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">Secure Password</p>
                       <p className="text-xl font-mono text-foreground tracking-widest">{createdClient.password}</p>
                       <button
                         onClick={() => copyToClipboard(createdClient.password)}
                         className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-gold/10 text-gold opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                       >
                         <Copy size={16} />
                       </button>
                    </div>
 
                    <div className="bg-background border border-border rounded-2xl p-6 relative group overflow-hidden">
                       <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">Portal Access</p>
                       <p className="text-sm text-foreground font-mono">{createdClient.email}</p>
                       <button
                         onClick={() => copyToClipboard(createdClient.email)}
                         className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-gold/10 text-gold opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                       >
                         <Copy size={16} />
                       </button>
                    </div>
                  </div>
 
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-400 mt-6 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                    <Mail size={16} /> Credentials securely emailed to {createdClient.email}
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full mt-8 py-5 bg-muted text-foreground font-bold rounded-2xl hover:bg-muted/80 transition-all"
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CreateClientSlideOver;
