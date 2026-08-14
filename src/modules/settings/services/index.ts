import type { SystemUser, UserProfile } from "../types";
import {
  loadStoredProfile,
  loadStoredUsers,
  saveStoredUsers,
} from "../storage/settingsStorage";

const BASE_PROFILE: UserProfile = {
  id: 1,
  name: "Rubulla",
  email: "info@dmrpoultries.com",
  role: "Owner",
  department: "Administration",
  mobile: "+91 9122456789",
  employeeId: "DMR001",
  dateJoined: "01-Jan-2020",
  username: "rubullaadmin",
  designation: "Owner",
};

const SEED_USERS: SystemUser[] = [
  { id: 1, name: "Rubulla", username: "rubullaadmin", department: "Administration", role: "Owner", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
  { id: 2, name: "Imran", username: "imran123", department: "Accounts", role: "Senior Account", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
  { id: 3, name: "Shafi", username: "shafi01", department: "Operations", role: "Supervisor", status: "Active", lastLogin: "28-May-2026 10:05 PM" },
];

/**
 * Current user profile.
 * Editable fields (name/email/mobile/profileImage) overlay the base profile
 * with any values saved from the Profile tab. Read-only fields come from the
 * base profile only.
 */
export const getCurrentUser = (): UserProfile => {
  const stored = loadStoredProfile();
  return {
    ...BASE_PROFILE,
    name: stored.name || BASE_PROFILE.name,
    email: stored.email || BASE_PROFILE.email,
    mobile: stored.mobile || BASE_PROFILE.mobile,
    profileImage: stored.profileImage,
  };
};

/**
 * All system users for the Users tab (frontend-managed).
 * Returns stored users when present, otherwise the seeded sample list.
 */
export const getUsers = (): SystemUser[] => {
  const stored = loadStoredUsers();
  return stored.length > 0 ? stored : SEED_USERS;
};

/** Persist the user list to frontend local storage. */
export const saveUsers = (users: SystemUser[]): void => {
  saveStoredUsers(users);
};
