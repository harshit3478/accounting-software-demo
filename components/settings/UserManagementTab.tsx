'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ConfirmModal from '../ConfirmModal';
import { Plus } from 'lucide-react';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  privileges?: {
    documents: {
      upload: boolean;
      delete: boolean;
      rename: boolean;
    };
  };
  createdAt: string;
}

interface UserManagementTabProps {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export default function UserManagementTab({ showSuccess, showError }: UserManagementTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'accountant',
    privileges: { documents: { upload: false, delete: false, rename: false } },
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        showSuccess('User created successfully');
        setShowCreateModal(false);
        setNewUser({
          email: '',
          name: '',
          role: 'accountant',
          privileges: { documents: { upload: false, delete: false, rename: false } },
        });
        fetchUsers();
      } else {
        const data = await res.json();
        showError(data.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true);
    try {
      const updateData: any = {
        id: editingUser.id,
        email: editingUser.email,
        name: editingUser.name,
        role: editingUser.role,
        privileges: editingUser.privileges,
      };
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (res.ok) {
        showSuccess('User updated successfully');
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        showError(data.error);
      }
    } finally {
      setUpdating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeletingId(deleteConfirm.id);
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteConfirm.id }),
      });
      if (res.ok) {
        showSuccess('User deleted successfully');
        setDeleteConfirm(null);
        fetchUsers();
      } else {
        const data = await res.json();
        showError(data.error);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const renderPermissions = (perm: 'upload' | 'delete' | 'rename', checked: boolean, onChange: (val: boolean) => void) => (
    <label key={perm} className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700 capitalize">{perm}</span>
    </label>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">User Management</h2>
          <p className="text-gray-600 text-sm">Manage user accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm"
        >
          <Plus size={16} className="mr-1.5" />
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading users...</span>
          </div>
        ) : (
          <div>
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[25%]">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[15%]">Role</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[18%]">Privileges</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[12%]">Created</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[30%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user, index) => (
                  <tr key={user.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition duration-150`}>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 break-words">{user.name}</div>
                      <div className="text-xs text-gray-500 break-words">{user.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full inline-block ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {(user.role === 'accountant' || user.role === 'staff') && user.privileges ? (
                        <div className="flex flex-wrap gap-1">
                          {(['upload', 'delete', 'rename'] as const).map((perm) => (
                            <span key={perm} className={`px-1.5 py-0.5 text-xs rounded ${
                              user.privileges!.documents[perm] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {perm.charAt(0).toUpperCase()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">All Access</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition duration-200"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/attendance/admin?userId=${user.id}`}
                          className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition duration-200"
                        >
                          Attendance
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm({ id: user.id, name: user.name })}
                          disabled={deletingId !== null}
                          className="px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition duration-200 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setShowCreateModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Create New User</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <form onSubmit={handleCreateUser}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      required
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="accountant">Accountant</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {(newUser.role === 'accountant' || newUser.role === 'staff') && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Permissions</h3>
                      <div className="flex flex-wrap gap-4">
                        {(['upload', 'delete', 'rename'] as const).map((perm) =>
                          renderPermissions(perm, newUser.privileges.documents[perm], (val) =>
                            setNewUser({
                              ...newUser,
                              privileges: {
                                documents: { ...newUser.privileges.documents, [perm]: val },
                              },
                            })
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-4">Users will log in via email OTP. No password is required.</p>

                <div className="flex items-center gap-3 mt-5">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition duration-200 disabled:opacity-50"
                  >
                    {saving ? 'Creating...' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={saving}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-6 py-2.5 rounded-lg transition duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50" onClick={() => !updating && setEditingUser(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <form onSubmit={handleEditUser}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                      required
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      required
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="accountant">Accountant</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {(editingUser.role === 'accountant' || editingUser.role === 'staff') && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Permissions</h3>
                      <div className="flex flex-wrap gap-4">
                        {(['upload', 'delete', 'rename'] as const).map((perm) =>
                          renderPermissions(
                            perm,
                            editingUser.privileges?.documents?.[perm] || false,
                            (val) =>
                              setEditingUser({
                                ...editingUser,
                                privileges: {
                                  documents: {
                                    upload: editingUser.privileges?.documents?.upload || false,
                                    delete: editingUser.privileges?.documents?.delete || false,
                                    rename: editingUser.privileges?.documents?.rename || false,
                                    [perm]: val,
                                  },
                                },
                              })
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={updating}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition duration-200 disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : 'Update User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    disabled={updating}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-6 py-2.5 rounded-lg transition duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete User"
        message={`Are you sure you want to delete user "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        isLoading={deletingId === deleteConfirm?.id}
        danger={true}
      />
    </div>
  );
}
