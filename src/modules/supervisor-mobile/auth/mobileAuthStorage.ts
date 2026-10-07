export type MobileSupervisorProfile = {
  accountId: string; employeeId: number; employeeName: string;
  username: string; role: string; department: string;
};
export type StoredMobileSession = { token: string; expiresAt: string; supervisor: MobileSupervisorProfile };

// Mobile bearer credentials are document-memory only. A refresh requires a
// new backend login; no authorization state is written to Web Storage or
// IndexedDB.
let session: StoredMobileSession | null = null;
export async function loadMobileSession(): Promise<StoredMobileSession | null> {
  if (session && new Date(session.expiresAt).getTime() > Date.now()) return session;
  session = null; return null;
}
export async function saveMobileSession(value: StoredMobileSession): Promise<void> { session = value; }
export async function clearMobileSession(): Promise<void> { session = null; }
