import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Calendar, Users, Clock, ArrowRight, X, ChevronDown, ChevronUp,
  Download, RefreshCw, Check, Sparkles, AlertCircle, ShieldAlert,
  UserCheck, ExternalLink, HelpCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  parseBiometricCSV,
  reconcileBiometricAttendance,
  type EmployeeMonthlySummary,
  type RawBiometricRow
} from '../../utils/biometricAttendanceParser';
import { useSaveBiometricAttendance } from '../../hooks/employee/useHRManagement';

interface BiometricAttendanceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Array<{
    id: string;
    full_name: string;
    employee_code?: string | null;
    department?: string | null;
    avatar_url?: string | null;
    branch_id?: string | null;
  }>;
  approvedLeaves?: Array<{
    id: string;
    employee_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    status: string;
  }>;
  currentUserId?: string;
  branchId?: string | null;
}

export default function BiometricAttendanceImportModal({
  isOpen,
  onClose,
  employees,
  approvedLeaves = [],
  currentUserId,
  branchId
}: BiometricAttendanceImportModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<RawBiometricRow[]>([]);
  const [summaries, setSummaries] = useState<EmployeeMonthlySummary[]>([]);
  const [expandedEmployeeBadge, setExpandedEmployeeBadge] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const saveBiometric = useSaveBiometricAttendance();

  // Reset state on close
  const handleClose = () => {
    setFileName(null);
    setRawRows([]);
    setSummaries([]);
    setExpandedEmployeeBadge(null);
    onClose();
  };

  // Process raw CSV text
  const processCSVContent = (content: string, name: string) => {
    try {
      const parsed = parseBiometricCSV(content);
      if (parsed.length === 0) {
        toast.error(isRtl ? 'لم يتم العثور على سجلات صالحة في الملف' : 'No valid attendance records found in file');
        return;
      }
      setFileName(name);
      setRawRows(parsed);
      const reconciled = reconcileBiometricAttendance(parsed, employees, approvedLeaves);
      setSummaries(reconciled);
      toast.success(
        isRtl
          ? `تم استخراج بيانات ${reconciled.length} موظف بنجاح!`
          : `Extracted attendance for ${reconciled.length} employees!`
      );
    } catch (err: any) {
      console.error('CSV Parsing Error:', err);
      toast.error(err.message || 'Failed to parse biometric file');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSVContent(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCSVContent(text, file.name);
    };
    reader.readAsText(file);
  };

  // Allow manual profile remapping
  const handleRemapEmployee = (badge: string, profileId: string) => {
    const matchedProfile = employees.find(e => e.id === profileId);
    setSummaries(prev =>
      prev.map(s => {
        if (s.employeeBadge === badge) {
          return {
            ...s,
            matchedProfileId: profileId,
            employeeName: matchedProfile?.full_name || s.employeeName,
            department: matchedProfile?.department || s.department
          };
        }
        return s;
      })
    );
  };

  // Aggregate stats
  const totalEmployees = summaries.length;
  const matchedCount = summaries.filter(s => !!s.matchedProfileId).length;
  const unmatchedCount = totalEmployees - matchedCount;
  const totalMissingPunches = summaries.reduce((acc, s) => acc + s.missingPunchesCount, 0);
  const totalLeaveDays = summaries.reduce((acc, s) => acc + s.approvedLeaveDays, 0);
  const totalHoursWorked = summaries.reduce((acc, s) => acc + s.totalWorkHours, 0);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    if (!searchFilter.trim()) return summaries;
    const q = searchFilter.toLowerCase();
    return summaries.filter(
      s =>
        s.employeeName.toLowerCase().includes(q) ||
        s.employeeBadge.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [summaries, searchFilter]);

  // Export payroll summary to CSV
  const handleExportPayrollCSV = () => {
    if (summaries.length === 0) return;
    const headers = [
      'Employee Badge',
      'Employee Name',
      'Department',
      'Month',
      'Total Days In Sheet',
      'Present Days',
      'Absent Days',
      'Approved Leave Days',
      'Total Work Hours',
      'Late Minutes',
      'Early Minutes',
      'Overtime Hours',
      'Missing Punches',
      'Net Payable Days'
    ];

    const rows = summaries.map(s => [
      `"${s.employeeBadge}"`,
      `"${s.employeeName}"`,
      `"${s.department}"`,
      `"${selectedMonth}"`,
      s.totalDaysInSheet,
      s.presentDays,
      s.absentDays,
      s.approvedLeaveDays,
      s.totalWorkHours,
      s.totalLateMinutes,
      s.totalEarlyMinutes,
      s.totalOvertimeHours,
      s.missingPunchesCount,
      s.netPayableDays
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OSBIC_Payroll_Attendance_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Payroll summary exported to CSV');
  };

  // Commit to Supabase
  const handleCommitAttendance = async () => {
    if (summaries.length === 0) return;
    if (unmatchedCount > 0) {
      const confirmProceed = window.confirm(
        isRtl
          ? `يوجد ${unmatchedCount} موظف لم يتم ربطهم بملفات النظام. هل تريد المتابعة وحفظ الموظفين المرتبطين فقط؟`
          : `There are ${unmatchedCount} unmatched employees. Do you want to proceed and save matched employees only?`
      );
      if (!confirmProceed) return;
    }

    try {
      await saveBiometric.mutateAsync({
        summaries,
        monthYear: selectedMonth,
        uploadedBy: currentUserId,
        branchId
      });
      handleClose();
    } catch {
      // Error handled by hook
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-sm">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground font-syne">
                  {isRtl ? 'استيراد تقرير البصمة الشهري (Biometric Attendance)' : 'Import Monthly Biometric Punch Sheet'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {isRtl ? 'ذكي ومؤتمت' : 'Smart Reconciliation'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRtl
                  ? 'رفع ملف CSV/Excel المستخرج من جهاز البصمة لحساب ساعات العمل، التأخير، الإجازات، والغياب'
                  : 'Upload machine-generated CSV to auto-extract work hours, late penalties, leaves & net payroll days'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Month Selector & Upload Zone */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-primary" />
                <span>{isRtl ? 'شهر الاستحقاق / التقرير' : 'Payroll Month'}</span>
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-foreground mb-1.5">
                {isRtl ? 'ملف البصمة المصدر من الجهاز' : 'Punch Clock Export File (.csv, .txt)'}
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : fileName
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-border/80 hover:border-primary/50 bg-muted/10'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <UploadCloud size={24} className={fileName ? 'text-emerald-400' : 'text-muted-foreground'} />
                <div className="text-left">
                  {fileName ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Check size={14} /> {fileName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {rawRows.length} {isRtl ? 'سجل يومي تم تحليله' : 'daily punch records parsed'} • {isRtl ? 'انقر لتغيير الملف' : 'Click to replace file'}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {isRtl ? 'اسحب ملف .CSV هنا أو انقر للاختيار' : 'Drop punch .CSV here or browse'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {isRtl ? 'يتطابق تلقائياً مع جداول ZKTeco / Hikvision / Realand' : 'Matches AC-No, Clock-In, Clock-Out, Work time, Exceptions'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reconciliation Stats Strip (When Parsed) */}
          {summaries.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[10px] font-bold uppercase">{isRtl ? 'الموظفين' : 'Staff Detected'}</span>
                    <Users size={14} className="text-blue-400" />
                  </div>
                  <p className="text-xl font-black font-syne text-foreground">{totalEmployees}</p>
                  <p className="text-[10px] text-emerald-400 font-medium">
                    {matchedCount} {isRtl ? 'تم ربطهم' : 'matched to system'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[10px] font-bold uppercase">{isRtl ? 'إجمالي الساعات' : 'Total Work Hours'}</span>
                    <Clock size={14} className="text-purple-400" />
                  </div>
                  <p className="text-xl font-black font-syne text-purple-400">{totalHoursWorked.toFixed(1)}h</p>
                  <p className="text-[10px] text-muted-foreground">{isRtl ? 'ساعات فعلية' : 'rendered duty'}</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80">
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[10px] font-bold uppercase">{isRtl ? 'إجازات معتمدة' : 'Approved Leaves'}</span>
                    <Calendar size={14} className="text-emerald-400" />
                  </div>
                  <p className="text-xl font-black font-syne text-emerald-400">{totalLeaveDays}d</p>
                  <p className="text-[10px] text-muted-foreground">{isRtl ? 'متطابقة مع النظام' : 'reconciled with HR'}</p>
                </div>

                <div className={`p-3.5 rounded-2xl border ${totalMissingPunches > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-muted/30 border-border/80'}`}>
                  <div className="flex items-center justify-between text-amber-400 mb-1">
                    <span className="text-[10px] font-bold uppercase">{isRtl ? 'بصمات ناقصة' : 'Missing Punches'}</span>
                    <AlertTriangle size={14} />
                  </div>
                  <p className="text-xl font-black font-syne text-amber-400">{totalMissingPunches}</p>
                  <p className="text-[10px] text-amber-400/80">{isRtl ? 'دخول بدون خروج' : 'clock-in without exit'}</p>
                </div>

                <div className={`p-3.5 rounded-2xl border ${unmatchedCount > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-muted/30 border-border/80'}`}>
                  <div className="flex items-center justify-between text-muted-foreground mb-1">
                    <span className="text-[10px] font-bold uppercase">{isRtl ? 'غير مربوطين' : 'Unmatched'}</span>
                    <AlertCircle size={14} className={unmatchedCount > 0 ? 'text-rose-400' : 'text-emerald-400'} />
                  </div>
                  <p className={`text-xl font-black font-syne ${unmatchedCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {unmatchedCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{unmatchedCount > 0 ? 'Map manually below' : 'All staff linked'}</p>
                </div>
              </div>

              {/* Pre-Commit Review Table */}
              <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-3 bg-muted/30 border-b border-border/60 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground font-syne">
                      {isRtl ? 'مراجعة استحقاق الموظفين الشهرية' : 'Monthly Staff Attendance Breakdown'}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({filteredSummaries.length} {isRtl ? 'موظف' : 'staff'})
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder={isRtl ? 'بحث باسم الموظف أو الكود...' : 'Filter employee or badge...'}
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="bg-card border border-border rounded-xl px-3 py-1 text-xs text-foreground placeholder:text-muted-foreground w-48"
                  />
                </div>

                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/50 border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">{isRtl ? 'كود البصمة' : 'Badge'}</th>
                        <th className="py-2.5 px-3">{isRtl ? 'الموظف في النظام' : 'Matched Employee'}</th>
                        <th className="py-2.5 px-3 text-center">{isRtl ? 'الأيام في الكشف' : 'Days'}</th>
                        <th className="py-2.5 px-3 text-center">{isRtl ? 'حضور' : 'Present'}</th>
                        <th className="py-2.5 px-3 text-center">{isRtl ? 'إجازة' : 'Leaves'}</th>
                        <th className="py-2.5 px-3 text-center">{isRtl ? 'غياب' : 'Absent'}</th>
                        <th className="py-2.5 px-3 text-center">{isRtl ? 'ساعات العمل' : 'Work Hrs'}</th>
                        <th className="py-2.5 px-3 text-center">{isRtl ? 'تأخير' : 'Late (m)'}</th>
                        <th className="py-2.5 px-3 text-center">{isRtl ? 'إضافي' : 'OT (h)'}</th>
                        <th className="py-2.5 px-3 text-center">{isRtl ? 'صافي الأيام' : 'Payable Days'}</th>
                        <th className="py-2.5 px-3 text-right">{isRtl ? 'التفاصيل' : 'Breakdown'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredSummaries.map(emp => {
                        const isExpanded = expandedEmployeeBadge === emp.employeeBadge;
                        return (
                          <React.Fragment key={emp.employeeBadge}>
                            <tr className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                                <span className="px-2 py-0.5 rounded-lg bg-muted text-[11px]">
                                  #{emp.employeeBadge}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {emp.matchedProfileId ? (
                                  <div>
                                    <p className="font-bold text-foreground flex items-center gap-1">
                                      <UserCheck size={12} className="text-emerald-400" />
                                      {emp.employeeName}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">{emp.department}</p>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-rose-400 font-bold text-[11px] flex items-center gap-1">
                                      <AlertCircle size={12} /> {emp.employeeName}
                                    </span>
                                    <select
                                      onChange={e => handleRemapEmployee(emp.employeeBadge, e.target.value)}
                                      className="bg-card border border-rose-500/40 rounded-lg px-2 py-0.5 text-[10px] text-foreground"
                                      defaultValue=""
                                    >
                                      <option value="" disabled>
                                        {isRtl ? 'اختر الموظف...' : 'Select OSBIC Staff...'}
                                      </option>
                                      {employees.map(p => (
                                        <option key={p.id} value={p.id}>
                                          {p.full_name} ({p.department || 'Staff'})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">{emp.totalDaysInSheet}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400">
                                {emp.presentDays}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-purple-400">
                                {emp.approvedLeaveDays}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-400">
                                {emp.absentDays > 0 ? emp.absentDays : '0'}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-semibold">
                                {emp.totalWorkHours}h
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                <span className={emp.totalLateMinutes > 60 ? 'text-amber-400 font-bold' : 'text-muted-foreground'}>
                                  {emp.totalLateMinutes > 0 ? `${emp.totalLateMinutes}m` : '—'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono">
                                <span className={emp.totalOvertimeHours > 0 ? 'text-blue-400 font-bold' : 'text-muted-foreground'}>
                                  {emp.totalOvertimeHours > 0 ? `${emp.totalOvertimeHours}h` : '—'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-400">
                                {emp.netPayableDays} {isRtl ? 'يوم' : 'd'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => setExpandedEmployeeBadge(isExpanded ? null : emp.employeeBadge)}
                                  className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-medium text-foreground transition-all flex items-center gap-1 ml-auto"
                                >
                                  <span>{isExpanded ? 'Hide' : 'Days'}</span>
                                  {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Day-by-Day Breakdown */}
                            {isExpanded && (
                              <tr className="bg-muted/10">
                                <td colSpan={11} className="p-3">
                                  <div className="bg-background border border-border/80 rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs border-b border-border/40 pb-2">
                                      <span className="font-bold text-foreground">
                                        {emp.employeeName} — {isRtl ? 'سجل الأيام التفصيلي' : 'Daily Punch Breakdown'}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        {emp.records.length} {isRtl ? 'يوم مسجل' : 'days logged'}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                                      {emp.records.map((r, rIdx) => (
                                        <div
                                          key={rIdx}
                                          className={`p-2 rounded-lg border text-[11px] font-mono space-y-1 ${
                                            r.status === 'on_leave'
                                              ? 'bg-purple-500/5 border-purple-500/20'
                                              : r.status === 'absent'
                                              ? 'bg-rose-500/5 border-rose-500/20'
                                              : r.isMissingPunch
                                              ? 'bg-amber-500/5 border-amber-500/20'
                                              : 'bg-muted/20 border-border/60'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-bold text-foreground">{r.date}</span>
                                            <span
                                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                                r.status === 'present'
                                                  ? 'text-emerald-400'
                                                  : r.status === 'late'
                                                  ? 'text-amber-400'
                                                  : r.status === 'on_leave'
                                                  ? 'text-purple-400'
                                                  : 'text-rose-400'
                                              }`}
                                            >
                                              {r.status}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                                            <span>In: {r.punchIn || '—'}</span>
                                            <span>Out: {r.punchOut || '—'}</span>
                                          </div>
                                          {r.lateMinutes > 0 && (
                                            <p className="text-[10px] text-amber-400">Late: {r.lateMinutes}m</p>
                                          )}
                                          {r.isMissingPunch && (
                                            <p className="text-[10px] text-amber-400 font-sans">⚠️ Missing Punch Out</p>
                                          )}
                                          {r.notes && (
                                            <p className="text-[9px] text-muted-foreground truncate">{r.notes}</p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {summaries.length > 0 && (
              <span>
                {isRtl ? 'جاهز للاعتماد وتحديث سجلات الحضور وسجلات الرواتب' : 'Ready to commit attendance & sync with payroll summaries'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              disabled={saveBiometric.isPending}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted/50 text-xs font-semibold text-muted-foreground transition-all"
            >
              {isRtl ? 'إلغاء' : 'Cancel'}
            </button>

            {summaries.length > 0 && (
              <button
                onClick={handleExportPayrollCSV}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-all flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>{isRtl ? 'تصدير كشف الرواتب (CSV)' : 'Export Payroll Summary'}</span>
              </button>
            )}

            {summaries.length > 0 && (
              <button
                onClick={handleCommitAttendance}
                disabled={saveBiometric.isPending}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {saveBiometric.isPending ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{isRtl ? 'جاري الحفظ والترحيل...' : 'Committing to System...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>{isRtl ? 'اعتماد وترحيل كشف الحضور' : 'Confirm & Commit Attendance'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
