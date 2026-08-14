// src/modules/staff/types/staffDashboard.ts

// ============================================================
// CORE ENTITIES (used across multiple pages)
// ============================================================

export interface Employee {
  id: number;
  employeeNo: number;
  employeeName: string;
  department: string;
  role: string;
  phoneNumber: string;
  email: string;
  salary: number;
  status: 'Active' | 'Inactive' | 'Suspended';
  joiningDate: string;
  avatar?: string;
}

export interface Trip {
  id: number;
  tripNo: string;
  tripDate: string;
  vehicleNo: string;
  driverName: string;
  supervisorName: string;
  sourceFarm: string;
  status: 'Pending' | 'Completed';
  totalBirds: number;
  totalWeight: number;
  totalShops: number;
  totalMortality: number;
  deliveries?: Delivery[];
}

export interface Delivery {
  shopName: string;
  birds: number;
  weight: number;
  rate?: number;
}

// ============================================================
// PAGE 1: STAFF DASHBOARD
// ============================================================

export interface StaffDashboardData {
  totalEmployees: number;
  presentToday: number;
  onDutyToday: number;
  onLeave: number;
  salaryPending: number;
  dutyAllocation: { label: string; value: number; color: string }[];
  weeklyAttendance: { day: string; present: number; absent: number; leave: number }[];
  onDutyEmployees: {
    id: number;
    name: string;
    role: string;
    dutyType: string;
    vehicle: string;
    status: 'Active' | 'Delayed';
    avatar?: string;
  }[];
}

export interface StaffDashboardFilters {
  fromDate: string;
  toDate: string;
  department: string;
}

// ============================================================
// PAGE 2: DUTY PLANNER
// ============================================================

export interface DutyAssignment {
  id: string;
  employeeId: number;
  employeeName: string;
  department: string;
  role: string;
  dutyType: 'Driver' | 'Delivery' | 'Rest' | 'Repair' | 'Office' | 'OfficeDuty' | 'Collection' | 'WeeklyOff';
  date: string; // YYYY-MM-DD
  vehicleId?: number;
  vehicleNo?: string;
}

