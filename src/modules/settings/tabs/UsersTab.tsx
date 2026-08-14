import { useMemo, useState } from "react";
import {
  Plus, Search, Pencil, Trash2, UserCheck, UserX, Users, Filter,
} from "lucide-react";
import Modal from "../../../components/common/Modal";
import { useNotification } from "../../../providers/NotificationProvider";
import { getUsers, saveUsers } from "../services";
import { DEPARTMENTS, ROLE_NAMES } from "../constants";
import type { SystemUser, UserStatus } from "../types";

interface DraftForm {
  id: number | null;
  name: string;
  username: string;
  department: string;
  role: string;
  status: UserStatus;
}

const EMPTY_FORM: DraftForm = {
  id: null,
  name: "",
  username: "",
  department: "",
  role: "",
  status: "Active",
};

interface ConfirmState {
  kind: "delete" | "toggle";
  user: SystemUser;
}

export default function UsersTab() {
  const notify = useNotification();
  const [users, setUsers] = useState<SystemUser[]>(() => getUsers());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | UserStatus>("All");
  const [deptFilter, setDeptFilter] = useState<string>("All");

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.username.toLowerCase().includes(q))
        return false;
      if (statusFilter !== "All" && u.status !== statusFilter) return false;
      if (deptFilter !== "All" && u.department !== deptFilter) return false;
      return true;
    });
  }, [users, search, statusFilter, deptFilter]);

  const persist = (next: SystemUser[]) => {
    setUsers(next);
    saveUsers(next);
  };

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, id: null, status: "Active" });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (user: SystemUser) => {
    setForm({
      id: user.id,
      name: user.name,
      username: user.username,
      department: user.department,
      role: user.role,
      status: user.status,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const setField = (field: keyof DraftForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!form.username.trim()) errs.username = "Username is required.";
    else {
      const dup = users.some(
        (u) => u.username.toLowerCase() === form.username.trim().toLowerCase() && u.id !== form.id
      );
      if (dup) errs.username = "This username is already in use.";
    }
    if (!form.department) errs.department = "Department is required.";
    if (!form.role) errs.role = "Role is required.";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      notify.showNotification("Please fix the highlighted fields.", "error");
      return;
    }

    if (form.id === null) {
      const maxId = users.reduce((m, u) => Math.max(m, u.id), 0);
      const newUser: SystemUser = {
        id: maxId + 1,
        name: form.name.trim(),
        username: form.username.trim(),
        department: form.department,
        role: form.role,
        status: form.status,
        lastLogin: "Never",
      };
      persist([...users, newUser]);
      notify.showNotification(`User ${newUser.name} added (frontend).`, "success");
    } else {
      const next = users.map((u) =>
        u.id === form.id
          ? {
              ...u,
              name: form.name.trim(),
              username: form.username.trim(),
              department: form.department,
              role: form.role,
              status: form.status,
            }
          : u
      );
      persist(next);
      notify.showNotification("User updated (frontend).", "success");
    }
    setFormOpen(false);
  };

  const handleToggle = () => {
    if (!confirm) return;
    const nextStatus: UserStatus = confirm.user.status === "Active" ? "Inactive" : "Active";
    const next = users.map((u) => (u.id === confirm.user.id ? { ...u, status: nextStatus } : u));
    persist(next);
    notify.showNotification(
      `${confirm.user.name} ${nextStatus === "Active" ? "activated" : "deactivated"} (frontend).`,
      "success"
    );
    setConfirm(null);
  };

  const handleDelete = () => {
    if (!confirm) return;
    const next = users.filter((u) => u.id !== confirm.user.id);
    persist(next);
    notify.showNotification(`${confirm.user.name} deleted (frontend).`, "success");
    setConfirm(null);
  };

  const deptCounts = useMemo(() => {
    const deps = new Set<string>();
    users.forEach((u) => deps.add(u.department || "Unassigned"));
    return Array.from(deps).sort();
  }, [users]);

  const fieldClass = (name: string) =>
    `w-full rounded-xl border px-3.5 py-2 text-sm text-slate-800 outline-none transition-all focus:ring-2 ${
      formErrors[name]
        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100"
        : "border-slate-200 focus:border-blue-500 focus:ring-blue-100"
    }`;

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or username…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "All" | UserStatus)}
              className="pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-500"
              aria-label="Filter by status"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="relative">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-blue-500"
              aria-label="Filter by department"
            >
              <option value="All">All Departments</option>
              {deptCounts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-all shadow-sm"
        >
          <Plus size={15} /> Add User
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-xs text-left">
          <thead className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100">
            <tr>
              <th className="py-2.5 px-3 w-10">#</th>
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Username</th>
              <th className="py-2.5 px-3">Department</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3">Last Login</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Users size={28} />
                    <p className="text-xs">No users match your search or filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((u, idx) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 text-center text-slate-500">{idx + 1}</td>
                  <td className="py-3 px-3 font-semibold text-slate-800">{u.name}</td>
                  <td className="py-3 px-3 text-slate-600">{u.username}</td>
                  <td className="py-3 px-3 text-slate-600">{u.department || "—"}</td>
                  <td className="py-3 px-3 text-slate-600">{u.role || "—"}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={
                        "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border " +
                        (u.status === "Active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200")
                      }
                    >
                      <span
                        className={
                          "w-1.5 h-1.5 rounded-full " +
                          (u.status === "Active" ? "bg-emerald-500" : "bg-slate-400")
                        }
                      />
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">{u.lastLogin}</td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        aria-label={"Edit " + u.name}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "toggle", user: u })}
                        aria-label={u.status === "Active" ? "Deactivate " + u.name : "Activate " + u.name}
                        className={
                          u.status === "Active"
                            ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50 p-1.5 rounded transition-colors"
                            : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 p-1.5 rounded transition-colors"
                        }
                      >
                        {u.status === "Active" ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: "delete", user: u })}
                        aria-label={"Delete " + u.name}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        Users are managed on the frontend and stored locally. They are not saved to the backend database
        until the authentication API is connected.
      </p>

      {/* Add / Edit modal */}
      <Modal
        open={formOpen}
        title={form.id === null ? "Add User" : "Edit User"}
        width="max-w-lg"
        onClose={() => setFormOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Name</label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className={fieldClass("name")}
              placeholder="Full name"
            />
            {formErrors.name && <p className="text-[11px] font-medium text-rose-600">{formErrors.name}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Username</label>
            <input
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              className={fieldClass("username")}
              placeholder="username"
            />
            {formErrors.username && (
              <p className="text-[11px] font-medium text-rose-600">{formErrors.username}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Department</label>
              <select
                value={form.department}
                onChange={(e) => setField("department", e.target.value)}
                className={fieldClass("department")}
              >
                <option value="">Select department…</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {formErrors.department && (
                <p className="text-[11px] font-medium text-rose-600">{formErrors.department}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Role</label>
              <select
                value={form.role}
                onChange={(e) => setField("role", e.target.value)}
                className={fieldClass("role")}
              >
                <option value="">Select role…</option>
                {ROLE_NAMES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {formErrors.role && <p className="text-[11px] font-medium text-rose-600">{formErrors.role}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600">Status</label>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="radio"
                  checked={form.status === "Active"}
                  onChange={() => setField("status", "Active")}
                  className="accent-blue-600"
                />
                Active
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="radio"
                  checked={form.status === "Inactive"}
                  onChange={() => setField("status", "Inactive")}
                  className="accent-blue-600"
                />
                Inactive
              </label>
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              {form.id === null ? "Add User" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation modal */}
      <Modal
        open={confirm !== null}
        title={confirm?.kind === "delete" ? "Delete User" : confirm?.user.status === "Active" ? "Deactivate User" : "Activate User"}
        width="max-w-sm"
        onClose={() => setConfirm(null)}
      >
        {confirm && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              {confirm.kind === "delete" ? (
                <>
                  Are you sure you want to delete <strong>{confirm.user.name}</strong>? This cannot be
                  undone.
                </>
              ) : (
                <>
                  Are you sure you want to {confirm.user.status === "Active" ? "deactivate" : "activate"}{" "}
                  <strong>{confirm.user.name}</strong>?
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm.kind === "delete" ? handleDelete : handleToggle}
                className={
                  "px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all " +
                  (confirm.kind === "delete"
                    ? "bg-rose-500 hover:bg-rose-600"
                    : confirm.user.status === "Active"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-emerald-600 hover:bg-emerald-700")
                }
              >
                {confirm.kind === "delete" ? "Delete" : confirm.user.status === "Active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
