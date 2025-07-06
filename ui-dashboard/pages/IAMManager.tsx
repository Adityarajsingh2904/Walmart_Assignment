import React, { useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Card,
  Grid,
  Badge,
  Dialog,
  Table,
  Button,
  Form,
  Input,
  Checkbox,
  Textarea,
} from 'shadcn/ui';
import { z } from 'zod';

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface Rule {
  id: string;
  code: string;
}

interface Session {
  id: string;
  userId: string;
  ip: string;
  active: boolean;
}

const jsonLogicSchema = z.record(z.any());

function Loading() {
  return (
    <div className="flex justify-center p-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  );
}

function UserDirectory({ users }: { users: User[] }) {
  return (
    <Grid className="gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
      {users.map((u) => (
        <Card key={u.id} className="p-4 space-y-1">
          <h3 className="font-semibold text-sm">{u.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <Badge key={r}>{r}</Badge>
            ))}
          </div>
        </Card>
      ))}
    </Grid>
  );
}

function RoleEditor({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role?: Role;
}) {
  const [name, setName] = useState(role?.name || '');
  const [permissions, setPermissions] = useState<string[]>(role?.permissions || []);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      const method = role ? 'PUT' : 'POST';
      const url = role ? `/api/roles/${role.id}` : '/api/roles';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, permissions }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['/api/roles']);
      onClose();
    },
  });

  const togglePermission = (p: string) => {
    setPermissions((perms) =>
      perms.includes(p) ? perms.filter((x) => x !== p) : [...perms, p]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <Dialog.Content>
        <Dialog.Title>{role ? 'Edit Role' : 'Create Role'}</Dialog.Title>
        <Form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-2">
            <label className="flex flex-col gap-1">
              <span>Role Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="space-y-1">
              <span>Permissions</span>
              <div className="grid grid-cols-2 gap-2">
                {['read', 'write', 'delete', 'admin'].map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={permissions.includes(p)}
                      onCheckedChange={() => togglePermission(p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </Form>
      </Dialog.Content>
    </Dialog>
  );
}

function RuleBuilder({
  open,
  onClose,
  rule,
}: {
  open: boolean;
  onClose: () => void;
  rule?: Rule;
}) {
  const [code, setCode] = useState(rule?.code || '');
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      let json: unknown;
      try {
        json = JSON.parse(code);
      } catch (err) {
        throw new Error('Invalid JSON');
      }
      jsonLogicSchema.parse(json);
      const method = rule ? 'PUT' : 'POST';
      const url = rule ? `/api/rules/${rule.id}` : '/api/rules';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['/api/rules']);
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <Dialog.Content className="space-y-2">
        <Dialog.Title>{rule ? 'Edit Rule' : 'Create Rule'}</Dialog.Title>
        <Form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={10}
            className="font-mono"
          />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </Form>
      </Dialog.Content>
    </Dialog>
  );
}

function SessionTable({ sessions }: { sessions: Session[] }) {
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => queryClient.invalidateQueries(['/api/sessions']),
  });
  const forceMfa = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/sessions/${id}/mfa`, { method: 'POST' });
    },
  });
  return (
    <Table>
      <thead>
        <tr>
          <th>User</th>
          <th>IP</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id}>
            <td>{s.userId}</td>
            <td>{s.ip}</td>
            <td className="space-x-2">
              <Button
                size="sm"
                onClick={() => revoke.mutate(s.id)}
                disabled={revoke.isPending}
              >
                Revoke
              </Button>
              <Button
                size="sm"
                onClick={() => forceMfa.mutate(s.id)}
                disabled={forceMfa.isPending}
              >
                Force MFA
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default function IAMManager() {
  const [editingRole, setEditingRole] = useState<Role | undefined>();
  const [editingRule, setEditingRule] = useState<Rule | undefined>();

  const usersQuery = useQuery<User[]>(['/api/users'], () => fetch('/api/users').then((r) => r.json()));
  const sessionsQuery = useQuery<Session[]>(['/api/sessions'], () => fetch('/api/sessions').then((r) => r.json()));

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">User Directory</h2>
        <Button onClick={() => setEditingRole({ id: '', name: '', permissions: [] })}>
          New Role
        </Button>
      </div>
      {usersQuery.isLoading ? <Loading /> : usersQuery.data && <UserDirectory users={usersQuery.data} />}

      {sessionsQuery.data && (
        <Card className="p-4 space-y-2">
          <h2 className="text-lg font-semibold">Active Sessions</h2>
          <SessionTable sessions={sessionsQuery.data} />
        </Card>
      )}

      {editingRole && (
        <RoleEditor open={true} onClose={() => setEditingRole(undefined)} role={editingRole.id ? editingRole : undefined} />
      )}
      {editingRule && (
        <RuleBuilder open={true} onClose={() => setEditingRule(undefined)} rule={editingRule.id ? editingRule : undefined} />
      )}
    </div>
  );
}