export interface DutyPlannerFilters {
  department: string;
  role: string[];          // changed from string to array
  weekStart: string;       // Monday date
}
export interface ShiftConfig {
  type: 'Driver' | 'Delivery' | 'Rest' | 'Repair' | 'Office' | 'WeeklyOff';
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

// ============================================================
// PAGE 3: ATTENDANCE REGISTER
// ============================================================

export interface AttendanceRecord {
  employeeId: number;
  employeeName: string;
  department: string;
  [day: string]: string | number; // dynamic days 1-31 (P, A, H, L, WO)
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  halfDayCount: number;
}

export interface AttendanceFilters {
  month: string; // YYYY-MM
  department: string;
}

// ============================================================
// PAGE 4: LEAVE MANAGEMENT
// ============================================================

export interface LeaveRequest {
  id: string;
  employeeId: number;
  employeeName: string;
  type: 'Casual' | 'Sick' | 'Emergency' | 'Annual';
  fromDate: string;
  toDate: string;
  days: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason?: string;
  rejectionReason?: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface LeaveBalance {
  employeeId: number;
  employeeName: string;
  casual: number;
  sick: number;
  emergency: number;
  annual: number;
  total: number;
  used: number;
  remaining: number;
}

export interface LeaveFilters {
  status: 'All' | 'Pending' | 'Approved' | 'Rejected';
  search: string;
}

// ============================================================
// PAGE 5: SALARY SHEET
// ============================================================

export interface SalaryRecord {
  id: string;
  employeeId: number;
  employeeName: string;
  department: string;
  basicSalary: number;
  overtime: number;
  incentives: number;
  fuelAllowance: number;
  nightAllowance: number;
  totalGross: number;
  leaveDeduction: number;
  advanceRecovery: number;
  loanEMI: number;
  latePenalty: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  status: 'Pending' | 'Paid';
  paymentDate?: string;
  month: string; // YYYY-MM
  createdAt: string;
}

export interface SalaryCalculation {
  gross: number;
  deductions: number;
  net: number;
}

export interface SalarySheetFilters {
  employeeId: number | null;
  month: string;
}

// ============================================================
// PAGE 6: SALARY REGISTER
// ============================================================

export interface SalaryRegisterFilters {
  month: string;
  department: string;
  status: 'All' | 'Pending' | 'Paid';
}

// ============================================================
// PAGE 7: ADVANCE & LOAN REGISTER
// ============================================================

export interface AdvanceLoan {
  id: string;
  employeeId: number;
  employeeName: string;
  type: 'Advance' | 'Loan';
  principal: number;
  issuedDate: string;
  totalRepaid: number;
  monthlyDeduction: number;
  remainingBalance: number;
  status: 'Active' | 'Completed';
  interestRate?: number; // for loans
  tenure?: number; // in months, for loans
}

export interface AdvanceLoanFilters {
  type: 'Advance' | 'Loan';
  status: 'All' | 'Active' | 'Completed';
  search: string;
}

// ============================================================
// PAGE 8: EMPLOYEE HISTORY
// ============================================================

export interface HistoryEvent {
  id: string;
  date: string;
  module: string;
  event: string;
  details: string;
  icon: string;
}

export interface EmployeeHistoryStats {
  totalTrips: number;
  totalDistance: number;
  totalBirds: number;
  totalWeight: number;
}

export interface EmployeeHistoryFilters {
  employeeId: number | null;
  module: 'All' | 'Trips' | 'Leave' | 'Salary' | 'Advance' | 'Vehicle';
}

// ============================================================
// PAGE 9: DRIVER PERFORMANCE
// ============================================================

export interface DriverPerformance {
  totalTrips: number;
  deliveryDays: number;
  repairDays: number;
  totalDistance: number;
  totalBirds: number;
  totalWeight: number;
  mortalityRate: number;
  fuelUsed: number;
  avgWeightPerTrip: number;
}

export interface DriverPerformanceFilters {
  driverId: number | null;
  fromDate: string;
  toDate: string;
}

// ============================================================
// PAGE 10: SUPERVISOR PERFORMANCE
// ============================================================

export interface SupervisorPerformance {
  tripsManaged: number;
  farmsVisited: number;
  shopsDelivered: number;
  deliveryAccuracy: number;
  mortalityVerified: number;
  leaderboard: {
    shopName: string;
    trips: number;
    birds: number;
    weight: number;
    mortality: number;
  }[];
}

export interface SupervisorPerformanceFilters {
  supervisorId: number | null;
  fromDate: string;
  toDate: string;
}

// ============================================================
// PAGE 11: STAFF REPORTS
// ============================================================

export interface ReportTile {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
}

export interface ReportFilters {
  reportType: string;
  fromDate: string;
  toDate: string;
  format: 'PDF' | 'Excel';
}

// ============================================================
// PAGE 12: STAFF DASHBOARD (already defined above)
// ============================================================

// Re-export for convenience
export type StaffPage =
  | 'dashboard'
  | 'duty-planner'
  | 'attendance'
  | 'leave'
  | 'salary-sheet'
  | 'salary-register'
  | 'advance-loan'
  | 'employee-history'
  | 'driver-performance'
  | 'supervisor-performance'
  | 'reports';
// ============================================================
// DUTY PLANNER (PostgreSQL-backed via backend /staff/duty-planner)
// ============================================================
export type DutyType = 'Delivery' | 'Repair' | 'OfficeDuty' | 'Office' | 'Collection' | 'WeeklyOff' | 'Driver' | 'Rest';
export interface DutyWeekInfo {
  weekStart: string; weekEnd: string; status: 'Draft' | 'Open' | 'Submitted' | 'Locked';
  days: { date: string; weekday: string }[];
  assignments: DutyAssignment[];
  employees: { id: number; employeeNo: number; name: string; department: string; role: string; active: boolean; onApprovedLeave: string[] }[];
  perEmployee: Record<number, { worked: number; delivery: number; repair: number; office: number; collection: number; weeklyOff: number; leave: number; weekOffDay: string | null }>;
  saturday: { required: number; assigned: number; shortage: number; status: string }
  validation: { ok: boolean; problems: string[] },
}
export interface AutoAssignmentPreview {
  employeesAffected: number; delivery: number; repair: number; office: number; collection: number; weeklyOff: number;
  saturdayRequired: number; saturdayAssigned: number; saturdayShortage: number; conflicts: string[];
  rows: { employeeId: number; employeeName: string; department: string; role: string; date: string; dutyType: DutyType; vehicleId?: number | null; vehicleNo?: string | null }[];
}
