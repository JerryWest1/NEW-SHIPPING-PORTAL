import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, serverTimestamp, query, where, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, AlertCircle, Shield, Trash2, UserPlus, Send, CheckCircle2, Clock, Edit2, X, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { settingsService } from '../services/settingsService';

interface UserRecord {
  id: string;
  uid?: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  status?: 'active' | 'pending';
  createdAt?: any;
}

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'user'>('user');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [resending, setResending] = useState<string | null>(null);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'users'));
      const userList: UserRecord[] = [];
      snapshot.forEach((doc) => {
        userList.push({
          id: doc.id,
          ...doc.data() as Omit<UserRecord, 'id'>
        });
      });
      setUsers(userList.sort((a, b) => a.email.localeCompare(b.email)));
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      setSaving(userId);
      // userId is the document ID (email)
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      setError('Failed to update user role');
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const startEditing = (user: UserRecord) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editName || !editEmail) return;

    try {
      setSaving(editingUser.id);
      const normalizedEmail = editEmail.toLowerCase();
      const updatedData = {
        name: editName,
        email: normalizedEmail,
        updatedAt: serverTimestamp()
      };

      // Just update the existing document regardless of its ID type
      await updateDoc(doc(db, 'users', editingUser.id), updatedData);
      
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...updatedData } : u));
      setEditingUser(null);
    } catch (err) {
      setError('Failed to update user information');
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const resendInvite = async (user: UserRecord) => {
    try {
      setResending(user.id);
      setError('');
      
      const settings = await settingsService.getSettings();
      if (!settings.inviteUserWebhookUrl) {
        throw new Error('Invite User Webhook URL is not configured in Settings.');
      }

      const isPending = user.status === 'pending';
      const inviteLink = isPending 
        ? `${window.location.origin}?mode=signup&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}`
        : window.location.origin;
      
      const response = await fetch(settings.inviteUserWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          role: user.role,
          invitedBy: currentUser?.name || currentUser?.email,
          inviteLink: inviteLink,
          isResend: isPending,
          isLoginLink: !isPending,
          status: user.status || 'active'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send ${isPending ? 'invite' : 'link'} via webhook`);
      }

      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send request');
      console.error(err);
    } finally {
      setResending(null);
    }
  };

  const deleteUser = async (userRecord: UserRecord) => {
    if (userRecord.uid === currentUser?.uid || userRecord.id === currentUser?.id) {
      alert("You cannot delete your own account.");
      return;
    }

    if (!confirm(`Are you sure you want to delete user ${userRecord.email}? This will remove their access to the system.`)) {
      return;
    }

    try {
      setSaving(userRecord.id);
      
      // If user has a UID, delete from Auth via API
      // If user is pending, they might not have a UID, so we just delete from Firestore.
      const uidToDelete = userRecord.uid;
      
      if (uidToDelete) {
        const response = await fetch('/api/delete-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: uidToDelete })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to delete user from Auth');
        }
      }

      // Delete from Firestore (ID is email)
      await deleteDoc(doc(db, 'users', userRecord.id));
      setUsers(users.filter(u => u.id !== userRecord.id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) return;

    try {
      setInviting(true);
      setError('');
      
      const normalizedEmail = inviteEmail.toLowerCase();
      
      // Check if user already exists
      const userDocRef = doc(db, 'users', normalizedEmail);
      const userSnapshot = await getDoc(userDocRef);
      
      if (userSnapshot.exists()) {
        throw new Error('A user with this email already exists.');
      }

      const settings = await settingsService.getSettings();
      if (!settings.inviteUserWebhookUrl) {
        throw new Error('Invite User Webhook URL is not configured in Settings.');
      }

      // 1. Create a pending user record in Firestore using email as ID
      const newUser = {
        email: normalizedEmail,
        name: inviteName,
        role: inviteRole,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await setDoc(userDocRef, newUser);

      // 2. Trigger n8n webhook
      const inviteLink = `${window.location.origin}?mode=signup&email=${encodeURIComponent(inviteEmail)}&name=${encodeURIComponent(inviteName)}`;
      
      const response = await fetch(settings.inviteUserWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
          invitedBy: currentUser?.name || currentUser?.email,
          inviteLink: inviteLink,
          isResend: false,
          isLoginLink: true,
          status: 'pending'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send invite via webhook');
      }

      setInviteSuccess(true);
      setInviteEmail('');
      setInviteName('');
      fetchUsers(); // Refresh list
      setTimeout(() => setInviteSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
      console.error(err);
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-slate-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">User Management</h1>
          <p className="text-slate-600">Invite and manage team members and their permissions</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invite Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <UserPlus size={18} className="text-indigo-600" />
              <h3 className="font-semibold text-slate-900">Invite New User</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'user')}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  >
                    <option value="user">User (Standard Access)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {inviting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  Send Invite
                </button>
                {inviteSuccess && (
                  <p className="text-sm text-green-600 text-center font-medium animate-pulse">
                    Invite sent successfully!
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                            {user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          {user.role === 'admin' ? <Shield size={14} className="text-indigo-600" /> : <Users size={14} />}
                          {user.role}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          user.status === 'pending' 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {user.status === 'pending' ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                          {user.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === 'pending' ? (
                            <button
                              onClick={() => resendInvite(user)}
                              disabled={resending === user.id}
                              className="text-xs font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
                              title="Resend Invite Link"
                            >
                              {resending === user.id ? (
                                <div className="w-3 h-3 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin" />
                              ) : (
                                <Send size={12} />
                              )}
                              Resend
                            </button>
                          ) : (
                            <button
                              onClick={() => resendInvite(user)}
                              disabled={resending === user.id}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
                              title="Send Portal Link"
                            >
                              {resending === user.id ? (
                                <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                              ) : (
                                <Send size={12} />
                              )}
                              Send Link
                            </button>
                          )}
                          
                          {user.role === 'user' ? (
                            <button
                              onClick={() => changeRole(user.id, 'admin')}
                              disabled={saving === user.id}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider disabled:opacity-50"
                            >
                              Make Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => changeRole(user.id, 'user')}
                              disabled={saving === user.id}
                              className="text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider disabled:opacity-50"
                            >
                              Make User
                            </button>
                          )}
                          
                          {user.id !== currentUser?.id && (
                            <button
                              onClick={() => startEditing(user)}
                              disabled={saving === user.id}
                              className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-all disabled:opacity-50"
                              title="Edit User"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          
                          {user.id !== currentUser?.id && (
                            <button
                              onClick={() => deleteUser(user)}
                              disabled={saving === user.id}
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50"
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {users.length === 0 && (
              <div className="text-center py-12">
                <Users size={48} className="text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">No users found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Edit User Details</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving === editingUser.id}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving === editingUser.id ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};