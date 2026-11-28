/**
 * Biometric Attendance CSV Parser & Reconciliation Engine
 * Tailored for OSBIC Biometric Punch Machine exports (.csv / .txt)
 */

export interface RawBiometricRow {
  firstName: string;
  lastName: string;
  fullName: string;
  employeeBadge: string; // e.g. "23"
  position?: string;
  department?: string;
  dateStr: string; // Raw date e.g. "24/11/2026"
  dateISO: string; // Parsed YYYY-MM-DD
  dutyTimeStr?: string; // e.g. "08:30 AM - 06:00 PM"
  punchIn?: string | null; // e.g. "9:10 AM"
  punchOut?: string | null; // e.g. "6:05 PM"
  plannedHoursStr?: string; // e.g. "9:30"
  workTimeStr?: string; // e.g. "9:21"
  lateStr?: string; // e.g. "0:40"
  lateMinutes: number; // e.g. 40
  earlyStr?: string; // e.g. "2:02"
  earlyMinutes: number; // e.g. 122
  overtimeStr?: string; // e.g. "0:00"
  overtimeHours: number;
  absentStr?: string; // e.g. "9:30"
  actualTimeStr?: string; // e.g. "9:12"
  actualHours: number;
  exceptionCount: number; // 1 if missing punch
  isMissingPunch: boolean;
  isAbsent: boolean;
  isPresent: boolean;
}

export interface ReconciledAttendanceDay {
  date: string; // YYYY-MM-DD
  dutyTime?: string;
  punchIn?: string | null;
  punchOut?: string | null;
  plannedHours?: string;
  actualHoursStr?: string;
  actualHoursNum: number;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeHours: number;
  isMissingPunch: boolean;
  status: 'present' | 'late' | 'absent' | 'half_day' | 'on_leave' | 'remote';
  leaveType?: string | null;
  notes?: string;
}

export interface EmployeeMonthlySummary {
  employeeBadge: string;
  matchedProfileId: string | null;
  employeeName: string;
  department: string;
  avatarUrl?: string | null;
  totalDaysInSheet: number;
  presentDays: number;
  absentDays: number;
  approvedLeaveDays: number;
  totalWorkHours: number;
  totalLateMinutes: number;
  totalEarlyMinutes: number;
  totalOvertimeHours: number;
  missingPunchesCount: number;
  netPayableDays: number;
  records: ReconciledAttendanceDay[];
}

// Convert "HH:MM" or "H:MM" to total minutes
export function parseDurationToMinutes(val?: string | null): number {
  if (!val || val.trim() === '' || val === '0:00' || val === '00:00') return 0;
  const cleaned = val.trim();
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }
  const numeric = parseFloat(cleaned);
  return isNaN(numeric) ? 0 : Math.round(numeric * 60);
}

// Convert "HH:MM" or "H:MM" to decimal hours (e.g. "9:30" -> 9.5)
export function parseDurationToHours(val?: string | null): number {
  const mins = parseDurationToMinutes(val);
  return Number((mins / 60).toFixed(2));
}

// Parse "DD/MM/YYYY" or "YYYY-MM-DD" to standard ISO "YYYY-MM-DD"
export function parseDateToISO(rawDate: string): string {
  if (!rawDate) return '';
  const trimmed = rawDate.trim();
  // Check if DD/MM/YYYY
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  // Check if YYYY-MM-DD
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return trimmed;
    }
    // Could be DD-MM-YYYY
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return trimmed;
}

// Parse CSV text respecting quoted fields
export function parseCSVToRows(csvText: string): string[][] {
  const lines: string[][] = [];
  const rawLines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of rawLines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let insideQuote = false;
    let entry = '';

    // Determine delimiter: comma, tab, or semicolon
    let delimiter = ',';
    if (!line.includes(',') && line.includes(';')) delimiter = ';';
    else if (!line.includes(',') && line.includes('\t')) delimiter = '\t';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          entry += '"';
          i++; // skip escaped quote
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === delimiter && !insideQuote) {
        row.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    lines.push(row);
  }

  return lines;
}

/**
 * Main parser: takes raw CSV text and extracts structured biometric rows
 */
