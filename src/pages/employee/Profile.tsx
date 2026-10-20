import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, Key, CheckCircle2, AlertCircle, Eye, EyeOff,
  UserCircle, Mail, Smartphone, Fingerprint, Camera, Loader2,
  Cake, Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { BirthdayCelebrationModal } from '../../components/employee/BirthdayCelebrationModal';

const EmployeeProfile = () => {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [previewPosterOpen, setPreviewPosterOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [personalData, setPersonalData] = useState({
    gender: 'male' as 'male' | 'female',
    dateOfBirth: '',
    showBirthdayToTeam: true,
  });
  const [savingPersonal, setSavingPersonal] = useState(false);

  useEffect(() => {
    if (profile) {
      setPersonalData({
        gender: ((profile as any).gender || 'male') as 'male' | 'female',
        dateOfBirth: (profile as any).date_of_birth || '',
        showBirthdayToTeam: (profile as any).show_birthday_to_team !== false,
      });
    }
  }, [profile]);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
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
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || (isRtl ? 'فشل تحديث كلمة المرور' : 'Failed to update password'));
    } finally {
      loading && setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate size and format
    if (file.size > 10 * 1024 * 1024) return toast.error(isRtl ? 'يجب أن تكون الصورة أقل من 10 ميجابايت' : 'Photo must be under 10MB');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error(isRtl ? 'يسمح فقط بصيغ JPG أو PNG أو WebP' : 'Only JPG, PNG or WebP allowed');

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

  const handlePersonalSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSavingPersonal(true);
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({
          gender: personalData.gender,
          date_of_birth: personalData.dateOfBirth || null,
          show_birthday_to_team: personalData.showBirthdayToTeam,
        })
        .eq('id', profile.id);

      if (error) throw error;
      if (refreshProfile) await refreshProfile();
      toast.success(isRtl ? 'تم حفظ بيانات المناسبات بنجاح' : 'Personal milestone settings saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSavingPersonal(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 p-4 sm:p-8" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header Profile Card (Minimalist) */}
      <div className="flex flex-col md:flex-row items-center gap-6 border-b border-border pb-6 font-sans">
        <div className="relative group">
          <div className="w-20 h-20 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-2xl overflow-hidden shadow-xl">
            {uploadingAvatar ? (
              <Loader2 className="animate-spin" size={24} />
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
            ) : (
              profile?.full_name?.[0].toUpperCase()
            )}
          </div>
          <label className={`absolute -bottom-2 ${isRtl ? '-left-2' : '-right-2'} p-2 bg-foreground border border-border rounded-xl text-background hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer`}>
            <Camera size={12} />
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
          </label>
        </div>
        
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-2xl font-syne font-bold text-foreground tracking-tight">{profile?.full_name}</h1>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
              {profile?.role === 'admin' ? (isRtl ? 'مسؤول' : 'Admin') : profile?.role === 'employee' ? (isRtl ? 'موظف' : 'Employee') : (isRtl ? 'عضو الفريق' : (profile?.role || 'Staff Member'))}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-muted/50 border border-border text-muted-foreground text-[10px] font-bold font-mono">
              {profile?.employee_code || '#USER-001'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Account Details */}
        <div className="md:col-span-2 space-y-6 font-sans">
          <div className="bg-transparent border border-border/50 rounded-xl p-5 space-y-6">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4 text-start">
              <UserCircle size={16} className="text-muted-foreground" />
              <h3 className="font-bold text-sm">{isRtl ? 'تفاصيل الحساب' : 'Account Details'}</h3>
            </div>
            
            <div className="space-y-4 text-start">
              <div className="flex items-start gap-3">
                <Mail size={14} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{isRtl ? 'عنوان البريد الإلكتروني' : 'Email Address'}</p>
                  <p className="text-xs font-medium text-foreground">{profile?.email || (isRtl ? 'غير موثق' : 'Not verified')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Smartphone size={14} className="text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{isRtl ? 'رقم الهاتف' : 'Phone Number'}</p>
                  <p className="text-xs font-medium text-foreground">{profile?.phone || (isRtl ? 'غير متوفر' : 'Not provided')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Fingerprint size={14} className="text-muted-foreground mt-0.5" />
                <div className="w-full min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">{isRtl ? 'رمز النظام' : 'System ID'}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate w-full">{profile?.id}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Milestones & Celebrations Card */}
          <form onSubmit={handlePersonalSave} className="bg-transparent border border-gold/30 rounded-xl p-5 space-y-4 text-start bg-gold/5">
            <div className="flex items-center justify-between border-b border-gold/20 pb-3">
              <div className="flex items-center gap-2 text-gold">
                <Cake size={16} />
                <h3 className="font-bold text-sm">{isRtl ? 'المناسبات والتهاني' : 'Milestones & Birthday'}</h3>
              </div>
              <Sparkles size={14} className="text-gold/70 animate-pulse" />
            </div>

            {/* Gender Selection */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1.5">
                {isRtl ? 'الجنس (للتهاني الرسمية)' : 'Gender (For respectful greetings)'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPersonalData({ ...personalData, gender: 'male' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    personalData.gender === 'male'
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-white/5 border-border text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  <span>👨</span> {isRtl ? 'ذكر (أخي)' : 'Male (Brother)'}
                </button>
                <button
                  type="button"
                  onClick={() => setPersonalData({ ...personalData, gender: 'female' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    personalData.gender === 'female'
                      ? 'bg-pink-500/20 border-pink-500 text-pink-400'
                      : 'bg-white/5 border-border text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  <span>👩</span> {isRtl ? 'أنثى (أختي)' : 'Female (Sister)'}
                </button>
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-1.5">
                {isRtl ? 'تاريخ الميلاد' : 'Date of Birth'}
              </label>
              <input
                type="date"
                value={personalData.dateOfBirth}
                onChange={(e) => setPersonalData({ ...personalData, dateOfBirth: e.target.value })}
                className="w-full bg-muted/10 border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-gold transition-colors"
              />
              <p className="text-[9px] text-muted-foreground mt-1">
                {isRtl ? 'الزملاء يرون اليوم والشهر فقط (العمر وسنة الميلاد مخفيان تماماً).' : 'Colleagues will only see month & day (age & year are completely private).'}
              </p>
            </div>

            {/* Broadcast to Team */}
            <div className="flex items-center justify-between pt-2 border-t border-gold/10">
              <div>
                <p className="text-xs font-medium text-foreground">{isRtl ? 'مشاركة المناسبة مع الفريق' : 'Share with Colleagues'}</p>
                <p className="text-[9px] text-muted-foreground">{isRtl ? 'عرض بطاقة تهنئة على لوحة تحكم الزملاء' : 'Show birthday banner on team dashboard'}</p>
              </div>
              <button
                type="button"
                onClick={() => setPersonalData({ ...personalData, showBirthdayToTeam: !personalData.showBirthdayToTeam })}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  personalData.showBirthdayToTeam ? 'bg-gold' : 'bg-white/10'
                }`}
              >
                <div
                  className={`bg-card w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    personalData.showBirthdayToTeam ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingPersonal}
                className="flex-1 py-2 bg-gold/20 hover:bg-gold/30 text-gold border border-gold/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingPersonal ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                {isRtl ? 'حفظ البيانات' : 'Save Settings'}
              </button>
              <button
                type="button"
                onClick={() => setPreviewPosterOpen(true)}
                className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
              >
                <Sparkles size={13} className="text-amber-400" />
                <span>{isRtl ? 'معاينة البوستر 🎉' : 'Preview Poster 🎉'}</span>
              </button>
            </div>
          </form>

          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-start">
            <div className="flex items-center gap-2 mb-2 text-emerald-500">
              <Shield size={14} />
              <p className="font-bold text-xs tracking-wide">{isRtl ? 'حالة الأمان' : 'Security Status'}</p>
            </div>
            <p className="text-[10px] text-emerald-500/80 leading-relaxed">
              {isRtl ? 'حسابك محمي بتشفير قياسي. قم بتغيير كلمة المرور بانتظام للحفاظ على الأمان.' : 'Your account is protected by industry-standard encryption. Change your password regularly to maintain security.'}
            </p>
          </div>
        </div>

        {/* Password Management */}
        <div className="md:col-span-3 font-sans">
          <div className="bg-transparent border border-border/50 rounded-xl p-6">
            
            <div className="flex items-center gap-3 border-b border-border/30 pb-4 mb-6 text-start">
               <Key size={16} className="text-muted-foreground" />
               <div>
                 <h3 className="text-sm font-bold text-foreground">{isRtl ? 'تغيير كلمة المرور' : 'Change Password'}</h3>
                 <p className="text-[10px] text-muted-foreground">{isRtl ? 'تحديث بيانات الاعتماد الخاصة بك' : 'Update your security credentials'}</p>
               </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
               <div className="space-y-4">
                 <div className="space-y-1.5 text-start">
                   <label className={`text-[9px] font-bold text-muted-foreground uppercase tracking-widest ${isRtl ? 'mr-1' : 'ml-1'}`}>{isRtl ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                   <div className="relative group">
                     <input
                       type={showNew ? "text" : "password"}
                       value={passwordData.newPassword}
                       onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                       className={`w-full bg-muted/10 border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-all ${passwordData.newPassword && passwordData.newPassword.length < 6 ? 'border-destructive/50' : 'border-border focus:border-primary ring-primary/10'} ${isRtl ? 'pl-10 pr-4' : 'pr-10 pl-4'}`}
                       placeholder={isRtl ? 'كلمة مرور لا تقل عن 6 أحرف...' : 'Min 6 characters...'}
                       required
                     />
                     <button 
                       type="button" 
                       onClick={() => setShowNew(!showNew)}
                       className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-primary transition-colors`}
                     >
                       {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                     </button>
                   </div>
                 </div>

                 <div className="space-y-1.5 text-start">
                   <label className={`text-[9px] font-bold text-muted-foreground uppercase tracking-widest ${isRtl ? 'mr-1' : 'ml-1'}`}>{isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                   <div className="relative group">
                     <input
                       type={showConfirm ? "text" : "password"}
                       value={passwordData.confirmPassword}
                       onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                       className={`w-full bg-muted/10 border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-all ${!passwordsMatch ? 'border-destructive/50 ring-destructive/10' : 'border-border focus:border-primary ring-primary/10'} ${isRtl ? 'pl-10 pr-4' : 'pr-10 pl-4'}`}
                       placeholder={isRtl ? 'تكرار كلمة المرور الجديدة' : 'Repeat new password'}
                       required
                     />
                     <button 
                       type="button" 
                       onClick={() => setShowConfirm(!showConfirm)}
                       className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-primary transition-colors`}
                     >
                       {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                     </button>
                   </div>
                   
                   {!passwordsMatch && (
                     <div className={`flex items-center gap-1.5 text-destructive text-[10px] mt-1.5 ${isRtl ? 'mr-1' : 'ml-1'}`}>
                       <AlertCircle size={12} />
                       {isRtl ? 'كلمات المرور غير متطابقة' : 'Passwords do not match'}
                     </div>
                   )}
                   
                   {passwordsMatch && passwordData.newPassword && passwordData.confirmPassword && (
                     <div className={`flex items-center gap-1.5 text-emerald-500 text-[10px] mt-1.5 ${isRtl ? 'mr-1' : 'ml-1'}`}>
                       <CheckCircle2 size={12} />
                       {isRtl ? 'كلمات المرور متطابقة' : 'Passwords match'}
                     </div>
                   )}
                 </div>
               </div>

               <div className="pt-2">
                 <button
                   type="submit"
                   disabled={loading || !passwordsMatch || !passwordData.newPassword}
                   className="w-full bg-primary text-[#0A0F1E] font-bold p-3 text-xs rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                 >
                   {loading ? (
                     <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                   ) : (
                     <>
                       <Shield size={14} />
                       {isRtl ? 'تحديث كلمة المرور' : 'Update Password'}
                     </>
                   )}
                 </button>
               </div>
            </form>
          </div>
        </div>
      </div>

      {/* Birthday Poster Preview Modal */}
      <BirthdayCelebrationModal
        isOpen={previewPosterOpen}
        onClose={() => setPreviewPosterOpen(false)}
        employeeName={profile?.full_name || 'Abdullah Al Hasani'}
        avatarUrl={profile?.avatar_url}
        gender={personalData.gender}
        department={profile?.department}
        role={profile?.role}
      />
    </div>
  );
};

export default EmployeeProfile;
