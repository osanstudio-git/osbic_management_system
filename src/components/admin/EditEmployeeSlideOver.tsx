import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Camera, Loader2 } from 'lucide-react';
import { useUpdateEmployee } from '../../hooks/admin/useAdminEmployees';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useBranch } from '../../contexts/BranchContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
}

const EditEmployeeSlideOver = ({ isOpen, onClose, employee }: Props) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: 'operations' as 'sales' | 'operations' | 'accounts' | 'pro' | 'marketing',
    notes: '',
    is_manager: false,
    can_do_sales: false,
    can_do_marketing: false,
    can_do_ops: false,
    can_do_accounts: false,
    is_pro: false,
    avatarUrl: '',
    branch_id: '' as string,
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { branches } = useBranch();
  const { mutate: updateEmployee, isPending } = useUpdateEmployee();

  useEffect(() => {
    if (employee) {
      setFormData({
        fullName: employee.full_name || '',
        email: employee.email || '',
        phone: employee.phone ? employee.phone.replace('+968 ', '') : '',
        department: employee.department || 'operations',
        notes: employee.notes || '',
        is_manager: employee.is_manager || false,
        can_do_sales: employee.can_do_sales || false,
        can_do_marketing: (employee as any).can_do_marketing || false,
        can_do_ops: employee.can_do_ops || false,
        can_do_accounts: employee.can_do_accounts || false,
        is_pro: employee.is_pro || false,
        avatarUrl: employee.avatar_url || '',
        branch_id: employee.branch_id || '',
      });
    }
  }, [employee]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee?.id) return;

    // Validate size and format
    if (file.size > 10 * 1024 * 1024) return toast.error('Photo must be under 10MB');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error('Only JPG, PNG or WebP allowed');

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employee.id}-${Date.now()}.${fileExt}`;
      const filePath = `user-avatars/${fileName}`;

      // 1. Upload to storage bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update state
      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
      toast.success('Photo uploaded! Click Save to apply changes.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.fullName || !formData.email) {
      toast.error('Name and Email are required');
      return;
    }

    updateEmployee({
      id: employee.id,
      updates: {
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone ? `+968 ${formData.phone}` : null,
        department: formData.department,
        is_manager: formData.is_manager,
        can_do_sales: formData.can_do_sales,
        can_do_marketing: formData.can_do_marketing,
        can_do_ops: formData.can_do_ops,
        can_do_accounts: formData.can_do_accounts,
        is_pro: formData.is_pro,
        avatar_url: formData.avatarUrl || null,
        branch_id: formData.branch_id || null,
      } as any
    }, {
      onSuccess: () => {
        toast.success('Profile updated successfully!');
        onClose();
      },
      onError: (err: any) => {
        toast.error(err.message || 'Update failed');
      }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-syne font-bold text-foreground">Edit Profile</h2>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-muted-foreground transition-colors"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="space-y-4">
                  {/* Profile Image Section */}
                  <div className="flex flex-col items-center gap-3 pb-4 border-b border-border/40">
                    <label className="block text-sm font-medium text-muted-foreground self-start">Profile Photo</label>
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-2xl bg-primary/5 border border-border/80 flex items-center justify-center text-primary text-3xl font-syne font-bold overflow-hidden shadow-inner">
                        {uploadingAvatar ? (
                          <Loader2 className="animate-spin" size={24} />
                        ) : formData.avatarUrl ? (
                          <img src={formData.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                        ) : (
                          formData.fullName?.[0]?.toUpperCase() || 'E'
                        )}
                      </div>
                      <label className="absolute -bottom-2 -right-2 p-2 bg-foreground border border-border rounded-xl text-background hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer">
                        <Camera size={14} />
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          disabled={uploadingAvatar}
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Department *</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value as any })}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors cursor-pointer"
                    >
                      <option value="operations" className="bg-[#0A0F1E]">Operations</option>
                      <option value="sales" className="bg-[#0A0F1E]">Sales</option>
                      <option value="marketing" className="bg-[#0A0F1E]">Marketing</option>
                      <option value="accounts" className="bg-[#0A0F1E]">Accounts</option>
                      <option value="pro" className="bg-[#0A0F1E]">PRO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Branch *</label>
                    <select
                      value={formData.branch_id}
                      onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                      className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors cursor-pointer"
                    >
                      <option value="" className="bg-[#0A0F1E]">— Select Branch —</option>
                      {branches.filter(b => b.is_active).map(b => (
                        <option key={b.id} value={b.id} className="bg-[#0A0F1E]">{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Phone Number</label>
                    <div className="flex gap-2">
                      <div className="w-24 bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground flex items-center justify-center pointer-events-none">+968</div>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="flex-1 bg-white/5 border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-gold transition-colors"
                        placeholder="9123 4567"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-border">
                    <h4 className="text-sm font-bold text-foreground">Permissions & Roles</h4>
                    
                    {/* Is Manager Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">Is Manager</p>
                        <p className="text-[10px] text-muted-foreground/60">Grants full manager pipeline and data access</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_manager: !formData.is_manager })}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${formData.is_manager ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`bg-card w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${formData.is_manager ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>

                    {/* Can do Sales Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">Can do Sales</p>
                        <p className="text-[10px] text-muted-foreground/60">Enables CRM access, leads, and quotations</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, can_do_sales: !formData.can_do_sales })}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${formData.can_do_sales ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`bg-card w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${formData.can_do_sales ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>

                    {/* Can do Marketing Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">Can do Marketing</p>
                        <p className="text-[10px] text-muted-foreground/60">Enables Marketing & Acquisition Hub, campaign ROI, and ad attribution</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, can_do_marketing: !formData.can_do_marketing })}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${formData.can_do_marketing ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`bg-card w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${formData.can_do_marketing ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>

                    {/* Can do Operations Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">Can do Operations</p>
                        <p className="text-[10px] text-muted-foreground/60">Enables job steps, tasks, and document management</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, can_do_ops: !formData.can_do_ops })}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${formData.can_do_ops ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`bg-card w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${formData.can_do_ops ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>

                    {/* Can do Accounts Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">Can do Accounts</p>
                        <p className="text-[10px] text-muted-foreground/60">Enables accounts workflow and verification</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, can_do_accounts: !formData.can_do_accounts })}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${formData.can_do_accounts ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`bg-card w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${formData.can_do_accounts ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>

                    {/* Is PRO Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">Is PRO</p>
                        <p className="text-[10px] text-muted-foreground/60">Enables PRO Work Queue access and agent assignments</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, is_pro: !formData.is_pro })}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${formData.is_pro ? 'bg-primary' : 'bg-white/10'}`}
                      >
                        <div className={`bg-card w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${formData.is_pro ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  </div>
               </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3">
              <button 
                onClick={onClose} 
                className="px-6 py-3 rounded-xl border border-border text-foreground font-bold hover:bg-white/5 transition-colors"
                disabled={isPending}
              >Cancel</button>
              <button 
                onClick={handleSubmit} 
                className="flex-1 bg-primary text-[#0A0F1E] font-bold rounded-xl py-3 hover:bg-primary/90 transition-colors shadow-lg shadow-gold/20"
                disabled={isPending}
              >{isPending ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EditEmployeeSlideOver;