export function parseBiometricCSV(csvText: string): RawBiometricRow[] {
  const table = parseCSVToRows(csvText);
  if (table.length === 0) return [];

  // Find header row by detecting expected keywords
  let headerIndex = -1;
  for (let i = 0; i < Math.min(table.length, 10); i++) {
    const rowStr = table[i].join(' ').toLowerCase();
    if (
      (rowStr.includes('first name') || rowStr.includes('name')) &&
      (rowStr.includes('date') || rowStr.includes('employee') || rowStr.includes('punch'))
    ) {
      headerIndex = i;
      break;
    }
  }

  // Fallback: If header not found by name, assume row 0 if it has 'date'
  if (headerIndex === -1) {
    headerIndex = table.findIndex(r => r.some(c => c.toLowerCase().includes('date')));
  }
  if (headerIndex === -1) headerIndex = 0;

  const headers = table[headerIndex].map(h => h.trim().toLowerCase());

  // Helper to find column index with multiple candidate names
  const findCol = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h === c.toLowerCase() || h.includes(c.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colFirstName = findCol('first name', 'fname', 'first_name');
  const colLastName = findCol('last name', 'lname', 'last_name', 'surname');
  const colEmployee = findCol('employee', 'ac-no', 'emp no', 'badge', 'id', 'user id');
  const colDepartment = findCol('department', 'departme', 'dept');
  const colDate = findCol('date', 'punch date', 'work date');
  const colDutyTime = findCol('duty time', 'timetable', 'shift');
  const colPunchIn = findCol('punch in', 'clock in', 'in time', 'in');
  const colPunchOut = findCol('punch out', 'clock out', 'out time', 'out');
  const colPlannedHours = findCol('duty time', 'expected hours'); // Later occurrence or duty hours
  const colWorkTime = findCol('work time', 'worktime', 'worked hours');
  const colLate = findCol('late', 'late time', 'late in');
  const colEarly = findCol('early', 'early time', 'early out');
  const colOvertime = findCol('overtime', 'ot');
  const colAbsentTime = findCol('absent time', 'absent', 'absence');
  const colActualTime = findCol('actual time', 'actualtime', 'total work');
  const colException = findCol('exception', 'exceptions', 'remark', 'anomalies');

  const parsedRows: RawBiometricRow[] = [];

  for (let i = headerIndex + 1; i < table.length; i++) {
    const row = table[i];
    if (row.length === 0 || row.every(c => !c.trim())) continue;

    const firstName = colFirstName !== -1 ? row[colFirstName] || '' : '';
    const lastName = colLastName !== -1 ? row[colLastName] || '' : '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Employee';
    const employeeBadge = colEmployee !== -1 ? row[colEmployee] || '' : '';
    const rawDate = colDate !== -1 ? row[colDate] || '' : '';
    const dateISO = parseDateToISO(rawDate);

    // Skip if date or employee badge is invalid
    if (!dateISO || (!employeeBadge && !fullName)) continue;

    const dutyTimeStr = colDutyTime !== -1 ? row[colDutyTime] || '' : '';
    const punchIn = colPunchIn !== -1 && row[colPunchIn] ? row[colPunchIn].trim() : null;
    const punchOut = colPunchOut !== -1 && row[colPunchOut] ? row[colPunchOut].trim() : null;

    const lateStr = colLate !== -1 ? row[colLate] || '' : '';
    const lateMinutes = parseDurationToMinutes(lateStr);

    const earlyStr = colEarly !== -1 ? row[colEarly] || '' : '';
    const earlyMinutes = parseDurationToMinutes(earlyStr);

    const overtimeStr = colOvertime !== -1 ? row[colOvertime] || '' : '';
    const overtimeHours = parseDurationToHours(overtimeStr);

    const absentStr = colAbsentTime !== -1 ? row[colAbsentTime] || '' : '';
    const absentMins = parseDurationToMinutes(absentStr);

    const actualTimeStr = colActualTime !== -1 ? row[colActualTime] || '' : (colWorkTime !== -1 ? row[colWorkTime] || '' : '');
    const actualHours = parseDurationToHours(actualTimeStr);

    const exceptionRaw = colException !== -1 ? row[colException] || '' : '';
    const exceptionCount = parseInt(exceptionRaw, 10) || 0;

    // Detect status flags
    const hasPunch = Boolean(punchIn || punchOut);
    const isMissingPunch = Boolean((punchIn && !punchOut) || (!punchIn && punchOut) || exceptionCount > 0);
    const isAbsent = !hasPunch && absentMins > 0;
    const isPresent = Boolean(punchIn && (punchOut || actualHours > 0));

    parsedRows.push({
      firstName,
      lastName,
      fullName,
      employeeBadge,
      department: colDepartment !== -1 ? row[colDepartment] : undefined,
      dateStr: rawDate,
      dateISO,
      dutyTimeStr,
      punchIn,
      punchOut,
      plannedHoursStr: colPlannedHours !== -1 ? row[colPlannedHours] : undefined,
      workTimeStr: colWorkTime !== -1 ? row[colWorkTime] : undefined,
      lateStr,
      lateMinutes,
      earlyStr,
      earlyMinutes,
      overtimeStr,
      overtimeHours,
      absentStr,
      actualTimeStr,
      actualHours,
      exceptionCount,
      isMissingPunch,
      isAbsent,
      isPresent
    });
  }

  return parsedRows;
}

/**
 * Reconciles parsed biometric rows with system profiles & approved leave requests
 */
export function reconcileBiometricAttendance(
  rawRows: RawBiometricRow[],
  profiles: Array<{
    id: string;
    full_name: string;
    employee_code?: string | null;
    department?: string | null;
    avatar_url?: string | null;
  }>,
  approvedLeaves: Array<{
    id: string;
    employee_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    status: string;
  }> = []
): EmployeeMonthlySummary[] {
  // Group rows by employeeBadge
  const groups = new Map<string, RawBiometricRow[]>();

  for (const row of rawRows) {
    const key = row.employeeBadge || row.fullName;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  const summaries: EmployeeMonthlySummary[] = [];

  for (const [badge, rows] of groups.entries()) {
    // Attempt match with profiles
    const matched = profiles.find(p => {
      // 1. Match by employee_code
      if (p.employee_code) {
        const cleanEmpCode = p.employee_code.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanBadge = badge.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanEmpCode === cleanBadge) return true;
        // e.g. "EMP-023" vs "23"
        const numInProfile = cleanEmpCode.replace(/\D/g, '');
        const numInBadge = cleanBadge.replace(/\D/g, '');
        if (numInProfile && numInBadge && parseInt(numInProfile, 10) === parseInt(numInBadge, 10)) {
          return true;
        }
      }
      // 2. Match by full_name
      const profileName = (p.full_name || '').toLowerCase().trim();
      const sampleRow = rows[0];
      const rowName = sampleRow.fullName.toLowerCase().trim();
      if (profileName && rowName && (profileName.includes(rowName) || rowName.includes(profileName))) {
        return true;
      }
      return false;
    });

    const firstRow = rows[0];
    const employeeName = matched?.full_name || firstRow.fullName;
    const department = matched?.department || firstRow.department || 'Operations';
    const profileId = matched?.id || null;

    // Process each day
    const reconciledDays: ReconciledAttendanceDay[] = [];
    let totalWorkHours = 0;
    let totalLateMinutes = 0;
    let totalEarlyMinutes = 0;
    let totalOvertimeHours = 0;
    let presentDaysCount = 0;
    let absentDaysCount = 0;
    let approvedLeaveDaysCount = 0;
    let missingPunchesCount = 0;

    for (const r of rows) {
      // Check if this date falls within an approved leave
      let onLeaveRecord = null;
      if (profileId) {
        onLeaveRecord = approvedLeaves.find(l => {
          return (
            l.employee_id === profileId &&
            l.status === 'approved' &&
            l.start_date <= r.dateISO &&
            r.dateISO <= l.end_date
          );
        });
      }

      let status: ReconciledAttendanceDay['status'] = 'absent';
      let leaveType: string | null = null;
      let notes = '';

      if (onLeaveRecord) {
        status = 'on_leave';
        leaveType = onLeaveRecord.leave_type;
        notes = `Approved ${onLeaveRecord.leave_type} leave`;
        approvedLeaveDaysCount++;
      } else if (r.isMissingPunch) {
        status = r.lateMinutes > 0 ? 'late' : 'present';
        notes = 'Missing punch out recorded (anomalous)';
        missingPunchesCount++;
        presentDaysCount++;
      } else if (r.isPresent) {
        status = r.lateMinutes > 0 ? 'late' : 'present';
        presentDaysCount++;
      } else if (r.isAbsent) {
        status = 'absent';
        notes = 'Unexcused absence';
        absentDaysCount++;
      } else {
        // Off day / rest day
        status = 'present';
        notes = 'Rest day / Off duty';
      }

      totalWorkHours += r.actualHours;
      totalLateMinutes += r.lateMinutes;
      totalEarlyMinutes += r.earlyMinutes;
      totalOvertimeHours += r.overtimeHours;

      reconciledDays.push({
        date: r.dateISO,
        dutyTime: r.dutyTimeStr,
        punchIn: r.punchIn,
        punchOut: r.punchOut,
        plannedHours: r.plannedHoursStr,
        actualHoursStr: r.actualTimeStr,
        actualHoursNum: r.actualHours,
        lateMinutes: r.lateMinutes,
        earlyMinutes: r.earlyMinutes,
        overtimeHours: r.overtimeHours,
        isMissingPunch: r.isMissingPunch,
        status,
        leaveType,
        notes: notes || undefined
      });
    }

    // Net payable days: Total days - unexcused absences
    const totalDaysInSheet = rows.length;
    const netPayableDays = Math.max(0, totalDaysInSheet - absentDaysCount);

    summaries.push({
      employeeBadge: badge,
      matchedProfileId: profileId,
      employeeName,
      department,
      avatarUrl: matched?.avatar_url || null,
      totalDaysInSheet,
      presentDays: presentDaysCount,
      absentDays: absentDaysCount,
      approvedLeaveDays: approvedLeaveDaysCount,
      totalWorkHours: Number(totalWorkHours.toFixed(1)),
      totalLateMinutes,
      totalEarlyMinutes,
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(1)),
      missingPunchesCount,
      netPayableDays,
      records: reconciledDays.sort((a, b) => a.date.localeCompare(b.date))
    });
  }

  return summaries;
}
