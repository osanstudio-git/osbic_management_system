import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  Briefcase, 
  ClipboardList, 
  Wallet, 
  Bell, 
  Shield, 
  Settings,
  LogOut,
  Globe, 
  Boxes,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Zap,
  Megaphone
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../../hooks/shared/useNotifications';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useOperationalRequests } from '../../hooks/shared/useJobs';
import { useAdminSettings } from '../../hooks/admin/useAdminSettings';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (val: boolean) => void;
}

const AdminSidebar: React.FC<SidebarProps> = ({ collapsed, setCollapsed, mobileMenuOpen, setMobileMenuOpen }) => {
  const { profile, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const { data: requests } = useOperationalRequests();
  const { useNotificationsList } = useNotifications();
  const { data: notifications } = useNotificationsList();
  const { settings, logo } = useAdminSettings();

  const pendingRequestsCount = requests?.filter(r => r.status === 'pending').length || 0;
  const unreadNotifsCount = notifications?.filter(n => !n.is_read).length || 0;

  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'sidebar.home', path: '/admin/dashboard' },
    { id: 'employees', icon: Users, label: 'sidebar.employees', path: '/admin/employees' },
    { id: 'clients', icon: UserCheck, label: 'sidebar.clients', path: '/admin/clients' },
    { id: 'services', icon: Briefcase, label: 'sidebar.services', path: '/admin/services' },
    { id: 'packages', icon: Boxes, label: 'Packages', path: '/admin/packages' },
    { id: 'jobs', icon: ClipboardList, label: 'sidebar.jobs', path: '/admin/jobs' },
    { id: 'leads', icon: Zap, label: 'Leads Pipeline', path: '/admin/leads' },
    { id: 'marketing', icon: Megaphone, label: 'sidebar.marketing', path: '/admin/marketing' },
    { id: 'approvals', icon: Shield, label: 'sidebar.approvals', path: '/admin/approvals', badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined },
    { id: 'finance', icon: Wallet, label: 'sidebar.finance', path: '/admin/finance' },
    { id: 'messages', icon: MessageSquare, label: 'Messages', path: '/admin/messages' },
    { id: 'notifications', icon: Bell, label: 'common.notifications', path: '/admin/notifications', badge: unreadNotifsCount > 0 ? unreadNotifsCount : undefined },
    { id: 'audit', icon: Shield, label: 'sidebar.audit', path: '/admin/audit' },
    { id: 'settings', icon: Settings, label: 'common.settings', path: '/admin/settings' },
  ];
  const isRtl = i18n.dir() === 'rtl';

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: isRtl ? 10 : -10 },
    show: { opacity: 1, x: 0 },
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[45] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-border h-screen transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isRtl ? 'right-0 left-auto md:right-auto md:left-0' : ''}`}
      >
      {/* Logo Section */}
      <div className="flex h-20 items-center px-6 overflow-hidden">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
            {logo ? (
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-syne font-bold text-primary">O</span>
            )}
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="font-syne font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden"
            >
              <span className="font-syne font-bold text-foreground tracking-[0.2em] whitespace-nowrap">
                {settings?.company_name || 'OSBIC'}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <motion.nav
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto overflow-x-hidden"
      >
        {navItems.map((item) => (
          <motion.div key={item.id} variants={itemVariants}>
            <NavLink
              to={item.path}
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileMenuOpen(false);
                }
              }}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center h-12 rounded-xl transition-all duration-200 outline-none",
                  collapsed ? "justify-center" : "px-3 gap-3",
                  isActive 
                    ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]" 
                    : "text-muted-foreground hover:bg-primary/[0.08] hover:text-foreground hover:shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                )
              }
            >
              <item.icon 
                size={20} 
                className="shrink-0 transition-colors duration-150 text-muted-foreground group-hover:text-primary" 
              />
              {!collapsed && (
                <span className="flex-1 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                  {t(item.label)}
                </span>
              )}
              {item.badge && !collapsed && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
              )}
            </NavLink>
          </motion.div>
        ))}
      </motion.nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-border space-y-4 bg-muted/20">
        <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "px-2")}>
          <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center shrink-0 overflow-hidden">
             {profile?.avatar_url ? (
               <img src={profile.avatar_url || undefined} alt={profile.full_name || 'User'} className="w-full h-full object-cover" />
             ) : (
               <span className="text-muted-foreground font-bold">{profile?.full_name?.[0].toUpperCase()}</span>
             )}
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 min-w-0"
            >
              <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
              <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mt-0.5">
                {profile?.role}
              </span>
            </motion.div>
          )}
        </div>

        {/* Toggle Collapse Button (Desktop Only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-10 w-6 h-6 bg-primary border-2 border-background rounded-full items-center justify-center text-primary-foreground hover:scale-110 transition-transform cursor-pointer z-50 shadow-md"
        >
           {isRtl ? (collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />) : (collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)}
        </button>

        <div className="flex flex-col gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden flex items-center gap-3 w-full h-10 rounded-xl text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all text-sm group"
          >
            <div className={cn("shrink-0", collapsed ? "w-full flex justify-center" : "px-3 flex items-center gap-3")}>
               {collapsed ? (isRtl ? <ChevronLeft size={20} /> : <ChevronRight size={20} />) : (isRtl ? <ChevronRight size={20} /> : <ChevronLeft size={20} />)}
               {!collapsed && <span>{collapsed ? t('common.expand') : t('common.collapse')}</span>}

            </div>
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full h-10 rounded-xl text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-all text-sm group"
          >
             <div className={cn("shrink-0", collapsed ? "w-full flex justify-center" : "px-3 flex items-center gap-3")}>
               <LogOut size={20} />
               {!collapsed && <span>{t('common.logout')}</span>}
            </div>
          </button>
        </div>
      </div>
    </motion.aside>
    </>
  );
};

export default AdminSidebar;
