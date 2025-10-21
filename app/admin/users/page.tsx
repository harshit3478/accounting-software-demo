'use client';

import { useState, useEffect } from 'react';
import Navigation from '../../../components/Navigation';

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'accountant', privileges: { documents: { upload: false, delete: false, rename: false } } });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
      setMessage('User created successfully');
      setNewUser({ email: '', password: '', name: '', role: 'accountant', privileges: { documents: { upload: false, delete: false, rename: false } } });
      fetchUsers();
    } else {
      const data = await res.json();
      setMessage(data.error);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setMessage('');
    setUpdating(true);

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUser),
      });

      if (res.ok) {
        setMessage('User updated successfully');
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        setMessage(data.error);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    setDeletingId(id);
    try {
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setMessage('User deleted successfully');
        fetchUsers();
      } else {
        const data = await res.json();
        setMessage(data.error);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className='bg-gray-50 hero-pattern min-h-screen'>
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Manage Users</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Create New User</h2>
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
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    className="w-full border text-gray-900 border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? '👁️' : '👁️‍🗨️'}
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
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            
            {newUser.role === 'accountant' && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Permissions</h3>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.privileges.documents.upload}
                      onChange={(e) => setNewUser({
                        ...newUser,
                        privileges: {
                          documents: {
                            ...newUser.privileges.documents,
                            upload: e.target.checked
                          }
                        }
                      })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Upload</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.privileges.documents.delete}
                      onChange={(e) => setNewUser({
                        ...newUser,
                        privileges: {
                          documents: {
                            ...newUser.privileges.documents,
                            delete: e.target.checked
                          }
                        }
                      })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Delete</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newUser.privileges.documents.rename}
                      onChange={(e) => setNewUser({
                        ...newUser,
                        privileges: {
                          documents: {
                            ...newUser.privileges.documents,
                            rename: e.target.checked
                          }
                        }
                      })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Rename</span>
                  </label>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-4">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition duration-200">
                Create User
              </button>
              {message && (
                <p className={`text-sm font-medium ${message.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                  {message}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
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
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {user.role === 'accountant' && user.privileges ? (
                      <div className="flex gap-1">
                        <span className={`px-2 py-0.5 text-xs rounded ${user.privileges.documents.upload ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.privileges.documents.upload ? '✓' : '✗'} Upload
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${user.privileges.documents.delete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.privileges.documents.delete ? '✓' : '✗'} Delete
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${user.privileges.documents.rename ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {user.privileges.documents.rename ? '✓' : '✗'} Rename
                        </span>
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
                      disabled={deletingId !== null}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={deletingId !== null}
                      className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === user.id ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Deleting...
                        </>
                      ) : 'Delete'}
                    </button>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
          )}
        </div>

        {editingUser && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300">
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 opacity-100 animate-fadeIn">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Edit User</h2>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="p-6">
                <form onSubmit={handleEditUser}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="user@example.com"
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
                        placeholder="Full Name"
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
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              
              {editingUser.role === 'accountant' && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Document Permissions</h3>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.privileges?.documents?.upload || false}
                        onChange={(e) => setEditingUser({
                          ...editingUser,
                          privileges: {
                            documents: {
                              upload: e.target.checked,
                              delete: editingUser.privileges?.documents?.delete || false,
                              rename: editingUser.privileges?.documents?.rename || false
                            }
                          }
                        })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Upload</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.privileges?.documents?.delete || false}
                        onChange={(e) => setEditingUser({
                          ...editingUser,
                          privileges: {
                            documents: {
                              upload: editingUser.privileges?.documents?.upload || false,
                              delete: e.target.checked,
                              rename: editingUser.privileges?.documents?.rename || false
                            }
                          }
                        })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Delete</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingUser.privileges?.documents?.rename || false}
                        onChange={(e) => setEditingUser({
                          ...editingUser,
                          privileges: {
                            documents: {
                              upload: editingUser.privileges?.documents?.upload || false,
                              delete: editingUser.privileges?.documents?.delete || false,
                              rename: e.target.checked
                            }
                          }
                        })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Rename</span>
                    </label>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-4 mt-6">
                <button 
                  type="submit" 
                  disabled={updating}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {updating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : 'Update User'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={updating}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-6 py-2.5 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
}