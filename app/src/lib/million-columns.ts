/** Row 1 of the Million import file, exactly as the template writes it. */
export const MILLION_COLUMNS = [
  "Employee No.", "Public Holiday", "Working Day", "DAYS WORKED", "Hours of Worked",
  "Lateness", "Early Departure", "No Pay Hour", "OT From Date", "OT To Date",
  "Overtime 1 (1x)", "OVERTIME 2 (1.5x)", "OVERTIME 3 (2x)", "Overtime 4 (3x)",
  "Overtime 5 (Rest day)", "Overtime 6 (PH)", "Absence", "Annual Leave",
  "Compassionate Leave", "Examination Leave", "Hospital Leave", "Line Shutdown Leave",
  "Medical Leave", "Marriage Leave", "Maternity Leave", "NON-PAY LEAVE", "Out of Bound",
  "Paternity Leave", "ALLOWANCE", "Attnd Allowance", "Food Allowance", "Travel Allowance",
  "Absent Deduction Fine", "Advance Cash", "Advance RHB", "ADVANCE", "Zakat",
] as const;

/** The seven columns Stage 1 fills. Everything else is written as 0. */
export const COL = {
  EMPLOYEE_NO: 0,
  PUBLIC_HOLIDAY: 1,
  WORKING_DAY: 2,
  DAYS_WORKED: 3,
  OVERTIME_1_5X: 11,
  OVERTIME_2X: 12,
  NON_PAY_LEAVE: 25,
  ALLOWANCE: 28,
  ADVANCE: 35,
} as const;
