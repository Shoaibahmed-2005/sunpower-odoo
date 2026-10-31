import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, KeyRound, Shield, X, AlertCircle } from "lucide-react";
import {
  api,
  useAuth,
  PageHeader,
  DataTable,
  Badge,
  Button,
  toast,
  formatDate,
  formatINR,
  inputCls,
  panelCls,
} from "../sales/ui";

export interface UserItem {
  id: number;
  name: string;
  loginId: string;
  role: string;
  hourlyRate: number;
  active: boolean;
  createdAt: string;
}

const ROLES = ["ADMIN", "SALES", "TECHNICIAN", "WAREHOUSE", "SUPPORT"] as const;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  SALES: "Sales",
  TECHNICIAN: "Technician",
  WAREHOUSE: "Warehouse",
  SUPPORT: "Support",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [resetUser, setResetUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // New user form state
  const [formName, setFormName] = useState("");
  const [formLoginId, setFormLoginId] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<string>("SALES");
  const [formHourlyRate, setFormHourlyRate] = useState<number>(0);

  // Load all users
  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery<UserItem[]>({
    queryKey: ["admin", "users"],
    queryFn: () => api.get("/users/all").then((r) => r.data),
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      loginId: string;
      password: string;
      role: string;
      hourlyRate: number;
    }) => api.post("/users", data),
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowAddForm(false);
      setFormName("");
      setFormLoginId("");
      setFormPassword("");
      setFormRole("SALES");
      setFormHourlyRate(0);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || "Failed to create user";
      toast.error(msg);
    },
  });

  // Update user (role, active, etc.)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UserItem> }) =>
      api.patch(`/users/${id}`, data),
    onSuccess: (_res, variables) => {
      if (variables.data.role) {
        toast.success(`Role updated to ${ROLE_LABELS[variables.data.role] || variables.data.role}`);
      } else if (variables.data.active !== undefined) {
        toast.success(variables.data.active ? "User reactivated" : "User deactivated");
      } else {
        toast.success("User updated successfully");
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || "Failed to update user";
      toast.error(msg);
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api.post(`/users/${id}/reset-password`, { password }),
    onSuccess: () => {
      toast.success("Password reset successfully");
      setResetUser(null);
      setNewPassword("");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || "Failed to reset password";
      toast.error(msg);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formLoginId.trim() || !/^[a-z][a-z0-9.]{2,29}$/.test(formLoginId.trim())) {
      toast.error("Login ID must be 3-30 chars, lowercase letters, numbers, or dots (starts with letter)");
      return;
    }
    if (formPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    createMutation.mutate({
      name: formName.trim(),
      loginId: formLoginId.trim().toLowerCase(),
      password: formPassword,
      role: formRole,
      hourlyRate: Number(formHourlyRate) || 0,
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    resetPasswordMutation.mutate({ id: resetUser.id, password: newPassword });
  };

  const columns = [
    {
      key: "name",
      label: "User",
      render: (u: UserItem) => (
        <div>
          <div className="font-medium text-[var(--text)] flex items-center gap-1.5">
            {u.name}
            {u.id === currentUser?.id && (
              <span className="text-[10px] bg-[var(--primary)]/15 text-[var(--primary)] px-1.5 py-0.2 rounded font-semibold">
                You
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--muted)] font-mono">{u.loginId}</div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (u: UserItem) => {
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="flex items-center gap-2">
            <select
              aria-label={`Change role for ${u.name}`}
              className={`${inputCls} w-auto text-xs py-1 h-8 ${
                isSelf ? "opacity-60 cursor-not-allowed" : ""
              }`}
              value={u.role}
              disabled={isSelf || updateMutation.isPending}
              title={isSelf ? "You cannot change your own role" : "Change staff role"}
              onChange={(e) => updateMutation.mutate({ id: u.id, data: { role: e.target.value } })}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        );
      },
    },
    {
      key: "hourlyRate",
      label: "Hourly Rate",
      render: (u: UserItem) => (
        <span className="font-mono text-xs">
          {u.hourlyRate > 0 ? `${formatINR(u.hourlyRate)}/hr` : "—"}
        </span>
      ),
    },
    {
      key: "active",
      label: "Status",
      render: (u: UserItem) => (
        <Badge status={u.active ? "DONE" : "FAILED"}>
          {u.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (u: UserItem) => (
        <span className="text-xs text-[var(--muted)]">{formatDate(u.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right" as const,
      render: (u: UserItem) => {
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={KeyRound}
              onClick={() => {
                setResetUser(u);
                setNewPassword("");
              }}
            >
              Reset Pass
            </Button>
            {u.active ? (
              <Button
                size="sm"
                variant="danger"
                disabled={isSelf || updateMutation.isPending}
                disabledReason={isSelf ? "You cannot deactivate your own account" : undefined}
                onClick={() => updateMutation.mutate({ id: u.id, data: { active: false } })}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ id: u.id, data: { active: true } })}
              >
                Reactivate
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        subtitle="Manage staff accounts, credentials, and access permissions"
        actions={
          <Button
            variant="primary"
            icon={showAddForm ? X : UserPlus}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "Cancel" : "Add User"}
          </Button>
        }
      />

      {/* Add User Panel */}
      {showAddForm && (
        <div className={panelCls}>
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-4">
            <h3 className="font-heading font-semibold text-base text-[var(--text)] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--primary)]" />
              Create New Staff User
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1" htmlFor="new-name">
                Full Name *
              </label>
              <input
                id="new-name"
                type="text"
                className={inputCls}
                placeholder="e.g. Rahul Sharma"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1" htmlFor="new-login-id">
                Login ID * (small letters, numbers, dot)
              </label>
              <input
                id="new-login-id"
                type="text"
                className={inputCls}
                placeholder="e.g. rahul"
                value={formLoginId}
                onChange={(e) => setFormLoginId(e.target.value.toLowerCase())}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1" htmlFor="new-password">
                Initial Password * (min 8 chars)
              </label>
              <input
                id="new-password"
                type="password"
                className={inputCls}
                placeholder="At least 8 characters"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1" htmlFor="new-role">
                Assigned Role *
              </label>
              <select
                id="new-role"
                className={inputCls}
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1" htmlFor="new-hourly-rate">
                Hourly Rate (₹)
              </label>
              <input
                id="new-hourly-rate"
                type="number"
                min="0"
                max="10000"
                className={inputCls}
                placeholder="400 for technicians"
                value={formHourlyRate}
                onChange={(e) => setFormHourlyRate(Number(e.target.value))}
              />
            </div>

            <div className="flex items-end gap-2 lg:col-span-1">
              <Button
                type="submit"
                variant="primary"
                loading={createMutation.isPending}
                className="w-full"
              >
                Create User
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-lg text-[var(--text)] flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[var(--primary)]" />
                Reset Password
              </h3>
              <button
                onClick={() => setResetUser(null)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--muted)] mb-4">
              Enter a new password for <span className="font-semibold text-[var(--text)]">{resetUser.name}</span>{" "}
              (<span className="font-mono text-xs">{resetUser.loginId}</span>).
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1" htmlFor="modal-reset-pass">
                  New Password (min 8 chars)
                </label>
                <input
                  id="modal-reset-pass"
                  type="password"
                  className={inputCls}
                  placeholder="Enter at least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setResetUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={resetPasswordMutation.isPending}
                >
                  Save Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users DataTable */}
      {isError ? (
        <div className="p-4 rounded-[var(--radius)] bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Failed to load staff users. Ensure you have administrative privileges.</span>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={users}
          loading={isLoading}
          searchPlaceholder="Search staff by name or login ID…"
          emptyMessage="No users found."
        />
      )}
    </div>
  );
}
