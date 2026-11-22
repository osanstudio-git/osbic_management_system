import React from 'react';
import { 
  Building2, Calendar, DollarSign, Heart, MapPin, 
  Phone, Shield, User, Wallet, FileText, AlertTriangle, 
  CheckCircle2, Clock, Landmark, CreditCard, Award
} from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';

interface EmployeeDossierViewProps {
  employee: any;
  onEditClick?: () => void;
}

export const EmployeeDossierView: React.FC<EmployeeDossierViewProps> = ({ employee, onEditClick }) => {
  const getDaysRemaining = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const parsed = parseISO(dateStr);
      return differenceInDays(parsed, new Date());
    } catch {
      return null;
    }
  };

  const renderExpiryBadge = (dateStr?: string | null, label?: string) => {
    if (!dateStr) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-muted/50 text-muted-foreground border border-border">
          Not Recorded
        </span>
      );
    }
    const days = getDaysRemaining(dateStr);
    if (days === null) return null;

    let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    let text = `${days} days left`;

    if (days < 0) {
      badgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      text = `EXPIRED (${Math.abs(days)}d ago)`;
    } else if (days <= 15) {
      badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      text = `Expiring soon (${days}d)`;
    } else if (days <= 45) {
      badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      text = `${days} days remaining`;
    }

    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-foreground">
          {format(parseISO(dateStr), 'dd MMM yyyy')}
        </span>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${badgeClass}`}>
          {text}
        </span>
      </div>
    );
  };

  const basicSalary = Number(employee.basic_salary) || 0;
  const housing = Number(employee.housing_allowance) || 0;
  const transport = Number(employee.transport_allowance) || 0;
  const other = Number(employee.other_allowance) || 0;
  const grossSalary = Number(employee.gross_salary) || (basicSalary + housing + transport + other);

  return (
    <div className="space-y-8">
      {/* Expiry Radar Bar */}
      <div className="bg-muted/30 border border-border/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">
              Official Legal Expiry Radar
            </h4>
          </div>
          <span className="text-[10px] text-muted-foreground">Automated compliance tracking</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 bg-card border border-border/60 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Resident / Work Visa
            </span>
            {renderExpiryBadge(employee.visa_expiry)}
          </div>

          <div className="p-3.5 bg-card border border-border/60 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              National / Civil ID
            </span>
            {renderExpiryBadge(employee.civil_id_expiry)}
          </div>

          <div className="p-3.5 bg-card border border-border/60 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Passport Expiry
            </span>
            {renderExpiryBadge(employee.passport_expiry)}
          </div>

          <div className="p-3.5 bg-card border border-border/60 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Ministry Labor Card
            </span>
            {renderExpiryBadge(employee.labor_card_expiry)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Personal & Identity Information */}
        <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <User size={16} className="text-primary" />
              <span>Personal & Identity Details</span>
            </div>
            {employee.nationality && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                {employee.nationality}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block mb-0.5">Full Legal Name</span>
              <span className="font-bold text-foreground text-sm">{employee.full_name || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Staff Code</span>
              <span className="font-mono font-bold text-primary">{employee.employee_code || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Gender</span>
              <span className="font-medium text-foreground capitalize">{employee.gender || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Date of Birth</span>
              <span className="font-mono font-medium text-foreground">{employee.date_of_birth || 'Not recorded'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Blood Group</span>
              <span className="font-mono font-bold text-rose-400">{employee.blood_group || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Labor Card Number</span>
              <span className="font-mono font-medium text-foreground">{employee.labor_card_number || '—'}</span>
            </div>
          </div>

          {employee.residence_address && (
            <div className="pt-2 border-t border-border/40 text-xs">
              <span className="text-muted-foreground block mb-0.5">Residence Address</span>
              <p className="text-foreground/90 leading-relaxed flex items-center gap-1.5">
                <MapPin size={13} className="text-muted-foreground shrink-0" />
                {employee.residence_address}
              </p>
            </div>
          )}

          {/* Emergency Contact */}
          <div className="pt-3 border-t border-border/40 bg-muted/20 p-3 rounded-xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Heart size={12} className="text-rose-400" /> Emergency Contact
            </span>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-bold text-foreground">
                {employee.emergency_contact_name || 'Not provided'}
                {employee.emergency_contact_relation ? ` (${employee.emergency_contact_relation})` : ''}
              </span>
              {employee.emergency_contact_phone && (
                <a
                  href={`tel:${employee.emergency_contact_phone}`}
                  className="flex items-center gap-1 font-mono text-primary hover:underline"
                >
                  <Phone size={11} /> {employee.emergency_contact_phone}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Employment Contract & Terms */}
        <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Building2 size={16} className="text-blue-400" />
              <span>Contract & Organizational Role</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
              {employee.contract_type ? employee.contract_type.replace('_', ' ') : 'Full Time'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block mb-0.5">Official Designation</span>
              <span className="font-bold text-foreground text-sm">{employee.job_title || 'Staff Officer'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Department</span>
              <span className="font-bold text-foreground capitalize">{employee.department || 'Operations'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Branch Assigned</span>
              <span className="font-medium text-foreground">{employee.branches?.name || 'Central Head Office'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Date of Joining</span>
              <span className="font-mono font-medium text-foreground">
                {employee.date_of_joining ? format(parseISO(employee.date_of_joining), 'dd MMM yyyy') : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Probation End Date</span>
              <span className="font-mono font-medium text-foreground">
                {employee.probation_end_date ? format(parseISO(employee.probation_end_date), 'dd MMM yyyy') : 'Completed'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Notice Period</span>
              <span className="font-mono font-medium text-foreground">{employee.notice_period_days || 30} Days</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Leave Balance</span>
              <span className="font-mono font-bold text-emerald-400">{employee.leave_balance ?? 30} Days</span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">Direct Manager</span>
              <span className="font-medium text-foreground">{employee.is_manager ? 'Branch Head' : 'Reports to Branch Manager'}</span>
            </div>
          </div>
        </div>

        {/* Card 3: WPS Payroll & Salary Structure */}
        <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Wallet size={16} className="text-emerald-400" />
              <span>WPS Payroll & Compensation Structure</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Gross Monthly Salary:</span>
              <span className="text-base font-mono font-black text-emerald-400">
                {grossSalary.toFixed(3)} OMR
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border border-border/50 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Basic Salary</span>
              <span className="text-sm font-mono font-bold text-foreground">{basicSalary.toFixed(3)} OMR</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Housing Allowance</span>
              <span className="text-sm font-mono font-bold text-foreground">{housing.toFixed(3)} OMR</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Transport Allowance</span>
              <span className="text-sm font-mono font-bold text-foreground">{transport.toFixed(3)} OMR</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Other Allowances</span>
              <span className="text-sm font-mono font-bold text-foreground">{other.toFixed(3)} OMR</span>
            </div>
          </div>

          {/* WPS Banking Compliance */}
          <div className="p-4 bg-primary/[0.03] border border-primary/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Landmark size={14} /> Oman WPS Banking Compliance (Salary Transfer)
              </span>
              <span className="text-[10px] text-muted-foreground">Ministry of Labor Compliant</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Bank Name</span>
                <span className="font-bold text-foreground">{employee.bank_name || 'Bank Muscat / Bank Dhofar'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">IBAN Number</span>
                <span className="font-mono font-bold text-foreground select-all">
                  {employee.bank_iban || 'OM — Not recorded'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Account Number</span>
                <span className="font-mono font-medium text-foreground select-all">
                  {employee.bank_account_number || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
