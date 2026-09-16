import type { SystemUser, UserProfile } from "../types";

/** Fixed dashboard welcome copy, shared by every dashboard surface. */
export const FIXED_DASHBOARD_GREETING = "Good Evening, Ruhulla 👋";

export const getCurrentUser = (): UserProfile => ({
  id: 1,
  name: "Ruhulla",
  email: "info@dmrpoultries.com",
  role: "Owner",
  department: "Administration",
  mobile: "+91 9122456789",
  employeeId: "DMR001",
  dateJoined: "01-Jan-2020",
  username: "ruhullaadmin",
});

export const getUsers = (): SystemUser[] => [
  { id: 1, name: "Ruhulla", username: "ruhullaadmin", department: "Administration", role: "Owner", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
  { id: 2, name: "Imran", username: "imran123", department: "Accounts", role: "Senior Account", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
  { id: 3, name: "Shafi", username: "shafi01", department: "Operations", role: "Supervisor", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
];