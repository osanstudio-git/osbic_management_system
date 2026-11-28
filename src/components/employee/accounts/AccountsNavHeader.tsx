import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  FileText, TrendingUp, Users, Landmark, 
  Wallet, Building2, ChevronRight, ArrowLeft, Globe
} from 'lucide-react';
import { useBranch } from '../../../contexts/BranchContext';

interface AccountsNavHeaderProps {
  title?: string;
  description?: string;
  activePage?: string;
  selectedBranchId?: string | null;
  onBranchChange?: (branchId: string | null) => void;
  children?: React.ReactNode;
}

export const AccountsNavHeader: React.FC<AccountsNavHeaderProps> = ({
  title = 'Ledger & Verification Hub',
  description = 'Master financial ledger, payment verification queue, and real-time reconciliation',
  selectedBranchId,
  onBranchChange,
  children
}) => {
  const location = useLocation();
  const { branches } = useBranch();
  const isAdmin = location.pathname.startsWith('/admin');
  const basePath = isAdmin ? '/admin' : '/employee';

  const navLinks = [
    { label: 'Journal & Real-Time P&L', path: `${basePath}/accounts/journal`, icon: FileText },
    { label: 'Job Income & Expenses', path: `${basePath}/accounts/income-expenses`, icon: TrendingUp },
    { label: 'Client Receivables & Aging', path: `${basePath}/accounts/receivables`, icon: Users },
    { label: 'Gov Fee Audit & Variance', path: `${basePath}/accounts/gov-audit`, icon: Landmark },
    { label: 'Ledger & Verification Hub', path: `${basePath}/accounts`, icon: Wallet },
    { label: 'OSBIC Migrate Hub', path: `${basePath}/migrate`, icon: Globe },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border/80 p-6 rounded-3xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <span>Finance & Accounts Suite</span>
            <ChevronRight size={14} className="text-muted-foreground" />
            <span className="text-foreground">{title}</span>
          </div>
          <h1 className="text-2xl font-syne font-black text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground max-w-2xl">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Filter */}
          {onBranchChange && (
            <div className="flex items-center gap-2 bg-muted/30 border border-border px-3 py-1.5 rounded-2xl text-xs">
              <Building2 size={14} className="text-muted-foreground shrink-0" />
              <select
                value={selectedBranchId || ''}
                onChange={(e) => onBranchChange(e.target.value ? e.target.value : null)}
                className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-2"
              >
                <option value="" className="bg-[#0A0F1E] text-foreground">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-[#0A0F1E] text-foreground">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {children}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 overflow-x-auto no-scrollbar scroll-smooth pb-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon size={14} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};

export default AccountsNavHeader;
