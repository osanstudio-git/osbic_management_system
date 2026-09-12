import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  ClipboardList, 
  Bell, 
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
   Search,
   Globe,
   User,
   MessageSquare,
   PieChart,
   LayoutDashboard,
   FileText,
   Shield,
   Zap,
   Menu,
   X,
   MapPin,
   ChevronDown,
   Building2,
   ShieldCheck
 } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { TopBarNotifications } from '../components/employee/TopBarNotifications';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { GlobalNotificationListener } from '../components/shared/GlobalNotificationListener';
import { AssignmentBanner } from '../components/employee/AssignmentBanner';
import { QuickUpdateWidget } from '../components/employee/QuickUpdateWidget';
import { useRealtime } from '../hooks/useRealtime';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useBranch } from '../contexts/BranchContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const EmployeeLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const { branches, selectedBranchId, setSelectedBranchId, selectedBranch } = useBranch();
  const isManagerOrAdmin = profile?.is_manager || profile?.role === 'admin';

  useRealtime(profile?.id);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const [availability, setAvailability] = useState(profile?.availability_status || 'on-work');

  React.useEffect(() => {
    if (profile) setAvailability(profile.availability_status || 'on-work');
  }, [profile]);

  const toggleAvailability = async () => {
    const newStatus = availability === 'available' ? 'on-work' : 'available';
    setAvailability(newStatus);
    try {
      await supabase.from('profiles').update({ availability_status: newStatus }).eq('id', profile?.id);
      toast.success(newStatus === 'available' ? (isRtl ? 'تم تحديد حالتك كمتاح لتلقي المهام' : 'You are now marked as Available for tasks') : (isRtl ? 'تم تحديد حالتك كقيد العمل' : 'You are now marked as On-Work'));
    } catch (err) {
      toast.error(isRtl ? 'فشل تحديث الحالة' : 'Failed to update status');
      setAvailability(availability);
    }
  };

  const navItems = [
    { key: 'home', icon: LayoutDashboard, path: '/employee' },
    ...(profile?.is_manager ? [
      { key: 'team', icon: Users, path: '/employee/team' },
      { key: 'approvals', icon: ShieldCheck, path: '/employee/approvals' },
      { key: 'pipeline', icon: Globe, path: '/employee/pipeline' },
    ] : []),
    { key: 'my_clients', icon: Users, path: '/employee/clients' },
    { key: 'my_tasks', icon: ClipboardList, path: '/employee/tasks' },
    // Ops queue — shown if employee can do ops work
    ...(profile?.can_do_ops && !profile?.is_manager ? [{ key: 'ops_queue', icon: Zap, path: '/employee/my-tasks' }] : []),
    // PRO queue — shown for PRO agents
    ...(profile?.is_pro ? [{ key: 'pro_queue', icon: Shield, path: '/employee/pro-queue' }] : []),
    { key: 'reports', icon: PieChart, path: '/employee/reports' },
    { key: 'invoices', icon: FileText, path: '/employee/invoices' },
    { key: 'messages', icon: MessageSquare, path: '/employee/messages' },
    { key: 'notifications', icon: Bell, path: '/employee/notifications' },
    { key: 'profile', icon: User, path: '/employee/profile' },
    ...(profile?.can_do_sales ? [{ key: 'leads', icon: Users, path: '/employee/leads' }] : []),
    ...(profile?.can_do_accounts ? [{ key: 'accounts', icon: FileText, path: '/employee/accounts' }] : []),
  ].filter(item => {
    // PRO agents: only home, pro queue, and profile
    if (profile?.is_pro) {
      return ['home', 'pro_queue', 'profile'].includes(item.key);
    }
    // Accounts-only staff: only Dashboard, Accounts, Invoices, Messages, Profile
    if (profile?.can_do_accounts && !profile?.is_manager && !profile?.can_do_ops && !profile?.can_do_sales && !profile?.is_pro) {
      return ['home', 'accounts', 'invoices', 'messages', 'profile'].includes(item.key);
    }
    if (item.key === 'pro_queue') return false;
    return true;
  });

  const handleLanguageToggle = () => {
    const nextLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(nextLang);
    document.documentElement.dir = nextLang === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      <GlobalNotificationListener />
      {/* Removed AssignmentBanner for immediate direct task activation workflow */}
      <QuickUpdateWidget />
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-border h-full transition-transform duration-300 lg:relative lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-20 items-center justify-between px-6">
          {!collapsed && (
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xl font-syne font-bold text-primary tracking-wider"
            >
              OSBIC STAFF
            </motion.h1>
          )}
          <button
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileMenuOpen(false);
              } else {
                setCollapsed(!collapsed);
              }
            }}
            className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground transition-colors"
          >
            {window.innerWidth < 1024 ? <X size={20} /> : (collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />)}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]" 
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                )
              }
            >
              <item.icon size={20} className={cn("shrink-0")} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  {item.label || t(`sidebar.${item.key}`)}
                </motion.span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          <button
            onClick={handleLanguageToggle}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-all text-sm"
          >
            <Globe size={20} />
            {!collapsed && <span>{i18n.language.toUpperCase()}</span>}
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all text-sm"
          >
            <LogOut size={20} />
            {!collapsed && <span>{t('common.logout')}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <header className="relative z-30 h-20 flex items-center justify-between px-4 lg:px-8 bg-background/50 backdrop-blur-xl border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-foreground/5 text-foreground transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-4 bg-muted/20 border border-border px-4 py-2 rounded-xl w-64 lg:w-80 group focus-within:border-primary/50 transition-all">
              <Search size={18} className="text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder={t('common.search')} 
                className="bg-transparent border-none outline-none text-sm text-foreground w-full placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <TopBarNotifications />
            <div className="w-[1px] h-6 bg-border mx-1 lg:mx-2" />
            <ThemeToggle />

            {/* Branch Badge for Branch Manager */}
            {profile?.is_manager && profile?.branch_id && profile?.role !== 'admin' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-bold shadow-sm">
                <Building2 size={13} />
                <span className="hidden sm:inline max-w-[140px] truncate">{selectedBranch?.name || 'Branch Manager'}</span>
                <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Manager</span>
              </div>
            )}

            {/* Branch Switcher — Super Admin only */}
            {profile?.role === 'admin' && (
              <div className="relative">
                <button
                  onClick={() => setBranchDropdownOpen(o => !o)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    selectedBranchId
                      ? 'bg-primary/10 border-primary/40 text-primary'
                      : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-border/60'
                  }`}
                >
                  <MapPin size={12} />
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {selectedBranch ? selectedBranch.name : (isRtl ? 'جميع الفروع' : 'All Branches')}
                  </span>
                  <ChevronDown size={12} className={`transition-transform ${branchDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {branchDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setBranchDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute ${isRtl ? 'left-0' : 'right-0'} top-full mt-2 w-56 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden`}
                      >
                        <div className="p-1">
                          <button
                            onClick={() => { setSelectedBranchId(null); setBranchDropdownOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                              !selectedBranchId ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                          >
                            <Globe size={13} />
                            {isRtl ? 'جميع الفروع' : 'All Branches'}
                            {!selectedBranchId && <span className={`${isRtl ? 'mr-auto ml-0' : 'ml-auto mr-0'} text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold`}>{isRtl ? 'نشط' : 'ACTIVE'}</span>}
                          </button>
                          {branches.filter(b => b.is_active).map(b => (
                            <button
                              key={b.id}
                              onClick={() => { setSelectedBranchId(b.id); setBranchDropdownOpen(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                selectedBranchId === b.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary font-mono">{b.code.slice(0,2)}</span>
                              <span className="truncate">{b.name}</span>
                              {selectedBranchId === b.id && <span className={`${isRtl ? 'mr-auto ml-0' : 'ml-auto mr-0'} text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold`}>{isRtl ? 'نشط' : 'ACTIVE'}</span>}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            <button
              onClick={toggleAvailability}
              className={`flex items-center gap-2 px-2 lg:px-3 py-1.5 rounded-full border text-[10px] lg:text-xs font-bold uppercase tracking-widest transition-all ml-1 lg:ml-2 whitespace-nowrap shrink-0 ${
                availability === 'available' 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${availability === 'available' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="hidden sm:inline whitespace-nowrap">{availability === 'available' ? (isRtl ? 'متاح' : 'Available') : (isRtl ? 'قيد العمل' : 'On-Work')}</span>
            </button>

            <NavLink to="/employee/profile" className="flex items-center gap-2 lg:gap-3 hover:opacity-80 transition-opacity ml-1 lg:ml-2">
              <div className={`${isRtl ? 'text-left' : 'text-right'} hidden md:block`}>
                <p className="text-sm font-bold text-foreground leading-tight truncate max-w-[120px]">{profile?.full_name}</p>
                <p className="text-xs text-muted-foreground uppercase">{profile?.employee_code || (isRtl ? 'موظف' : 'Employee')}</p>
              </div>
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm lg:text-lg shrink-0 overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  profile?.full_name?.[0].toUpperCase()
                )}
              </div>
            </NavLink>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.35 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default EmployeeLayout;
