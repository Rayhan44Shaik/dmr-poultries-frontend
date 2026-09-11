import { apiClient } from "../../api/client";
export type AppRole = "OWNER" | "SENIOR_ACCOUNT" | "SUPERVISOR";
export type AuthenticatedUser = { id: number; username: string; displayName: string; role: AppRole; employeeId: number | null };
export async function loginRequest(username: string, password: string) { return (await apiClient.post<{ user: AuthenticatedUser; expiresAt: string }>("/auth/login", { username, password })).data; }
export async function currentUserRequest() { return (await apiClient.get<{ user: AuthenticatedUser }>("/auth/me")).data.user; }
export async function logoutRequest() { await apiClient.post("/auth/logout"); }
