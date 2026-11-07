import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Landmark, DollarSign, Users, Calendar, Clock, AlertTriangle,
  CheckCircle2, XCircle, FileText, ExternalLink, Filter, Search,
  Download, Shield, Eye, Award, Sparkles, Building2, Briefcase,
  ChevronRight, ArrowUpRight, Plus, RefreshCw, X, AlertCircle,
  FileCheck, ShieldAlert, UserCheck, Phone, Check, ArrowRight,
  Printer, UploadCloud, TrendingUp, Paperclip, BarChart3, PieChart as PieChartIcon,
  CheckSquare
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
  CartesianGrid
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { useHRAdminAudit, type SalesAuditItem, type GovOutflowItem } from '../../hooks/employee/useHRAdminAudit';
import { useLeaveRequests, useReviewLeaveRequest, useSubmitLeaveRequest, useAttendanceLogs, useLogAttendance } from '../../hooks/employee/useHRManagement';
import { useAdminEmployees } from '../../hooks/admin/useAdminEmployees';
import EditEmployeeSlideOver from '../../components/admin/EditEmployeeSlideOver';
import { format, parseISO, isToday, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type MasterTab = 'dashboard' | 'sales' | 'gov_outflows' | 'team' | 'leaves_attendance';
type TimeframePreset = 'today' | 'week' | 'month' | 'all';

interface HRAdminPortalProps {
  pageMode?: MasterTab;
}

export default function HRAdminPortal({ pageMode }: HRAdminPortalProps = {}) {
  const [searchParams] = useSearchParams();
  const queryTab = searchParams.get('tab') as MasterTab | null;
  const { profile, role } = useAuth();
  const { branches } = useBranch();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const isPrivileged = role === 'admin' || profile?.is_manager || profile?.department === 'hr';

  // Filters state
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(profile?.branch_id || null);
  const [internalActiveTab, setInternalActiveTab] = useState<MasterTab>(pageMode || queryTab || 'dashboard');

  const activeTab = pageMode || internalActiveTab;
  const setActiveTab = (tab: MasterTab) => setInternalActiveTab(tab);

  React.useEffect(() => {
    if (pageMode) {
      setInternalActiveTab(pageMode);
    } else if (queryTab) {
      setInternalActiveTab(queryTab);
    }
  }, [pageMode, queryTab]);

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          badge: isRtl ? 'لوحة التحكم والتحليلات' : 'Executive Analytics',
          title: isRtl ? 'لوحة تحكم الموارد البشرية والإدارة' : 'HR & Administration Dashboard',
          subtitle: isRtl ? 'المؤشرات المالية الرئيسية، توزيع الرسوم الحكومية، ورادار متابعة الموظفين والامتثال' : 'Executive KPIs, ministry outflows allocation, team distribution, and compliance action radar'
        };
      case 'sales':
        return {
          badge: isRtl ? 'المبيعات والإيرادات' : 'Finance & Revenue',
          title: isRtl ? 'تدقيق سندات ومبيعات الفرع' : 'Sales & Payment Receipt Audit',
          subtitle: isRtl ? 'مراجعة سندات القبض، المدفوعات المسددة، وتنبيهات السندات غير المرفقة' : 'Audit customer payments, verify voucher slips, and track missing receipts'
        };
      case 'gov_outflows':
        return {
          badge: isRtl ? 'العمليات والمصروفات الحكومية' : 'Operations & Gov Outflows',
          title: isRtl ? 'المدفوعات الحكومية والموردين' : 'Gov & Supplier Outflow Tracker',
          subtitle: isRtl ? 'متابعة رسوم الجهات الحكومية (ROP, MOCIIP, Labour, OCCI) وحساب أرباح المعاملات' : 'Monitor ministry fee disbursements, profit margins, and verified payment slips'
        };
      case 'team':
        return {
          badge: isRtl ? 'الموارد البشرية والامتثال' : 'HR & Compliance',
          title: isRtl ? 'سجل الموظفين ورادار الامتثال' : 'Staff Directory & Expiry Radar',
          subtitle: isRtl ? 'دليل موظفي الشركة، رصيد الإجازات، والعد التنازلي لصلاحية الجوازات والإقامات' : 'Company staff profiles, leave balances, and passport/visa countdown alerts'
        };
      case 'leaves_attendance':
        return {
          badge: isRtl ? 'الموارد البشرية والإجازات' : 'HR & Attendance',
          title: isRtl ? 'إدارة الإجازات وسجل الحضور' : 'Staff Leaves & Attendance Management',
          subtitle: isRtl ? 'موافقة طلبات الإجازة، سجل الحضور والانصراف، والملخص الشهري للموظفين' : 'Review leave requests, daily clock-in records, and monthly leave summaries'
        };
      default:
        return {
          badge: isRtl ? 'الرقابة الإدارية والمالية' : 'Executive Governance Hub',
          title: isRtl ? 'بوابة الموارد البشرية والإدارة' : 'HR & Administration Portal',
          subtitle: isRtl ? 'الرقابة الشاملة على المبيعات، المدفوعات الحكومية، شؤون الموظفين والإجازات' : 'Comprehensive oversight of sales revenue, government fees, staff compliance, and leaves'
        };
    }
  };

  const headerInfo = getHeaderInfo();
  const [timeframe, setTimeframe] = useState<TimeframePreset>('month');
  const [searchQuery, setSearchQuery] = useState('');

  // Sub-filters for tabs
  const [salesReceiptFilter, setSalesReceiptFilter] = useState<'all' | 'missing' | 'attached'>('all');
  const [govReceiptFilter, setGovReceiptFilter] = useState<'all' | 'missing' | 'attached'>('all');
  const [govEntityFilter, setGovEntityFilter] = useState<'all' | 'mol' | 'rop' | 'mociip' | 'occi' | 'other'>('all');
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'critical_15' | 'expiring_soon' | 'expired' | 'compliant'>('all');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [leavesSubTab, setLeavesSubTab] = useState<'requests' | 'attendance' | 'monthly_summary'>('requests');
  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Modals state
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [previewReceiptTitle, setPreviewReceiptTitle] = useState<string>('');
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [isSubmitLeaveOpen, setIsSubmitLeaveOpen] = useState(false);
  const [isLogAttendanceOpen, setIsLogAttendanceOpen] = useState(false);

  // Government Slip Upload Modal State
  const [attachGovTarget, setAttachGovTarget] = useState<GovOutflowItem | null>(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [actualFeeInput, setActualFeeInput] = useState<number>(0);
  const [slipFile, setSlipFile] = useState<File | null>(null);

  // Leave submission state
  const [leaveForm, setLeaveForm] = useState({
    employee_id: profile?.id || '',
    leave_type: 'annual' as 'annual' | 'sick' | 'emergency' | 'unpaid',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    days_count: 1,
    reason: ''
  });

  // Attendance log form state
  const [attendanceForm, setAttendanceForm] = useState({
    employee_id: profile?.id || '',
    date: new Date().toISOString().split('T')[0],
    check_in: '09:00',
    check_out: '18:00',
    status: 'present' as 'present' | 'late' | 'absent' | 'half_day' | 'remote',
    notes: ''
  });

  // 1. Fetch Audit Data (Sales, Receipts, Gov Outflows)
  const auditQuery = useHRAdminAudit({
    branchId: selectedBranchId
  });
  const { data: auditData, isLoading: loadingAudit, refetch: refetchAudit } = auditQuery;

  // 2. Fetch Employees for HR Directory
  const { data: employees = [], isLoading: loadingEmployees, refetch: refetchEmployees } = useAdminEmployees(selectedBranchId);

  // 3. Fetch Leaves & Attendance
  const { data: leaveRequests = [], isLoading: loadingLeaves, refetch: refetchLeaves } = useLeaveRequests({
    branchId: selectedBranchId,
    status: leaveStatusFilter
  });

  const { data: attendanceLogs = [], isLoading: loadingAttendance, refetch: refetchAttendance } = useAttendanceLogs({
    date: selectedAttendanceDate,
    branchId: selectedBranchId
  });

  const { mutateAsync: reviewLeave, isPending: isReviewingLeave } = useReviewLeaveRequest();
  const { mutateAsync: submitLeave, isPending: isSubmittingLeave } = useSubmitLeaveRequest();
  const { mutateAsync: logAttendance, isPending: isLoggingAttendance } = useLogAttendance();

  // Handlers
  const handleApproveLeave = async (req: any) => {
    if (!profile) return;
    try {
      await reviewLeave({
        id: req.id,
        status: 'approved',
        reviewerId: profile.id,
        employeeId: req.employee_id,
        daysCount: req.days_count,
        leaveType: req.leave_type
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectLeave = async (req: any) => {
    if (!profile) return;
    const reason = window.prompt(isRtl ? 'يرجى إدخال سبب الرفض:' : 'Enter reason for rejection:');
    if (reason === null) return;
    try {
      await reviewLeave({
        id: req.id,
        status: 'rejected',
        reviewerId: profile.id,
        rejectionReason: reason || undefined
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) {
      toast.error('Please fill in dates and employee');
      return;
    }
    const days = Math.max(1, differenceInDays(parseISO(leaveForm.end_date), parseISO(leaveForm.start_date)) + 1);
    await submitLeave({
      ...leaveForm,
      days_count: days,
      branch_id: selectedBranchId || profile?.branch_id
    });
    setIsSubmitLeaveOpen(false);
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceForm.employee_id || !attendanceForm.date) {
      toast.error('Select employee and date');
      return;
    }
    await logAttendance({
      employee_id: attendanceForm.employee_id,
      date: attendanceForm.date,
      check_in: attendanceForm.check_in ? `${attendanceForm.date}T${attendanceForm.check_in}:00` : null,
      check_out: attendanceForm.check_out ? `${attendanceForm.date}T${attendanceForm.check_out}:00` : null,
      status: attendanceForm.status,
      notes: attendanceForm.notes || undefined,
      branch_id: selectedBranchId || profile?.branch_id
    });
    setIsLogAttendanceOpen(false);
  };

  // Filtered Sales List
  const filteredSales = useMemo(() => {
    const list = auditData?.sales || [];
    return list.filter(item => {
      if (salesReceiptFilter === 'missing' && item.hasReceipt) return false;
      if (salesReceiptFilter === 'attached' && !item.hasReceipt) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchClient = item.clientName.toLowerCase().includes(q);
        const matchService = item.serviceType.toLowerCase().includes(q);
        const matchRep = item.salesRepName.toLowerCase().includes(q);
        const matchCode = item.jobCode.toLowerCase().includes(q);
        if (!matchClient && !matchService && !matchRep && !matchCode) return false;
      }
      return true;
    });
  }, [auditData?.sales, salesReceiptFilter, searchQuery]);

  // Filtered Gov Outflows List
  const filteredGovOutflows = useMemo(() => {
    const list = auditData?.govOutflows || [];
    return list.filter(item => {
      if (govReceiptFilter === 'missing' && item.hasGovReceipt) return false;
      if (govReceiptFilter === 'attached' && !item.hasGovReceipt) return false;

      // Entity Category Filter (MOL, ROP, MOCIIP, OCCI, Other)
      if (govEntityFilter !== 'all') {
        const supp = item.supplierName.toLowerCase();
        if (govEntityFilter === 'mol' && !supp.includes('labour') && !supp.includes('labor') && !supp.includes('mol')) return false;
        if (govEntityFilter === 'rop' && !supp.includes('rop') && !supp.includes('police')) return false;
        if (govEntityFilter === 'mociip' && !supp.includes('moci') && !supp.includes('commerce') && !supp.includes('invest in oman')) return false;
        if (govEntityFilter === 'occi' && !supp.includes('occi') && !supp.includes('chamber')) return false;
        if (govEntityFilter === 'other' && (supp.includes('mol') || supp.includes('rop') || supp.includes('moci') || supp.includes('occi') || supp.includes('labour') || supp.includes('police'))) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchClient = item.clientName.toLowerCase().includes(q);
        const matchSupplier = item.supplierName.toLowerCase().includes(q);
        const matchService = item.serviceName.toLowerCase().includes(q);
        const matchCode = item.jobCode.toLowerCase().includes(q);
        if (!matchClient && !matchSupplier && !matchService && !matchCode) return false;
      }
      return true;
    });
  }, [auditData?.govOutflows, govReceiptFilter, govEntityFilter, searchQuery]);

  // Document Expiry Radar Statistics
  const complianceStats = useMemo(() => {
    const now = new Date();
    let expiredCount = 0;
    let critical15Count = 0;
    let warning30Count = 0;
    let compliantCount = 0;

    employees.forEach(emp => {
      let minDays: number | null = null;
      [emp.visa_expiry, emp.civil_id_expiry, emp.passport_expiry].forEach(d => {
        if (d) {
          try {
            const diff = differenceInDays(parseISO(d), now);
            if (minDays === null || diff < minDays) minDays = diff;
          } catch {}
        }
      });

      if (minDays !== null) {
        if (minDays < 0) expiredCount++;
        else if (minDays <= 15) critical15Count++;
        else if (minDays <= 30) warning30Count++;
        else compliantCount++;
      } else {
        compliantCount++;
      }
    });

    return { expiredCount, critical15Count, warning30Count, compliantCount };
  }, [employees]);

  // Filtered Employees with Expiry Analysis
  const teamWithCompliance = useMemo(() => {
    const now = new Date();
    return employees.map(emp => {
      let expiryWarning = false;
      let expired = false;
      let minDays: number | null = null;

      const checkDate = (dStr?: string | null) => {
        if (!dStr) return null;
        try {
          const diff = differenceInDays(parseISO(dStr), now);
          if (minDays === null || diff < minDays) minDays = diff;
          if (diff < 0) expired = true;
          else if (diff <= 30) expiryWarning = true;
          return diff;
        } catch {
          return null;
        }
      };

      const visaDays = checkDate(emp.visa_expiry);
      const civilIdDays = checkDate(emp.civil_id_expiry);
      const passportDays = checkDate(emp.passport_expiry);

      return {
        ...emp,
        visaDays,
        civilIdDays,
        passportDays,
        minDays,
        hasComplianceIssue: expired || expiryWarning,
        isExpired: expired
      };
    }).filter(emp => {
      if (complianceFilter === 'critical_15' && (emp.minDays === null || emp.minDays < 0 || emp.minDays > 15)) return false;
      if (complianceFilter === 'expiring_soon' && (emp.minDays === null || emp.minDays < 0 || emp.minDays > 30)) return false;
      if (complianceFilter === 'expired' && (emp.minDays === null || emp.minDays >= 0)) return false;
      if (complianceFilter === 'compliant' && emp.minDays !== null && emp.minDays <= 30) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (emp.full_name || '').toLowerCase().includes(q);
        const matchDept = (emp.department || '').toLowerCase().includes(q);
        const matchTitle = (emp.job_title || '').toLowerCase().includes(q);
        if (!matchName && !matchDept && !matchTitle) return false;
      }
      return true;
    });
  }, [employees, complianceFilter, searchQuery]);

  // Monthly Leave Summary per Staff Member
  const monthlyLeaveSummary = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return employees.map(emp => {
      const empRequests = leaveRequests.filter(r => r.employee_id === emp.id && r.status === 'approved');
      
      let takenThisMonth = 0;
      let takenThisYear = 0;

      empRequests.forEach(r => {
        try {
          const s = parseISO(r.start_date);
          const days = Number(r.days_count) || 1;
          if (s.getFullYear() === currentYear) {
            takenThisYear += days;
            if (s.getMonth() === currentMonth) {
              takenThisMonth += days;
            }
          }
        } catch {}
      });

      const initialBalance = emp.leave_balance ?? 30;
      const remainingBalance = Math.max(0, initialBalance - takenThisYear);

      return {
        employee: emp,
        annualBalance: initialBalance,
        takenThisMonth,
        takenThisYear,
        remainingBalance
      };
    });
  }, [employees, leaveRequests]);

  // Charts & Analytics Data for Dashboard
  const financialChartData = useMemo(() => {
    const totalSales = auditData?.kpis.totalSalesRevenue || 0;
    const totalGov = auditData?.kpis.totalGovFeesPaid || 0;
    const totalMargin = auditData?.kpis.totalWorkFees || 0;

    return [
      { name: isRtl ? 'المبيعات' : 'Sales Revenue', amount: Number(totalSales.toFixed(3)), fill: '#10b981' },
      { name: isRtl ? 'الرسوم الحكومية' : 'Gov Outflows', amount: Number(totalGov.toFixed(3)), fill: '#3b82f6' },
      { name: isRtl ? 'صافي الأرباح' : 'Work Margins', amount: Number(totalMargin.toFixed(3)), fill: '#eab308' },
    ];
  }, [auditData, isRtl]);

  const ministryDistributionData = useMemo(() => {
    const map: Record<string, number> = {
      MOL: 0,
      ROP: 0,
      MOCIIP: 0,
      OCCI: 0,
      Other: 0
    };
    (auditData?.govOutflows || []).forEach(item => {
      const cat = item.category || 'Other';
      const fee = Number(item.actualPaidGovFee || item.estimatedGovFee || 0);
      if (map[cat] !== undefined) {
        map[cat] += fee;
      } else {
        map['Other'] += fee;
      }
    });

    const colors: Record<string, string> = {
      MOL: '#ef4444',
      ROP: '#3b82f6',
      MOCIIP: '#10b981',
      OCCI: '#eab308',
      Other: '#a855f7'
    };

    const res = Object.keys(map).map(key => ({
      name: key,
      value: Number(map[key].toFixed(3)),
      fill: colors[key] || '#94a3b8'
    })).filter(item => item.value > 0);

    return res.length > 0 ? res : [
      { name: 'ROP', value: 1, fill: '#3b82f6' },
      { name: 'MOL', value: 1, fill: '#ef4444' },
      { name: 'MOCIIP', value: 1, fill: '#10b981' },
      { name: 'OCCI', value: 1, fill: '#eab308' }
    ];
  }, [auditData]);

  const departmentDistributionData = useMemo(() => {
    const deptCount: Record<string, number> = {};
    employees.forEach(emp => {
      const d = (emp.department || 'Staff').toUpperCase();
      deptCount[d] = (deptCount[d] || 0) + 1;
    });

    const colors = ['#eab308', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f97316'];
    const keys = Object.keys(deptCount);
    return keys.map((dept, idx) => ({
      name: dept,
      count: deptCount[dept],
      fill: colors[idx % colors.length]
    }));
  }, [employees]);

  // Urgent Action items for Dashboard Radar
  const pendingLeavesList = useMemo(() => {
    return leaveRequests.filter(r => r.status === 'pending').slice(0, 5);
  }, [leaveRequests]);

  const urgentExpiryList = useMemo(() => {
    return teamWithCompliance
      .filter(e => e.minDays !== null && e.minDays <= 30)
      .sort((a, b) => (a.minDays || 0) - (b.minDays || 0))
      .slice(0, 5);
  }, [teamWithCompliance]);

  const missingSlipsList = useMemo(() => {
    return (auditData?.sales || []).filter(s => !s.hasReceipt).slice(0, 5);
  }, [auditData]);

  // Attach Official Government Payment Slip
  const handleAttachGovSlip = async () => {
    if (!attachGovTarget || !slipFile) {
      toast.error(isRtl ? 'يرجى اختيار ملف الإيصال الحكومي' : 'Please select an official payment voucher file.');
      return;
    }
    setUploadingSlip(true);
    try {
      const ext = slipFile.name.split('.').pop() || 'pdf';
      const filePath = `gov_receipts/${attachGovTarget.id}_${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, slipFile, { upsert: true });
      if (uploadError) throw uploadError;

      // Update job_services
      if (!attachGovTarget.id.startsWith('walkin-')) {
        await supabase
          .from('job_services')
          .update({
            gov_receipt_url: filePath,
            gov_fee_actual_paid: actualFeeInput || attachGovTarget.estimatedGovFee,
            gov_payment_status: 'paid',
            gov_paid_at: new Date().toISOString()
          })
          .eq('id', attachGovTarget.id);
      }

      toast.success(isRtl ? 'تم رفع وتوثيق الإيصال الحكومي بنجاح' : 'Official Government Slip uploaded and verified successfully!');
      setAttachGovTarget(null);
      setSlipFile(null);
      refetchAudit();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to upload government voucher');
    } finally {
      setUploadingSlip(false);
    }
  };

  // 1-Click Print & PDF Executive Board Review
  const handlePrintBoardReview = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (activeTab === 'sales') {
      const headers = ['Date', 'Job Code', 'Client Name', 'Service', 'Total OMR', 'Advance OMR', 'Remaining OMR', 'Receipt Attached', 'Sales Rep', 'Branch'];
      const rows = filteredSales.map(s => [
        s.date ? format(parseISO(s.date), 'dd/MM/yyyy') : '',
        s.jobCode,
        `"${s.clientName.replace(/"/g, '""')}"`,
        `"${s.serviceType.replace(/"/g, '""')}"`,
        s.totalAmount.toFixed(3),
        s.advanceAmount.toFixed(3),
        s.remainingAmount.toFixed(3),
        s.hasReceipt ? 'YES' : 'MISSING',
        `"${s.salesRepName}"`,
        `"${s.branchName || ''}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `sales_audit_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (activeTab === 'gov_outflows') {
      const headers = ['Date', 'Job Code', 'Client Name', 'Service', 'Supplier / Ministry', 'Deal Fee OMR', 'Estimated Gov Fee', 'Actual Paid Fee', 'Work Margin OMR', 'Gov Voucher Attached', 'Ops Rep'];
      const rows = filteredGovOutflows.map(g => [
        g.date ? format(parseISO(g.date), 'dd/MM/yyyy') : '',
        g.jobCode,
        `"${g.clientName.replace(/"/g, '""')}"`,
        `"${g.serviceName.replace(/"/g, '""')}"`,
        `"${g.supplierName}"`,
        g.dealFee.toFixed(3),
        g.estimatedGovFee.toFixed(3),
        g.actualPaidGovFee.toFixed(3),
        g.workFeeMargin.toFixed(3),
        g.hasGovReceipt ? 'YES' : 'MISSING',
        `"${g.opsRepName}"`
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `gov_outflows_margins_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (activeTab === 'team') {
      const headers = ['Code', 'Full Name', 'Department', 'Job Title', 'Email', 'Phone', 'Leave Balance', 'Basic Salary OMR', 'Visa Expiry', 'Civil ID Expiry', 'Passport Expiry'];
      const rows = teamWithCompliance.map(emp => [
        emp.employee_code || '',
        `"${(emp.full_name || '').replace(/"/g, '""')}"`,
        emp.department || '',
        `"${(emp.job_title || '').replace(/"/g, '""')}"`,
        emp.email || '',
        emp.phone || '',
        emp.leave_balance ?? 30,
        (Number(emp.basic_salary) || 0).toFixed(3),
        emp.visa_expiry || 'N/A',
        emp.civil_id_expiry || 'N/A',
        emp.passport_expiry || 'N/A'
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `team_compliance_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (activeTab === 'leaves_attendance') {
      const headers = ['Staff Name', 'Department', 'Annual Balance', 'Leaves Taken This Month', 'Leaves Taken This Year', 'Remaining Leave Days'];
      const rows = monthlyLeaveSummary.map(m => [
        `"${(m.employee.full_name || '').replace(/"/g, '""')}"`,
        m.employee.department || '',
        m.annualBalance,
        m.takenThisMonth,
        m.takenThisYear,
        m.remainingBalance
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `monthly_leave_summary_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-24 px-4 sm:px-6 pt-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* ─── 1. Header & Branch Navigation ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
              <Landmark size={12} />
              {headerInfo.badge}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-medium">
              {headerInfo.subtitle}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-syne font-bold text-foreground tracking-tight flex items-center gap-3">
            {headerInfo.title}
          </h1>
        </div>

        {/* Global Action & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Filter */}
          {branches && branches.length > 1 && isPrivileged && (
            <div className="flex items-center gap-1.5 bg-card border border-border/80 px-3 py-1.5 rounded-xl shadow-sm">
              <Building2 size={14} className="text-primary" />
              <select
                value={selectedBranchId || ''}
                onChange={e => setSelectedBranchId(e.target.value || null)}
                className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer"
              >
                <option value="" className="bg-card text-foreground">{isRtl ? 'جميع الفروع' : 'All Branches'}</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id} className="bg-card text-foreground">{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Leave Request Modal Button */}
          <button
            onClick={() => setIsSubmitLeaveOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-card border border-border/80 hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus size={14} className="text-primary" />
            <span>{isRtl ? 'طلب إجازة' : 'Request Leave'}</span>
          </button>

          {/* Quick Attendance Check-in Button */}
          <button
            onClick={() => setIsLogAttendanceOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-card border border-border/80 hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Clock size={14} className="text-blue-400" />
            <span>{isRtl ? 'تسجيل الحضور' : 'Log Attendance'}</span>
          </button>

          {/* Print / PDF Board Review */}
          <button
            onClick={handlePrintBoardReview}
            className="px-3.5 py-2 rounded-xl bg-card border border-border/80 hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1.5 transition-all shadow-sm"
            title="Print or Save as PDF for Board / Audit Review"
          >
            <Printer size={14} className="text-amber-400" />
            <span>{isRtl ? 'تقرير الإدارة / PDF' : 'Board Review / PDF'}</span>
          </button>

          {/* Export Report */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center gap-1.5 transition-all shadow-md shadow-primary/20"
          >
            <Download size={14} />
            <span>{isRtl ? 'تصدير البيانات' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* ─── Navigation Master Tabs (Only shown when not in dedicated single pageMode) ─── */}
      {!pageMode ? (
        <div className="flex items-center justify-between gap-4 border-b border-border/80 overflow-x-auto no-scrollbar pt-2">
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === 'dashboard'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <BarChart3 size={15} />
              <span>{isRtl ? 'لوحة المتابعة والتحليلات' : 'Executive Overview'}</span>
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === 'sales'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <DollarSign size={15} />
              <span>{isRtl ? 'تدقيق المبيعات وسندات القبض' : 'Sales & Receipt Audit'}</span>
              {(auditData?.kpis.salesMissingReceipt ?? 0) > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500 text-white">
                  {auditData?.kpis.salesMissingReceipt}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('gov_outflows')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === 'gov_outflows'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Building2 size={15} />
              <span>{isRtl ? 'المدفوعات الحكومية والجهات' : 'Gov & Supplier Outflows'}</span>
            </button>

            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === 'team'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Users size={15} />
              <span>{isRtl ? 'سجل الموظفين والامتثال' : 'Team Directory & Expiry Radar'}</span>
            </button>

            <button
              onClick={() => setActiveTab('leaves_attendance')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${
                activeTab === 'leaves_attendance'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-black'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Calendar size={15} />
              <span>{isRtl ? 'الإجازات والحضور' : 'Leaves & Attendance'}</span>
            </button>
          </div>

          {/* Global Search Box */}
          <div className="relative w-full max-w-xs shrink-0 hidden sm:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={isRtl ? 'بحث بالعميل أو الخدمة أو الموظف...' : 'Search client, service, staff...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-card border border-border/80 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              OSBIC {headerInfo.badge}
            </span>
          </div>

          {/* Dedicated Search Box */}
          <div className="relative w-full max-w-xs shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={isRtl ? 'بحث في هذا السجل...' : 'Search this module...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-card border border-border/80 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 0: EXECUTIVE DASHBOARD & CHARTS (Only on Main Dashboard) ────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Executive KPI Bar */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Total Sales */}
            <div 
              onClick={() => setActiveTab('sales')}
              className="p-4 rounded-2xl bg-card border border-border/80 hover:border-emerald-500/40 transition-all cursor-pointer space-y-1 shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'إجمالي المبيعات' : 'Sales Logged'}</span>
                <DollarSign size={15} className="text-emerald-400" />
              </div>
              <p className="text-xl font-bold font-syne text-foreground">{auditData?.kpis.totalSalesCount ?? 0}</p>
              <p className="text-[10px] text-emerald-400 font-mono font-semibold">OMR {(auditData?.kpis.totalSalesRevenue ?? 0).toFixed(3)}</p>
            </div>

            {/* 2. Missing Slip Watchdog */}
            <div 
              onClick={() => {
                setActiveTab('sales');
                setSalesReceiptFilter('missing');
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1 shadow-sm ${
                (auditData?.kpis.salesMissingReceipt ?? 0) > 0
                  ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20'
                  : 'bg-card border-border/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                  {(auditData?.kpis.salesMissingReceipt ?? 0) > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                  {isRtl ? 'سندات غير مرفقة' : 'Missing Slip'}
                </span>
                <AlertTriangle size={15} className="text-rose-400" />
              </div>
              <p className="text-xl font-bold font-syne text-rose-400">{auditData?.kpis.salesMissingReceipt ?? 0}</p>
              <p className="text-[10px] text-muted-foreground font-medium">{auditData?.kpis.salesWithReceipt ?? 0} {isRtl ? 'سند معتمد' : 'slips verified'}</p>
            </div>

            {/* 3. Gov Outflows */}
            <div 
              onClick={() => setActiveTab('gov_outflows')}
              className="p-4 rounded-2xl bg-card border border-border/80 hover:border-blue-500/40 transition-all cursor-pointer space-y-1 shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'الرسوم الحكومية' : 'Gov Outflows'}</span>
                <Building2 size={15} className="text-blue-400" />
              </div>
              <p className="text-xl font-bold font-syne text-foreground">OMR {(auditData?.kpis.totalGovFeesPaid ?? 0).toFixed(3)}</p>
              <p className="text-[10px] text-blue-400 font-medium">{auditData?.govOutflows.length ?? 0} {isRtl ? 'معاملة حكومية' : 'gov transactions'}</p>
            </div>

            {/* 4. Net Work Fees */}
            <div 
              onClick={() => setActiveTab('gov_outflows')}
              className="p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/40 transition-all cursor-pointer space-y-1 shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'أتعاب المكتب الصافية' : 'Work Fees'}</span>
                <Sparkles size={15} className="text-primary" />
              </div>
              <p className="text-xl font-bold font-syne text-primary">OMR {(auditData?.kpis.totalWorkFees ?? 0).toFixed(3)}</p>
              <p className="text-[10px] text-muted-foreground">{isRtl ? 'صافي هامش الربح' : 'Net office margin'}</p>
            </div>

            {/* 5. Total Staff */}
            <div 
              onClick={() => setActiveTab('team')}
              className="p-4 rounded-2xl bg-card border border-border/80 hover:border-purple-500/40 transition-all cursor-pointer space-y-1 shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'فريق العمل' : 'Staff Members'}</span>
                <Users size={15} className="text-purple-400" />
              </div>
              <p className="text-xl font-bold font-syne text-foreground">{employees.length}</p>
              <p className="text-[10px] text-purple-400 font-medium">{isRtl ? 'جميع الأقسام' : 'All departments'}</p>
            </div>

            {/* 6. Leave Requests Pending */}
            <div 
              onClick={() => setActiveTab('leaves_attendance')}
              className="p-4 rounded-2xl bg-card border border-border/80 hover:border-amber-500/40 transition-all cursor-pointer space-y-1 shadow-sm"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'طلبات الإجازة' : 'Leave Requests'}</span>
                <Calendar size={15} className="text-amber-400" />
              </div>
              <p className="text-xl font-bold font-syne text-amber-400">{leaveRequests.filter(r => r.status === 'pending').length}</p>
              <p className="text-[10px] text-muted-foreground">{isRtl ? 'بانتظار موافقة الإدارة' : 'pending approval'}</p>
            </div>
          </div>

          {/* Interactive Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Chart 1: Financial Performance BarChart */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BarChart3 size={16} className="text-primary" />
                    <span>{isRtl ? 'التدفق المالي وهوامش الأرباح' : 'Financial Flow & Margins'}</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isRtl ? 'مقارنة المبيعات بالرسوم الحكومية والأرباح الصافية' : 'Sales vs Ministry Outflows vs Work Margins (OMR)'}
                  </p>
                </div>
              </div>

              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                      formatter={(value: any) => [`OMR ${Number(value).toFixed(3)}`, 'Amount']}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {financialChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-around border-t border-border/40 pt-3 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground">{isRtl ? 'المبيعات' : 'Sales'}</p>
                  <p className="text-xs font-bold text-emerald-400 font-mono">OMR {(auditData?.kpis.totalSalesRevenue || 0).toFixed(3)}</p>
                </div>
                <div className="h-6 w-px bg-border/40" />
                <div>
                  <p className="text-[10px] text-muted-foreground">{isRtl ? 'الرسوم الحكومية' : 'Gov Fees'}</p>
                  <p className="text-xs font-bold text-blue-400 font-mono">OMR {(auditData?.kpis.totalGovFeesPaid || 0).toFixed(3)}</p>
                </div>
                <div className="h-6 w-px bg-border/40" />
                <div>
                  <p className="text-[10px] text-muted-foreground">{isRtl ? 'هامش المكتب' : 'Work Margin'}</p>
                  <p className="text-xs font-bold text-primary font-mono">OMR {(auditData?.kpis.totalWorkFees || 0).toFixed(3)}</p>
                </div>
              </div>
            </div>

            {/* Chart 2: Ministry Disbursements PieChart */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Building2 size={16} className="text-blue-400" />
                    <span>{isRtl ? 'توزيع الرسوم الحكومية حسب الجهة' : 'Gov Outflows by Entity'}</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isRtl ? 'الشرطة، العمل، التجارة والصناعة، والغرفة' : 'Disbursements to ROP, MOL, MOCIIP, OCCI'}
                  </p>
                </div>
              </div>

              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ministryDistributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {ministryDistributionData.map((entry, index) => (
                        <Cell key={`pie-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                      formatter={(value: any) => [`OMR ${Number(value).toFixed(3)}`, 'Disbursed']}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      wrapperStyle={{ fontSize: '10px' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="border-t border-border/40 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{isRtl ? 'إجمالي المعاملات الحكومية' : 'Total Ministry Transactions'}</span>
                <span className="font-bold text-foreground font-mono">{auditData?.govOutflows.length || 0}</span>
              </div>
            </div>

            {/* Chart 3: Staff Department Breakdown & Compliance Health */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users size={16} className="text-purple-400" />
                    <span>{isRtl ? 'توزيع الكادر البشري والامتثال' : 'Staff Departments & Health'}</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {isRtl ? 'توزيع الموظفين وصلاحية المستندات' : 'Headcount and document expiry status'}
                  </p>
                </div>
              </div>

              {/* Department breakdown meters */}
              <div className="space-y-3 py-1">
                {departmentDistributionData.slice(0, 4).map((d) => (
                  <div key={d.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{d.name}</span>
                      <span className="text-muted-foreground font-mono">{d.count} {isRtl ? 'موظف' : 'staff'} ({employees.length > 0 ? Math.round((d.count / employees.length) * 100) : 0}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all" 
                        style={{ 
                          width: `${employees.length > 0 ? Math.round((d.count / employees.length) * 100) : 0}%`,
                          backgroundColor: d.fill 
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Compliance Summary Badges */}
              <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-center">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <p className="text-[10px] text-rose-400">{isRtl ? 'منتهية' : 'Expired'}</p>
                  <p className="text-sm font-bold text-rose-400 font-mono">{complianceStats.expiredCount}</p>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[10px] text-amber-400">{isRtl ? 'أقل من 15 يوم' : '≤ 15d Critical'}</p>
                  <p className="text-sm font-bold text-amber-400 font-mono">{complianceStats.critical15Count}</p>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] text-emerald-400">{isRtl ? 'نظامية' : 'Compliant'}</p>
                  <p className="text-sm font-bold text-emerald-400 font-mono">{complianceStats.compliantCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Action Radar (Priority Items) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Missing Slips Action Card */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {isRtl ? 'تدقيق مالي عاجل' : 'Audit Attention'}
                  </span>
                  <span className="text-xs text-rose-400 font-bold">{missingSlipsList.length} {isRtl ? 'معاملة بدون سند' : 'unverified'}</span>
                </div>
                <h4 className="text-sm font-bold text-foreground">{isRtl ? 'سندات قبض مفقودة' : 'Unattached Receipt Slips'}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {missingSlipsList.length > 0 
                    ? (isRtl ? 'يوجد مبيعات مسجلة لم يقم الموظف بإرفاق سند القبض المالي المعتمد لها.' : 'Sales entries recorded without verified voucher receipts uploaded.')
                    : (isRtl ? 'جميع سندات القبض معتمدة ومرفقة بشكل ممتاز.' : 'All sales transactions have verified vouchers attached.')}
                </p>
              </div>

              {missingSlipsList.length > 0 && (
                <div className="space-y-1.5 border-t border-border/40 pt-2.5">
                  {missingSlipsList.slice(0, 2).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-muted/20">
                      <span className="font-semibold text-foreground truncate max-w-[140px]">{s.clientName}</span>
                      <span className="font-mono text-emerald-400 font-bold">OMR {s.totalAmount.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setActiveTab('sales');
                  setSalesReceiptFilter('missing');
                }}
                className="w-full py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center justify-center gap-1.5"
              >
                <span>{isRtl ? 'تدقيق سندات المبيعات الآن' : 'Review Missing Slips'}</span>
                <ArrowRight size={14} className="text-primary" />
              </button>
            </div>

            {/* Card 2: Pending Leave Requests */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    <Calendar size={12} />
                    {isRtl ? 'قرارات الإدارة' : 'HR Decisions'}
                  </span>
                  <span className="text-xs text-amber-400 font-bold">{pendingLeavesList.length} {isRtl ? 'طلب قيد الانتظار' : 'pending'}</span>
                </div>
                <h4 className="text-sm font-bold text-foreground">{isRtl ? 'طلبات الإجازة المعلقة' : 'Pending Leave Approvals'}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingLeavesList.length > 0
                    ? (isRtl ? 'طلبات إجازة من الموظفين بانتظار اعتماد أو رفض إدارة الموارد البشرية.' : 'Staff leave applications requiring managerial approval or rejection.')
                    : (isRtl ? 'لا توجد طلبات إجازة معلقة حالياً.' : 'No pending staff leave applications at this time.')}
                </p>
              </div>

              {pendingLeavesList.length > 0 && (
                <div className="space-y-2 border-t border-border/40 pt-2.5">
                  {pendingLeavesList.slice(0, 2).map((req) => (
                    <div key={req.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-muted/20">
                      <div>
                        <p className="font-bold text-foreground">{req.employee?.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{req.leave_type} ({req.days_count}d)</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleApproveLeave(req)}
                          disabled={isReviewingLeave}
                          className="px-2 py-1 rounded-md bg-emerald-500 text-white font-bold text-[10px] hover:bg-emerald-600"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectLeave(req)}
                          disabled={isReviewingLeave}
                          className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 font-bold text-[10px] hover:bg-rose-500/20"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setActiveTab('leaves_attendance');
                  setLeavesSubTab('requests');
                }}
                className="w-full py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center justify-center gap-1.5"
              >
                <span>{isRtl ? 'عرض سجل الإجازات' : 'Manage All Leaves'}</span>
                <ArrowRight size={14} className="text-primary" />
              </button>
            </div>

            {/* Card 3: Document Expiry Radar */}
            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                    <Clock size={12} />
                    {isRtl ? 'إنذار الصلاحية' : 'Expiry Radar'}
                  </span>
                  <span className="text-xs text-blue-400 font-bold">{urgentExpiryList.length} {isRtl ? 'مستند قريب الانتهاء' : 'approaching'}</span>
                </div>
                <h4 className="text-sm font-bold text-foreground">{isRtl ? 'انتهاء الجوازات والإقامات' : 'Visa & Passport Expiry Watch'}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {urgentExpiryList.length > 0
                    ? (isRtl ? 'تنبيه استباقي لتجديد وثائق الموظفين المنتهية أو التي تقترب من 30 يوماً.' : 'Alerts for staff documents expiring within 30 days to avoid gov fines.')
                    : (isRtl ? 'جميع وثائق الموظفين سارية ومطابقة للمواصفات.' : 'All staff legal documents are current and compliant.')}
                </p>
              </div>

              {urgentExpiryList.length > 0 && (
                <div className="space-y-1.5 border-t border-border/40 pt-2.5">
                  {urgentExpiryList.slice(0, 2).map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-muted/20">
                      <div>
                        <p className="font-bold text-foreground">{emp.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{emp.job_title || emp.department}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        (emp.minDays || 0) < 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {(emp.minDays || 0) < 0 ? 'Expired' : `${emp.minDays}d left`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  setActiveTab('team');
                  setComplianceFilter('critical_15');
                }}
                className="w-full py-2 rounded-xl bg-card border border-border hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center justify-center gap-1.5"
              >
                <span>{isRtl ? 'فتح رادار الامتثال' : 'Inspect Expiry Radar'}</span>
                <ArrowRight size={14} className="text-primary" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 1: SALES & FINANCE AUDIT ───────────────────────────────────── */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          {/* Dedicated Sales Audit KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'إجمالي المبيعات' : 'Sales Logged'}</span>
                <DollarSign size={16} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black font-syne text-foreground">{auditData?.kpis.totalSalesCount ?? 0}</p>
              <p className="text-[11px] text-emerald-400 font-mono font-bold">OMR {(auditData?.kpis.totalSalesRevenue ?? 0).toFixed(3)}</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'سندات معتمدة' : 'Verified Receipts'}</span>
                <CheckCircle2 size={16} className="text-blue-400" />
              </div>
              <p className="text-2xl font-black font-syne text-blue-400">{auditData?.kpis.salesWithReceipt ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">{isRtl ? 'سند قبض مؤكد' : 'Voucher slips attached'}</p>
            </div>

            <button
              onClick={() => setSalesReceiptFilter('missing')}
              className={`p-4 rounded-2xl border text-left transition-all space-y-1 shadow-sm ${
                (auditData?.kpis.salesMissingReceipt ?? 0) > 0
                  ? 'bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20'
                  : 'bg-card border-border/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  {(auditData?.kpis.salesMissingReceipt ?? 0) > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                  {isRtl ? 'سندات غير مرفقة' : 'Missing Slips'}
                </span>
                <AlertTriangle size={16} className="text-rose-400" />
              </div>
              <p className="text-2xl font-black font-syne text-rose-400">{auditData?.kpis.salesMissingReceipt ?? 0}</p>
              <p className="text-[11px] text-rose-400/80">{isRtl ? 'اضغط لعرض النواقص' : 'Click to filter missing'}</p>
            </button>

            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'نسبة الامتثال بالسندات' : 'Slip Compliance'}</span>
                <FileCheck size={16} className="text-primary" />
              </div>
              <p className="text-2xl font-black font-syne text-primary">
                {auditData?.kpis.totalSalesCount
                  ? Math.round(((auditData.kpis.salesWithReceipt || 0) / auditData.kpis.totalSalesCount) * 100)
                  : 100}%
              </p>
              <p className="text-[11px] text-muted-foreground">{isRtl ? 'جاهزية التدقيق المالي' : 'Financial audit readiness'}</p>
            </div>
          </div>
          {/* Sub-Filters Pill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border/80">
              <button
                onClick={() => setSalesReceiptFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  salesReceiptFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'جميع المبيعات' : 'All Sales'} ({auditData?.sales.length || 0})
              </button>
              <button
                onClick={() => setSalesReceiptFilter('missing')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  salesReceiptFilter === 'missing'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <AlertTriangle size={12} />
                <span>{isRtl ? 'سند ناقص (تنبيه)' : 'Missing Receipt'}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/20 font-mono">
                  {auditData?.kpis.salesMissingReceipt || 0}
                </span>
              </button>
              <button
                onClick={() => setSalesReceiptFilter('attached')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  salesReceiptFilter === 'attached'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <CheckCircle2 size={12} />
                <span>{isRtl ? 'مرفق السند' : 'Receipt Attached'}</span>
              </button>
            </div>

            <span className="text-xs text-muted-foreground font-mono">
              {filteredSales.length} {isRtl ? 'معاملة مسجلة' : 'transactions listed'}
            </span>
          </div>

          {/* Sales Audit Table */}
          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/40 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">{isRtl ? 'التاريخ والرمز' : 'Date / Deal'}</th>
                    <th className="py-3 px-4">{isRtl ? 'العميل' : 'Customer Name'}</th>
                    <th className="py-3 px-4">{isRtl ? 'نوع الخدمة' : 'Service Type'}</th>
                    <th className="py-3 px-4 text-right">{isRtl ? 'المبلغ الإجمالي' : 'Total (OMR)'}</th>
                    <th className="py-3 px-4 text-right">{isRtl ? 'المحصل' : 'Advance / Paid'}</th>
                    <th className="py-3 px-4 text-center">{isRtl ? 'سند القبض' : 'Receipt Status'}</th>
                    <th className="py-3 px-4">{isRtl ? 'الموظف المسؤول' : 'Sales Consultant'}</th>
                    <th className="py-3 px-4 text-right">{isRtl ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground font-medium">
                        Loading financial sales audit...
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground">
                        {isRtl ? 'لا توجد مبيعات تطابق الفلتر' : 'No sales records match this filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map(item => (
                      <tr key={item.id} className="hover:bg-muted/15 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-foreground font-mono">{item.jobCode}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.date ? format(parseISO(item.date), 'dd MMM yyyy') : 'N/A'}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-foreground">{item.clientName}</p>
                          {item.companyName && (
                            <p className="text-[10px] text-muted-foreground">{item.companyName}</p>
                          )}
                          {item.clientPhone && (
                            <p className="text-[10px] text-muted-foreground/80 font-mono">{item.clientPhone}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground block max-w-xs truncate" title={item.serviceType}>
                            {item.serviceType}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Work: {item.workFee.toFixed(3)} • Gov: {item.ministryFee.toFixed(3)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                          OMR {item.totalAmount.toFixed(3)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-emerald-400 block">
                            OMR {item.advanceAmount.toFixed(3)}
                          </span>
                          {item.remainingAmount > 0 && (
                            <span className="text-[10px] text-rose-400 font-mono">
                              Due: {item.remainingAmount.toFixed(3)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.hasReceipt ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 size={11} /> {isRtl ? 'مرفق السند' : 'Receipt Uploaded'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                              <XCircle size={11} /> {isRtl ? 'غير مرفق' : 'Missing Slip'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {item.salesRepName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{item.salesRepName}</p>
                              <span className="text-[9.5px] text-muted-foreground">{item.branchName}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.hasReceipt && item.receiptUrl ? (
                            <button
                              onClick={() => {
                                setPreviewReceiptUrl(item.receiptUrl!);
                                setPreviewReceiptTitle(`Receipt: ${item.jobCode} - ${item.clientName}`);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] border border-primary/20 transition-all inline-flex items-center gap-1"
                            >
                              <Eye size={12} />
                              <span>{isRtl ? 'عرض السند' : 'View Slip'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => toast.error(`No receipt uploaded for ${item.jobCode}. Contact ${item.salesRepName} to upload.`)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[11px] border border-rose-500/20 transition-all"
                            >
                              {isRtl ? 'تنبيه الموظف' : 'Alert Rep'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: OPERATIONS & GOV / SUPPLIER OUTFLOWS ────────────────────── */}
      {activeTab === 'gov_outflows' && (
        <div className="space-y-4">
          {/* Dedicated Gov Outflow & Profit Margin KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'الرسوم الحكومية المسددة' : 'Gov Fees Paid'}</span>
                <Building2 size={16} className="text-blue-400" />
              </div>
              <p className="text-2xl font-black font-syne text-blue-400">
                OMR {(auditData?.kpis.totalGovFeesPaid ?? 0).toFixed(3)}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {auditData?.govOutflows.length ?? 0} {isRtl ? 'معاملة حكومية' : 'procedures disbursed'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'إجمالي رسوم العقود' : 'Gross Deal Fees'}</span>
                <DollarSign size={16} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black font-syne text-foreground">
                OMR {filteredGovOutflows.reduce((acc, g) => acc + g.dealFee, 0).toFixed(3)}
              </p>
              <p className="text-[11px] text-emerald-400">{isRtl ? 'قيمة مبيعات المعاملات' : 'Client contract volume'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'أتعاب المكتب الصافية' : 'Net Office Margin'}</span>
                <Sparkles size={16} className="text-primary" />
              </div>
              <p className="text-2xl font-black font-syne text-primary">
                OMR {(auditData?.kpis.totalWorkFees ?? 0).toFixed(3)}
              </p>
              <p className="text-[11px] text-muted-foreground">{isRtl ? 'صافي الربح بعد خصم الرسوم' : 'Net profit retained'}</p>
            </div>

            <button
              onClick={() => setGovReceiptFilter('missing')}
              className={`p-4 rounded-2xl border text-left transition-all space-y-1 shadow-sm ${
                filteredGovOutflows.filter(g => !g.hasGovReceipt).length > 0
                  ? 'bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20'
                  : 'bg-card border-border/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  {isRtl ? 'إيصالات ناقصة' : 'Missing Gov Slips'}
                </span>
                <AlertTriangle size={16} className="text-rose-400" />
              </div>
              <p className="text-2xl font-black font-syne text-rose-400">
                {filteredGovOutflows.filter(g => !g.hasGovReceipt).length}
              </p>
              <p className="text-[11px] text-rose-400/80">{isRtl ? 'تحتاج إرفاق إيصال الدفع' : 'Requires slip attachment'}</p>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Top Filter Bar: Receipt Status + Entity Category */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border/80">
                <button
                  onClick={() => setGovReceiptFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    govReceiptFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isRtl ? 'جميع المدفوعات' : 'All Gov Outflows'} ({auditData?.govOutflows.length || 0})
                </button>
                <button
                  onClick={() => setGovReceiptFilter('missing')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    govReceiptFilter === 'missing' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-400 hover:text-rose-300'
                  }`}
                >
                  <AlertTriangle size={12} />
                  <span>{isRtl ? 'إيصال حكومي ناقص' : 'Missing Gov Slip'}</span>
                </button>
                <button
                  onClick={() => setGovReceiptFilter('attached')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    govReceiptFilter === 'attached' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-400 hover:text-blue-300'
                  }`}
                >
                  <CheckCircle2 size={12} />
                  <span>{isRtl ? 'إيصال رسمي مرفق' : 'Gov Receipt Attached'}</span>
                </button>
              </div>

              <span className="text-xs text-muted-foreground font-mono">
                Total Outflow: OMR {(auditData?.kpis.totalGovFeesPaid || 0).toFixed(3)} • Net Profit Margin: OMR {(auditData?.kpis.netProfitMargin || 0).toFixed(3)}
              </span>
            </div>

            {/* Entity Category Filter Pills (MOL, ROP, MOCIIP, OCCI, Other) */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/20 p-1.5 rounded-xl border border-border/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">
                {isRtl ? 'الجهة الحكومية:' : 'Category / Entity:'}
              </span>
              {[
                { key: 'all', label: isRtl ? 'جميع الجهات' : 'All Entities' },
                { key: 'mociip', label: '🏢 MOCIIP (Commerce)' },
                { key: 'rop', label: '👮 ROP (Immigration)' },
                { key: 'mol', label: '👷 MOL (Labour)' },
                { key: 'occi', label: '🏛️ OCCI (Chamber)' },
                { key: 'other', label: '🌐 Sanad / Other' }
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setGovEntityFilter(cat.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    govEntityFilter === cat.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Outflow Table */}
          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-muted/40 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">{isRtl ? 'التاريخ والرمز' : 'Date / Job'}</th>
                    <th className="py-3 px-4">{isRtl ? 'العميل' : 'Customer Name'}</th>
                    <th className="py-3 px-4">{isRtl ? 'الجهة الحكومية / المورد' : 'Supplier / Ministry'}</th>
                    <th className="py-3 px-4">{isRtl ? 'الخدمة' : 'Service Type'}</th>
                    <th className="py-3 px-4 text-right">{isRtl ? 'سعر المعاملة' : 'Deal Fee'}</th>
                    <th className="py-3 px-4 text-right">{isRtl ? 'المسدد للمورد' : 'Gov Outflow'}</th>
                    <th className="py-3 px-4 text-right">{isRtl ? 'هامش الربح (Work Fee)' : 'Profit Margin'}</th>
                    <th className="py-3 px-4 text-center">{isRtl ? 'الإيصال الحكومي' : 'Gov Receipt'}</th>
                    <th className="py-3 px-4">{isRtl ? 'موظف العمليات' : 'Ops Officer'}</th>
                    <th className="py-3 px-4 text-right">{isRtl ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {loadingAudit ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground">
                        Loading government and supplier payments...
                      </td>
                    </tr>
                  ) : filteredGovOutflows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground">
                        {isRtl ? 'لا توجد مدفوعات حكومية تطابق هذا الفلتر' : 'No government outflow transactions match this filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredGovOutflows.map(item => {
                      const marginPercent = item.dealFee > 0 ? Math.round((item.workFeeMargin / item.dealFee) * 100) : 0;
                      return (
                        <tr key={item.id} className="hover:bg-muted/15 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-foreground font-mono">{item.jobCode}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.date ? format(parseISO(item.date), 'dd MMM yyyy') : 'N/A'}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-bold text-foreground">
                            {item.clientName}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {item.supplierName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground font-medium">
                            {item.serviceName}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                            OMR {item.dealFee.toFixed(3)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                            OMR {item.actualPaidGovFee.toFixed(3)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-emerald-400">OMR {item.workFeeMargin.toFixed(3)}</span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                                {marginPercent}% Margin
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {item.hasGovReceipt ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <CheckCircle2 size={11} /> {isRtl ? 'سند معتمد' : 'Voucher Uploaded'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                                <XCircle size={11} /> {isRtl ? 'بدون سند' : 'No Voucher'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {item.opsRepName}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.hasGovReceipt && item.govReceiptUrl ? (
                              <button
                                onClick={() => {
                                  setPreviewReceiptUrl(item.govReceiptUrl!);
                                  setPreviewReceiptTitle(`Gov Receipt: ${item.jobCode} - ${item.supplierName}`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-[11px] border border-blue-500/20 transition-all inline-flex items-center gap-1"
                              >
                                <Eye size={12} />
                                <span>{isRtl ? 'عرض الإيصال' : 'View Voucher'}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setAttachGovTarget(item);
                                  setActualFeeInput(item.actualPaidGovFee || item.estimatedGovFee);
                                  setSlipFile(null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-[11px] border border-primary/20 transition-all inline-flex items-center gap-1"
                              >
                                <Paperclip size={12} />
                                <span>{isRtl ? 'إرفاق السند' : 'Attach Slip'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: TEAM DIRECTORY & COMPLIANCE RADAR ───────────────────────── */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          {/* Document Expiry Countdown & Staff Headcount Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Card 0: Total Staff */}
            <button
              onClick={() => setComplianceFilter('all')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                complianceFilter === 'all'
                  ? 'bg-purple-500/15 border-purple-500 shadow-md shadow-purple-500/10'
                  : 'bg-card border-border/80 hover:border-purple-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-purple-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'إجمالي الموظفين' : 'Staff Members'}</span>
                <Users size={16} />
              </div>
              <p className="text-2xl font-black font-syne text-foreground">{employees.length}</p>
              <p className="text-[10px] text-purple-400 mt-1">{isRtl ? 'جميع الأقسام والفروع' : 'Across all branches'}</p>
            </button>

            {/* Card 1: Expired */}
            <button
              onClick={() => setComplianceFilter(complianceFilter === 'expired' ? 'all' : 'expired')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                complianceFilter === 'expired'
                  ? 'bg-rose-500/15 border-rose-500 shadow-md shadow-rose-500/10'
                  : 'bg-card border-border/80 hover:border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-rose-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'منتهية الصلاحية' : 'Expired Docs'}</span>
                <XCircle size={16} />
              </div>
              <p className="text-2xl font-black font-syne text-foreground">{complianceStats.expiredCount}</p>
              <p className="text-[10px] text-rose-400 mt-1">{isRtl ? 'تحتاج تجديد فوري' : 'Requires immediate renewal'}</p>
            </button>

            {/* Card 2: Critical <= 15 Days */}
            <button
              onClick={() => setComplianceFilter(complianceFilter === 'critical_15' ? 'all' : 'critical_15')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                complianceFilter === 'critical_15'
                  ? 'bg-amber-500/15 border-amber-500 shadow-md shadow-amber-500/10'
                  : 'bg-card border-border/80 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-amber-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'حرجة (خلال 15 يوم)' : 'Critical (≤ 15 Days)'}</span>
                <AlertTriangle size={16} />
              </div>
              <p className="text-2xl font-black font-syne text-foreground">{complianceStats.critical15Count}</p>
              <p className="text-[10px] text-amber-400 mt-1">{isRtl ? 'اقترب موعد الانتهاء' : 'Countdown under 15 days'}</p>
            </button>

            {/* Card 3: Approaching <= 30 Days */}
            <button
              onClick={() => setComplianceFilter(complianceFilter === 'expiring_soon' ? 'all' : 'expiring_soon')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                complianceFilter === 'expiring_soon'
                  ? 'bg-yellow-500/15 border-yellow-500 shadow-md shadow-yellow-500/10'
                  : 'bg-card border-border/80 hover:border-yellow-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-yellow-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'تنتهي خلال 30 يوم' : 'Approaching (≤ 30 Days)'}</span>
                <Clock size={16} />
              </div>
              <p className="text-2xl font-black font-syne text-foreground">{complianceStats.warning30Count}</p>
              <p className="text-[10px] text-yellow-400 mt-1">{isRtl ? 'إشعار مسبق للتجهيز' : 'Early preparation window'}</p>
            </button>

            {/* Card 4: Fully Compliant */}
            <button
              onClick={() => setComplianceFilter(complianceFilter === 'compliant' ? 'all' : 'compliant')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                complianceFilter === 'compliant'
                  ? 'bg-emerald-500/15 border-emerald-500 shadow-md shadow-emerald-500/10'
                  : 'bg-card border-border/80 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'سارية وصالحة' : 'Fully Compliant'}</span>
                <CheckCircle2 size={16} />
              </div>
              <p className="text-2xl font-black font-syne text-foreground">{complianceStats.compliantCount}</p>
              <p className="text-[10px] text-emerald-400 mt-1">{isRtl ? 'أكثر من 30 يوماً' : 'Safe > 30 days valid'}</p>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 bg-card p-1 rounded-xl border border-border/80">
              <button
                onClick={() => setComplianceFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  complianceFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'جميع الموظفين' : 'All Staff'} ({employees.length})
              </button>
              <button
                onClick={() => setComplianceFilter('critical_15')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  complianceFilter === 'critical_15' ? 'bg-amber-500 text-black shadow-sm font-black' : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <AlertTriangle size={12} />
                <span>{isRtl ? 'حرجة (15 يوم)' : 'Critical (15d)'}</span>
              </button>
              <button
                onClick={() => setComplianceFilter('expiring_soon')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  complianceFilter === 'expiring_soon' ? 'bg-yellow-500 text-black shadow-sm font-black' : 'text-yellow-400 hover:text-yellow-300'
                }`}
              >
                <Clock size={12} />
                <span>{isRtl ? 'تنتهي قريباً (30 يوم)' : 'Expiring Soon (30d)'}</span>
              </button>
              <button
                onClick={() => setComplianceFilter('expired')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  complianceFilter === 'expired' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <XCircle size={12} />
                <span>{isRtl ? 'منتهية الصلاحية' : 'Expired'}</span>
              </button>
            </div>

            <span className="text-xs text-muted-foreground font-mono">
              {teamWithCompliance.length} {isRtl ? 'موظف مطابق' : 'staff members listed'}
            </span>
          </div>

          {/* Employee Directory Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamWithCompliance.map(emp => (
              <div
                key={emp.id}
                className="p-5 rounded-2xl bg-card border border-border/80 hover:border-primary/40 transition-all shadow-sm space-y-4 group relative"
              >
                {/* Employee Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary font-syne text-sm shrink-0 overflow-hidden">
                      {emp.avatar_url ? (
                        <img src={emp.avatar_url} alt={emp.full_name} className="w-full h-full object-cover" />
                      ) : (
                        emp.full_name?.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                        {emp.full_name}
                      </h4>
                      <p className="text-xs text-primary font-semibold">
                        {emp.job_title || emp.department?.toUpperCase() || 'General Staff'}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {emp.employee_code || 'EMP-N/A'} • {emp.email}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setEditingEmployee(emp)}
                    className="p-2 rounded-xl bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                    title="Edit HR Details"
                  >
                    <Briefcase size={14} />
                  </button>
                </div>

                {/* Key Employment & Financial Snapshot */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/20 border border-border/40 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">{isRtl ? 'رصيد الإجازات' : 'Leave Balance'}</span>
                    <span className="font-bold font-mono text-foreground">{emp.leave_balance ?? 30} {isRtl ? 'يوم' : 'Days'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">{isRtl ? 'الراتب الأساسي' : 'Basic Salary'}</span>
                    <span className="font-bold font-mono text-emerald-400">OMR {(Number(emp.basic_salary) || 0).toFixed(3)}</span>
                  </div>
                  {emp.date_of_joining && (
                    <div className="col-span-2 pt-1 border-t border-border/30">
                      <span className="text-[10px] text-muted-foreground">{isRtl ? 'تاريخ الالتحاق:' : 'Joined:'} </span>
                      <span className="text-[11px] font-medium text-foreground">{format(parseISO(emp.date_of_joining), 'dd MMM yyyy')}</span>
                    </div>
                  )}
                </div>

                {/* Expiry Radar Compliance Badges */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {isRtl ? 'رادار صلاحية الوثائق' : 'Document Compliance Radar'}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                    <div className={`p-1.5 rounded-lg border ${
                      emp.visaDays === null ? 'bg-muted/10 border-border text-muted-foreground' :
                      emp.visaDays < 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold' :
                      emp.visaDays <= 30 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold' :
                      'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      <span className="block font-bold">Visa</span>
                      <span className="font-mono">{emp.visaDays === null ? 'N/A' : `${emp.visaDays}d`}</span>
                    </div>

                    <div className={`p-1.5 rounded-lg border ${
                      emp.civilIdDays === null ? 'bg-muted/10 border-border text-muted-foreground' :
                      emp.civilIdDays < 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold' :
                      emp.civilIdDays <= 30 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold' :
                      'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      <span className="block font-bold">Civil ID</span>
                      <span className="font-mono">{emp.civilIdDays === null ? 'N/A' : `${emp.civilIdDays}d`}</span>
                    </div>

                    <div className={`p-1.5 rounded-lg border ${
                      emp.passportDays === null ? 'bg-muted/10 border-border text-muted-foreground' :
                      emp.passportDays < 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 font-bold' :
                      emp.passportDays <= 30 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold' :
                      'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}>
                      <span className="block font-bold">Passport</span>
                      <span className="font-mono">{emp.passportDays === null ? 'N/A' : `${emp.passportDays}d`}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: LEAVES & ATTENDANCE ─────────────────────────────────────── */}
      {activeTab === 'leaves_attendance' && (
        <div className="space-y-4">
          {/* Dedicated Leaves & Attendance KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`p-4 rounded-2xl border space-y-1 shadow-sm ${
              leaveRequests.filter(r => r.status === 'pending').length > 0
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-card border-border/80'
            }`}>
              <div className="flex items-center justify-between text-amber-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'طلبات قيد المراجعة' : 'Pending Approvals'}</span>
                <Calendar size={16} />
              </div>
              <p className="text-2xl font-black font-syne text-amber-400">
                {leaveRequests.filter(r => r.status === 'pending').length}
              </p>
              <p className="text-[11px] text-muted-foreground">{isRtl ? 'بانتظار قرار الإدارة' : 'Awaiting HR review'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'إجازات معتمدة هذا الشهر' : 'Approved Leaves'}</span>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black font-syne text-emerald-400">
                {leaveRequests.filter(r => r.status === 'approved').length}
              </p>
              <p className="text-[11px] text-muted-foreground">{isRtl ? 'تمت الموافقة وتحديث الرصيد' : 'Processed applications'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'حضور اليوم المسجل' : 'Today Check-ins'}</span>
                <Clock size={16} className="text-blue-400" />
              </div>
              <p className="text-2xl font-black font-syne text-blue-400">
                {attendanceLogs.filter(l => l.status === 'present' || l.status === 'late').length} / {employees.length}
              </p>
              <p className="text-[11px] text-blue-400/80 font-mono">
                {employees.length > 0 ? Math.round((attendanceLogs.filter(l => l.status === 'present' || l.status === 'late').length / employees.length) * 100) : 0}% {isRtl ? 'نسبة الحضور' : 'attendance rate'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRtl ? 'في إجازة مصرحة اليوم' : 'On Leave Today'}</span>
                <Users size={16} className="text-purple-400" />
              </div>
              <p className="text-2xl font-black font-syne text-purple-400">
                {attendanceLogs.filter(l => l.status === 'on_leave').length}
              </p>
              <p className="text-[11px] text-muted-foreground">{isRtl ? 'موظف في إجازة معتمدة' : 'Staff members away'}</p>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLeavesSubTab('requests')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  leavesSubTab === 'requests' ? 'bg-card border border-border text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'طلبات الإجازات' : 'Leave Requests'} ({leaveRequests.length})
              </button>
              <button
                onClick={() => setLeavesSubTab('attendance')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  leavesSubTab === 'attendance' ? 'bg-card border border-border text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'سجل الحضور اليومي' : 'Daily Attendance Log'}
              </button>
              <button
                onClick={() => setLeavesSubTab('monthly_summary')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  leavesSubTab === 'monthly_summary' ? 'bg-card border border-border text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isRtl ? 'ملخص الإجازات الشهري' : 'Monthly Leave Summary'}
              </button>
            </div>

            {leavesSubTab === 'attendance' && (
              <input
                type="date"
                value={selectedAttendanceDate}
                onChange={e => setSelectedAttendanceDate(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono"
              />
            )}
          </div>

          {/* Sub Tab: Leave Requests */}
          {leavesSubTab === 'requests' && (
            <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/40 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">{isRtl ? 'الموظف' : 'Employee'}</th>
                      <th className="py-3 px-4">{isRtl ? 'نوع الإجازة' : 'Leave Type'}</th>
                      <th className="py-3 px-4">{isRtl ? 'الفترة' : 'Dates'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'عدد الأيام' : 'Days'}</th>
                      <th className="py-3 px-4">{isRtl ? 'السبب' : 'Reason'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                      <th className="py-3 px-4 text-right">{isRtl ? 'إجراء الإدارة' : 'HR Review'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {loadingLeaves ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          Loading leave requests...
                        </td>
                      </tr>
                    ) : leaveRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          {isRtl ? 'لا توجد طلبات إجازة مسجلة' : 'No leave requests submitted.'}
                        </td>
                      </tr>
                    ) : (
                      leaveRequests.map(req => (
                        <tr key={req.id} className="hover:bg-muted/15 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-foreground">{req.employee?.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{req.employee?.department || 'Staff'}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize font-semibold text-primary">
                              {req.leave_type} Leave
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">
                            {format(parseISO(req.start_date), 'dd MMM')} → {format(parseISO(req.end_date), 'dd MMM yyyy')}
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {req.days_count}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground max-w-xs truncate" title={req.reason || ''}>
                            {req.reason || 'No details provided'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              req.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                              'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {req.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleApproveLeave(req)}
                                  disabled={isReviewingLeave}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white font-bold text-[11px] hover:bg-emerald-600 transition-all flex items-center gap-1"
                                >
                                  <Check size={12} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleRejectLeave(req)}
                                  disabled={isReviewingLeave}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[11px] border border-rose-500/20 transition-all"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                {req.reviewer ? `Reviewed by ${req.reviewer.full_name}` : 'Completed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Tab: Attendance Log */}
          {leavesSubTab === 'attendance' && (
            <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/40 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">{isRtl ? 'الموظف' : 'Staff Member'}</th>
                      <th className="py-3 px-4">{isRtl ? 'القسم' : 'Department'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'وقت الدخول' : 'Check-In'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'وقت الخروج' : 'Check-Out'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                      <th className="py-3 px-4">{isRtl ? 'ملاحظات' : 'Notes'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {loadingAttendance ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          Loading attendance for {selectedAttendanceDate}...
                        </td>
                      </tr>
                    ) : attendanceLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-muted-foreground">
                          {isRtl ? 'لم يتم تسجيل حضور لهذا اليوم بعد' : 'No attendance logged for this date yet. Use "Log Attendance" above.'}
                        </td>
                      </tr>
                    ) : (
                      attendanceLogs.map(log => (
                        <tr key={log.id} className="hover:bg-muted/15 transition-colors">
                          <td className="py-3 px-4 font-bold text-foreground">
                            {log.employee?.full_name || 'Staff Member'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {log.employee?.department || 'Operations'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium">
                            {log.check_in ? format(parseISO(log.check_in), 'hh:mm a') : '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-medium">
                            {log.check_out ? format(parseISO(log.check_out), 'hh:mm a') : '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.status === 'present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              log.status === 'late' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {log.notes || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Tab: Monthly Leave Summary per Staff Member */}
          {leavesSubTab === 'monthly_summary' && (
            <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/40 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-4">{isRtl ? 'الموظف' : 'Staff Member'}</th>
                      <th className="py-3 px-4">{isRtl ? 'القسم والوظيفة' : 'Department & Role'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'رصيد الإجازات السنوي' : 'Annual Balance'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'المستهلك هذا الشهر' : 'Taken This Month'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'المستهلك هذا العام' : 'Taken This Year'}</th>
                      <th className="py-3 px-4 text-center">{isRtl ? 'الرصيد المتبقي' : 'Remaining Balance'}</th>
                      <th className="py-3 px-4 text-right">{isRtl ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {monthlyLeaveSummary.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          {isRtl ? 'لا يوجد موظفين مسجلين' : 'No staff members found.'}
                        </td>
                      </tr>
                    ) : (
                      monthlyLeaveSummary.map(m => (
                        <tr key={m.employee.id} className="hover:bg-muted/15 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-foreground">{m.employee.full_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{m.employee.email}</p>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            <span className="font-medium text-foreground capitalize block">{m.employee.department}</span>
                            <span className="text-[10px] text-muted-foreground">{m.employee.job_title || 'Staff Member'}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-foreground">
                            {m.annualBalance} {isRtl ? 'يوم' : 'Days'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">
                            {m.takenThisMonth} {isRtl ? 'يوم' : 'd'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-muted-foreground">
                            {m.takenThisYear} {isRtl ? 'يوم' : 'd'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-black text-emerald-400">
                            {m.remainingBalance} {isRtl ? 'يوم' : 'Days'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              m.remainingBalance < 5
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : m.takenThisMonth > 3
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {m.remainingBalance < 5 ? 'Low Balance' : m.takenThisMonth > 3 ? 'High Monthly' : 'Normal'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 4. Receipt Slip Preview Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {previewReceiptUrl && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewReceiptUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <FileCheck size={18} className="text-primary" />
                  {previewReceiptTitle || 'Payment Slip Verification'}
                </h3>
                <button onClick={() => setPreviewReceiptUrl(null)} className="p-1 rounded-xl hover:bg-muted text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[65vh] overflow-auto rounded-2xl bg-black/40 p-2 flex items-center justify-center">
                {previewReceiptUrl.endsWith('.pdf') ? (
                  <iframe src={previewReceiptUrl} className="w-full h-[55vh] rounded-xl border border-border" />
                ) : (
                  <img src={previewReceiptUrl} alt="Receipt proof" className="max-h-[60vh] object-contain rounded-xl shadow-md" />
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-muted-foreground">Official proof document attached to this transaction.</span>
                <a
                  href={previewReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <ExternalLink size={14} /> Open Full Size
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 5. Submit Leave Request Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {isSubmitLeaveOpen && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsSubmitLeaveOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  {isRtl ? 'تقديم طلب إجازة' : 'Submit Leave Request'}
                </h3>
                <button onClick={() => setIsSubmitLeaveOpen(false)} className="p-1 rounded-xl hover:bg-muted text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitLeave} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Employee</label>
                  <select
                    value={leaveForm.employee_id}
                    onChange={e => setLeaveForm({ ...leaveForm, employee_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-bold outline-none"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.job_title || emp.department}) - Balance: {emp.leave_balance ?? 30}d
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Leave Type</label>
                  <select
                    value={leaveForm.leave_type}
                    onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value as any })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                  >
                    <option value="annual">Annual Leave (إجازة سنوية)</option>
                    <option value="sick">Sick Leave (إجازة مرضية)</option>
                    <option value="emergency">Emergency Leave (إجازة طارئة)</option>
                    <option value="unpaid">Unpaid Leave (إجازة بدون راتب)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Start Date</label>
                    <input
                      type="date"
                      value={leaveForm.start_date}
                      onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">End Date</label>
                    <input
                      type="date"
                      value={leaveForm.end_date}
                      onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Reason / Notes</label>
                  <textarea
                    rows={2}
                    value={leaveForm.reason}
                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    placeholder="Brief description for HR..."
                    className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsSubmitLeaveOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingLeave}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
                  >
                    {isSubmittingLeave ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 6. Log Attendance Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {isLogAttendanceOpen && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setIsLogAttendanceOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                  <Clock size={18} className="text-blue-400" />
                  {isRtl ? 'تسجيل الحضور اليومي' : 'Log Attendance Entry'}
                </h3>
                <button onClick={() => setIsLogAttendanceOpen(false)} className="p-1 rounded-xl hover:bg-muted text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveAttendance} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Employee</label>
                  <select
                    value={attendanceForm.employee_id}
                    onChange={e => setAttendanceForm({ ...attendanceForm, employee_id: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-bold outline-none"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Date</label>
                    <input
                      type="date"
                      value={attendanceForm.date}
                      onChange={e => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Status</label>
                    <select
                      value={attendanceForm.status}
                      onChange={e => setAttendanceForm({ ...attendanceForm, status: e.target.value as any })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none font-bold"
                    >
                      <option value="present">Present (حاضر)</option>
                      <option value="late">Late (متأخر)</option>
                      <option value="absent">Absent (غائب)</option>
                      <option value="half_day">Half Day (نصف يوم)</option>
                      <option value="remote">Remote (عمل عن بعد)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Check In</label>
                    <input
                      type="time"
                      value={attendanceForm.check_in}
                      onChange={e => setAttendanceForm({ ...attendanceForm, check_in: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Check Out</label>
                    <input
                      type="time"
                      value={attendanceForm.check_out}
                      onChange={e => setAttendanceForm({ ...attendanceForm, check_out: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Notes</label>
                  <input
                    type="text"
                    value={attendanceForm.notes}
                    onChange={e => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                    placeholder="e.g. Authorized late arrival..."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsLogAttendanceOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoggingAttendance}
                    className="px-5 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 shadow-sm"
                  >
                    {isLoggingAttendance ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 7. Attach Official Government Slip Modal ────────────────────────── */}
      <AnimatePresence>
        {attachGovTarget && (
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setAttachGovTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                  <UploadCloud size={18} className="text-primary" />
                  {isRtl ? 'إرفاق إيصال الدفع الحكومي' : 'Attach Official Gov Slip'}
                </h3>
                <button onClick={() => setAttachGovTarget(null)} className="p-1 rounded-xl hover:bg-muted text-muted-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 bg-muted/20 border border-border/40 rounded-xl space-y-1 text-xs">
                <p className="font-bold text-foreground font-mono">{attachGovTarget.jobCode}</p>
                <p className="text-muted-foreground">{attachGovTarget.clientName} • {attachGovTarget.serviceName}</p>
                <p className="text-primary font-semibold">{attachGovTarget.supplierName}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    {isRtl ? 'المبلغ المسدد فعلياً (ر.ع)' : 'Actual Paid Fee (OMR)'}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={actualFeeInput}
                    onChange={e => setActualFeeInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">
                    {isRtl ? 'ملف الإيصال (PDF أو صورة)' : 'Voucher File (PDF or Image)'}
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => setSlipFile(e.target.files?.[0] || null)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none file:mr-3 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary file:text-primary-foreground cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAttachGovTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAttachGovSlip}
                  disabled={uploadingSlip || !slipFile}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-md shadow-primary/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UploadCloud size={14} />
                  <span>{uploadingSlip ? 'Uploading...' : 'Save & Verify Voucher'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 8. Edit Employee HR Profile SlideOver ──────────────────────────── */}
      {editingEmployee && (
        <EditEmployeeSlideOver
          isOpen={Boolean(editingEmployee)}
          onClose={() => {
            setEditingEmployee(null);
            refetchEmployees();
          }}
          employee={editingEmployee}
        />
      )}
    </div>
  );
}
