import type { SystemUser, UserProfile } from "../types";

export const getCurrentUser = (): UserProfile => ({
  id: 1,
  name: "Rubulla",
  email: "info@dmrpoultries.com",
  role: "Administrator",
  department: "Administration",
  mobile: "+91 9122456789",
  employeeId: "DMR001",
  dateJoined: "01-Jan-2020",
});

export const getUsers = (): SystemUser[] => [
  { id: 1, name: "Rubulla", username: "rubullaadmin", department: "Administration", role: "Owner", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
  { id: 2, name: "Imran", username: "imran123", department: "Accounts", role: "Senior Account", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
  { id: 3, name: "Shafi", username: "shafi01", department: "Operations", role: "Supervisor", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
  { id: 4, name: "Bhai", username: "bhai007", department: "Collection", role: "Collection Staff", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
  { id: 5, name: "Safi", username: "safi888", department: "HR", role: "HR Manager", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
];

export const updateUserProfile = (data: any) => {
  console.log("Updating profile", data);
  return { success: true };
};