"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ManagedUser } from "@/lib/api";
import { PageErrorBanner } from "@/components/page-error-banner";

export default function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER">("USER");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const loadUsers = async () => {
    try {
      setUsers(await api.listUsers());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser(username, password, role);
      setUsername("");
      setPassword("");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New password and confirm password do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordError("");
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (e) {
      setPasswordSaved(false);
      setPasswordError(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageErrorBanner message={error} />
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Create User</h2>
        <form className="grid grid-cols-4 gap-3" onSubmit={handleCreate}>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" required />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" required />
          <Select value={role} onValueChange={(v) => setRole(v as "ADMIN" | "USER") }>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="USER">USER</SelectItem><SelectItem value="ADMIN">ADMIN</SelectItem></SelectContent>
          </Select>
          <Button type="submit">Create</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Change Password</h2>
        <form className="grid grid-cols-4 gap-3" onSubmit={handleChangePassword}>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="current password"
            required
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="new password"
            required
          />
          <Input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="confirm new password"
            required
          />
          <Button type="submit" disabled={isChangingPassword}>
            {isChangingPassword ? "Updating..." : "Update Password"}
          </Button>
        </form>
        {passwordError && <p className="text-sm text-red-500 mt-3">{passwordError}</p>}
        {passwordSaved && <p className="text-sm text-green-600 mt-3">Password changed successfully</p>}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Users</h2>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between border border-border rounded p-3">
              <div>
                <p className="text-sm font-medium">{u.username}</p>
                <p className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{u.role}</Badge>
                {!u.active && <Badge variant="secondary">inactive</Badge>}
                <Button size="sm" variant="outline" onClick={() => void handleDelete(u.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
