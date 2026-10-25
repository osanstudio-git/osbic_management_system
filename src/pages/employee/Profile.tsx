import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Key, CheckCircle2, AlertCircle, Eye, EyeOff,
  UserCircle, Mail, Smartphone, Fingerprint, Camera, Loader2,
  Copy, Check, ShieldCheck, BadgeCheck, Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const EmployeeProfile: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [passwordsMatch, setPasswordsMatch] = useState(true);

  useEffect(() => {
    if (passwordData.newPassword && passwordData.confirmPassword) {
      setPasswordsMatch(passwordData.newPassword === passwordData.confirmPassword);
    } else {
      setPasswordsMatch(true);
    }
  }, [passwordData.newPassword, passwordData.confirmPassword]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(isRtl ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error(isRtl ? 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: passwordData.newPassword 
      });

      if (error) throw error;

      toast.success(isRtl ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || (isRtl ? 'فشل تحديث كلمة المرور' : 'Failed to update password'));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate size and format
    if (file.size > 10 * 1024 * 1024) {
      return toast.error(isRtl ? 'يجب أن تكون الصورة أقل من 10 ميجابايت' : 'Photo must be under 10MB');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return toast.error(isRtl ? 'يسمح فقط بصيغ JPG أو PNG أو WebP' : 'Only JPG, PNG or WebP allowed');
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `user-avatars/${fileName}`;

      // 1. Upload file to avatars bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Obtain Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update profiles table
      const { error: updateError } = await (supabase.from('profiles') as any)
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      if (refreshProfile) await refreshProfile();
      toast.success(isRtl ? 'تم تحديث صورة الملف الشخصي بنجاح' : 'Profile photo updated successfully');
    } catch (err: any) {
      toast.error(err.message || (isRtl ? 'فشل مزامنة الصورة' : 'Failed to sync photo'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCopyId = () => {
    if (!profile?.id) return;
    navigator.clipboard.writeText(profile.id);
    setCopiedId(true);
    toast.success(isRtl ? 'تم نسخ رمز النظام' : 'System ID copied to clipboard');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const isSalesHead = (profile as any)?.is_sales_head === true;
  const canAssignLeads = (profile as any)?.can_assign_leads === true;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto space-y-6 pb-12 p-4 sm:p-6 lg:p-8" 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* ─── Hero Profile Header Card ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border p-6 sm:p-8 shadow-sm">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Camera Overlay */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-3xl overflow-hidden shadow-xl ring-4 ring-card transition-transform group-hover:scale-[1.02]">
              {uploadingAvatar ? (
                <Loader2 className="animate-spin text-primary" size={28} />
              ) : profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                profile?.full_name?.[0]?.toUpperCase() || 'U'
              )}
            </div>

            <label 
              className={`absolute -bottom-2 ${isRtl ? '-left-2' : '-right-2'} p-2.5 bg-foreground text-background border border-border rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg cursor-pointer flex items-center justify-center`}
              title={isRtl ? 'تغيير الصورة الشخصية' : 'Change profile photo'}
            >
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

          {/* User Headline & Badges */}
          <div className="flex-1 text-center sm:text-start space-y-2.5">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-syne font-bold text-foreground tracking-tight">
                {profile?.full_name || 'Staff Member'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {profile?.email}
              </p>
            </div>

            {/* Badges strip */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              {/* Active Status Pill */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isRtl ? 'نشط' : 'Active Account'}
              </span>

              {/* Role Badge */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/25">
                <BadgeCheck size={13} />
                {profile?.role === 'admin' 
                  ? (isRtl ? 'مسؤول' : 'Admin') 
                  : profile?.role === 'employee' 
                    ? (isRtl ? 'موظف' : 'Employee') 
                    : (profile?.role || 'Staff')}
              </span>

              {/* Special Permissions Badges */}
              {isSalesHead && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  👑 {isRtl ? 'رئيس المبيعات' : 'Sales Head'}
                </span>
              )}
              {canAssignLeads && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  🎯 {isRtl ? 'منسق العملاء' : 'Lead Coordinator'}
                </span>
              )}

              {/* Employee Code */}
              <span className="px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground border border-border text-xs font-mono font-medium">
                {profile?.employee_code || '#USER-001'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Structured 2-Column Responsive Grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* ── CARD 1: Account Information ───────────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            {/* Card Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-border/60">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UserCircle size={20} />
              </div>
              <div className="text-start">
                <h2 className="text-base font-bold text-foreground">
                  {isRtl ? 'تفاصيل الحساب' : 'Account Details'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? 'معلومات ملفك الشخصي وصلاحياتك بالنظام' : 'Your personal profile & workspace identity'}
                </p>
              </div>
            </div>

            {/* Field Rows */}
            <div className="space-y-4 text-start">
              {/* Full Name */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    {isRtl ? 'الاسم الكامل' : 'Full Name'}
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {profile?.full_name || '—'}
                  </p>
                </div>
                <UserCircle size={18} className="text-muted-foreground/60 shrink-0" />
              </div>

              {/* Email Address */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    {isRtl ? 'عنوان البريد الإلكتروني' : 'Email Address'}
                  </span>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {profile?.email || (isRtl ? 'غير متوفر' : 'Not available')}
                  </p>
                </div>
                <Mail size={18} className="text-muted-foreground/60 shrink-0" />
              </div>

              {/* Phone Number */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    {isRtl ? 'رقم الهاتف' : 'Phone Number'}
                  </span>
                  <p className="text-sm font-semibold text-foreground font-mono">
                    {profile?.phone || (isRtl ? 'غير متوفر' : 'Not provided')}
                  </p>
                </div>
                <Smartphone size={18} className="text-muted-foreground/60 shrink-0" />
              </div>

              {/* System ID with 1-Click Copy */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    {isRtl ? 'رمز النظام الفريد' : 'System ID'}
                  </span>
                  <p className="text-xs font-mono text-muted-foreground truncate select-all">
                    {profile?.id || '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-2 rounded-lg bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-all shrink-0 active:scale-95"
                  title={isRtl ? 'نسخ رمز النظام' : 'Copy System ID'}
                >
                  {copiedId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Security Note */}
          <div className="pt-4 mt-4 border-t border-border/40 flex items-center gap-2 text-muted-foreground text-xs text-start">
            <ShieldCheck size={14} className="text-primary shrink-0" />
            <span>
              {isRtl 
                ? 'حسابك محمي بتشفير قياسي عبر منصة OSBIC' 
                : 'Secured internal staff identity managed by OSBIC Admin'}
            </span>
          </div>
        </div>

        {/* ── CARD 2: Security & Change Password ─────────────────────────────── */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-border/60">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Key size={20} />
              </div>
              <div className="text-start">
                <h2 className="text-base font-bold text-foreground">
                  {isRtl ? 'تغيير كلمة المرور' : 'Change Password'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isRtl ? 'تحديث بيانات الاعتماد الخاصة بتسجيل الدخول' : 'Update your personal login credentials'}
                </p>
              </div>
            </div>

            {/* Password Form */}
            <form onSubmit={handlePasswordChange} className="space-y-5 pt-6 text-start">
              {/* New Password */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className={`w-full bg-muted/40 border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-all ${
                      passwordData.newPassword && passwordData.newPassword.length < 6 
                        ? 'border-destructive/60 focus:border-destructive' 
                        : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/10'
                    } ${isRtl ? 'pl-11 pr-4' : 'pr-11 pl-4'}`}
                    placeholder={isRtl ? 'أدخل كلمة مرور لا تقل عن 6 أحرف...' : 'Min 6 characters...'}
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNew(!showNew)}
                    className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors`}
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  {isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className={`w-full bg-muted/40 border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-all ${
                      !passwordsMatch 
                        ? 'border-destructive/60 focus:border-destructive' 
                        : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/10'
                    } ${isRtl ? 'pl-11 pr-4' : 'pr-11 pl-4'}`}
                    placeholder={isRtl ? 'أعد إدخال كلمة المرور للتأكيد...' : 'Repeat new password...'}
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirm(!showConfirm)}
                    className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors`}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Validation Feedback */}
                {!passwordsMatch && (
                  <div className="flex items-center gap-1.5 text-destructive text-xs pt-1">
                    <AlertCircle size={13} />
                    <span>{isRtl ? 'كلمات المرور غير متطابقة' : 'Passwords do not match'}</span>
                  </div>
                )}
                
                {passwordsMatch && passwordData.newPassword && passwordData.confirmPassword && (
                  <div className="flex items-center gap-1.5 text-emerald-500 text-xs pt-1">
                    <CheckCircle2 size={13} />
                    <span>{isRtl ? 'كلمات المرور متطابقة' : 'Passwords match perfectly'}</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !passwordsMatch || !passwordData.newPassword || passwordData.newPassword.length < 6}
                  className="w-full py-3.5 px-5 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{isRtl ? 'جارٍ الحفظ...' : 'Updating Password...'}</span>
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      <span>{isRtl ? 'تحديث كلمة المرور' : 'Update Password'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

export default EmployeeProfile;
