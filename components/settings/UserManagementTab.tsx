'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ConfirmModal from '../ConfirmModal';

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
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'accountant',
    privileges: { documents: { upload: false, delete: false, rename: false } },
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [message, setMessage] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [loading, setLoading] = useState(false);
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
    setMessage('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    if (res.ok) {
      showSuccess('User created successfully');
      setMessage('User created successfully');
      setNewUser({
        email: '',
        password: '',
        name: '',
        role: 'accountant',
        privileges: { documents: { upload: false, delete: false, rename: false } },
      });
      fetchUsers();
    } else {
      const data = await res.json();
      setMessage(data.error);
      showError(data.error);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setMessage('');
    setUpdating(true);
    try {
      const updateData: any = {
        id: editingUser.id,
        email: editingUser.email,
        name: editingUser.name,
        role: editingUser.role,
        privileges: editingUser.privileges,
      };
      if (changePassword && editPassword.trim()) {
        updateData.password = editPassword;
      }
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (res.ok) {
        showSuccess('User updated successfully');
        closeEditModal();
        fetchUsers();
      } else {
        const data = await res.json();
        showError(data.error);
      }
    } finally {
      setUpdating(false);
    }
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditPassword('');
    setChangePassword(false);
    setShowEditPassword(false);
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

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">User Management</h2>

      {/* Create User Form */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New User</h3>
        <form onSubmit={handleCreateUser}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                  className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
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
          </div>

          {(newUser.role === 'accountant' || newUser.role === 'staff') && (
            <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Permissions</h3>
              <div className="flex flex-wrap gap-4">
                {(['upload', 'delete', 'rename'] as const).map((perm) => (
                  <label key={perm} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.privileges.documents[perm]}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          privileges: {
                            documents: { ...newUser.privileges.documents, [perm]: e.target.checked },
                          },
                        })
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition duration-200"
          >
            Create User
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading users...</span>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Privileges</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user, index) => (
                <tr key={user.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition duration-150`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(user.role === 'accountant' || user.role === 'staff') && user.privileges ? (
                      <div className="flex gap-1">
                        {(['upload', 'delete', 'rename'] as const).map((perm) => (
                          <span key={perm} className={`px-2 py-0.5 text-xs rounded ${
                            user.privileges!.documents[perm] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {user.privileges!.documents[perm] ? '✓' : '✗'} {perm.charAt(0).toUpperCase() + perm.slice(1)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-xs">All Access</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition duration-200"
                    >
                      Edit
                    </button>
                    <Link
                      href={`/attendance/admin?userId=${user.id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition duration-200"
                    >
                      Attendance
                    </Link>
                    <button
                      onClick={() => setDeleteConfirm({ id: user.id, name: user.name })}
                      disabled={deletingId !== null}
                      className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition duration-200 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Edit User</h2>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <form onSubmit={handleEditUser}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                </div>

                {/* Change Password */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <label className="flex items-center space-x-2 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={changePassword}
                      onChange={(e) => { setChangePassword(e.target.checked); if (!e.target.checked) setEditPassword(''); }}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">Change Password?</span>
                  </label>
                  {changePassword && (
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        placeholder="Enter new password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full border text-gray-900 border-gray-300 p-2.5 pr-16 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 text-sm"
                      >
                        {showEditPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  )}
                </div>

                {(editingUser.role === 'accountant' || editingUser.role === 'staff') && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Permissions</h3>
                    <div className="flex flex-wrap gap-4">
                      {(['upload', 'delete', 'rename'] as const).map((perm) => (
                        <label key={perm} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingUser.privileges?.documents?.[perm] || false}
                            onChange={(e) =>
                              setEditingUser({
                                ...editingUser,
                                privileges: {
                                  documents: {
                                    upload: editingUser.privileges?.documents?.upload || false,
                                    delete: editingUser.privileges?.documents?.delete || false,
                                    rename: editingUser.privileges?.documents?.rename || false,
                                    [perm]: e.target.checked,
                                  },
                                },
                              })
                            }
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 capitalize">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-6">
                  <button
                    type="submit"
                    disabled={updating}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition duration-200 disabled:opacity-50"
                  >
                    {updating ? 'Updating...' : 'Update User'}
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
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
