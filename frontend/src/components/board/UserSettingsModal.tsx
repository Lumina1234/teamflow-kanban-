import { useState } from 'react'
import {
  X,
  User as UserIcon,
  Mail,
  Shield,
  Key,
  Briefcase,
  Users,
  Check,
  Loader2,
  Lock,
  LogOut,
} from 'lucide-react'
import { authApi } from '../../api/auth'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../providers/ToastProvider'
import { extractError } from '../../utils/errors'
import type { Project } from '../../types'

interface Props {
  project?: Project | null
  onClose: () => void
}

export function UserSettingsModal({ project, onClose }: Props) {
  const { user, logout } = useAuth()
  const { toast } = useToast()

  const [name, setName] = useState(user?.name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'DE'

  const roleLabel = project?.my_role === 'owner' ? '👑 Owner / Project Lead' : 'Team Member'
  const teamLabel = project?.my_team_name ?? 'Engineering Team'
  const jobRoleLabel = project?.my_job_role
    ? project.my_job_role.charAt(0).toUpperCase() + project.my_job_role.slice(1)
    : (project?.my_role === 'owner' ? 'Project Lead' : 'Engineer')

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    setSavingProfile(true)
    try {
      await authApi.updateProfile({ name: name.trim() })
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setSavingPassword(true)
    try {
      await authApi.updateProfile({
        current_password: currentPassword,
        new_password: newPassword,
      })
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">User Profile & Account Settings</h2>
              <p className="text-xs text-gray-500">Manage your credentials, team role, and security settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identity Card */}
          <div className="bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border border-blue-100 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base text-gray-900 truncate">{user?.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                  Active
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  {user?.email}
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Team & Role Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs font-semibold mb-1">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                <span>Assigned Team</span>
              </div>
              <p className="text-sm font-bold text-gray-900 truncate">{teamLabel}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs font-semibold mb-1">
                <Briefcase className="h-3.5 w-3.5 text-purple-500" />
                <span>Job Role</span>
              </div>
              <p className="text-sm font-bold text-gray-900 truncate">{jobRoleLabel}</p>
            </div>
          </div>

          {/* Edit Profile Form */}
          <form onSubmit={handleUpdateName} className="space-y-3 pt-1">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-blue-600" />
              <span>Personal Information</span>
            </h4>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium text-gray-800"
                  placeholder="Enter your name"
                />
                <button
                  type="submit"
                  disabled={savingProfile || name.trim() === (user?.name ?? '')}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                >
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save Name
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email ?? ''}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed font-medium"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Email address is managed by your project administrator.
              </span>
            </div>
          </form>

          {/* Change Password Form */}
          <form onSubmit={handleChangePassword} className="space-y-3 border-t border-gray-100 pt-5">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-amber-500" />
              <span>Security & Password</span>
            </h4>

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    placeholder="Min 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingPassword || !currentPassword || !newPassword}
                  className="bg-gray-900 hover:bg-black disabled:opacity-40 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                >
                  {savingPassword ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  Update Password
                </button>
              </div>
            </div>
          </form>

          {/* Session Expiry & Logout */}
          <div className="border-t border-gray-100 pt-4 flex items-center justify-between text-xs text-gray-500">
            <span>Session: 7-day secure HTTP-only cookie</span>
            <button
              onClick={() => logout()}
              className="text-red-600 hover:text-red-700 font-bold flex items-center gap-1 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
