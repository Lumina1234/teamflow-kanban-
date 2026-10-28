import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, UserPlus, MoreVertical, Loader2, Crown, Trash2 } from 'lucide-react'
import { membersApi } from '../../api/members'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../providers/ToastProvider'
import { extractError } from '../../utils/errors'
import type { ProjectMember } from '../../types'

interface Props {
  projectId: string
  isOwner: boolean
  onClose: () => void
}

export function MembersPanel({ projectId, isOwner, onClose }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'owner'>('member')
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuUserId(null)
      }
    }
    if (activeMenuUserId) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [activeMenuUserId])

  const inviteMutation = useMutation({
    mutationFn: () => membersApi.createInvitation(projectId, inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteModalOpen(false)
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'member' | 'owner' }) =>
      membersApi.changeMemberRole(projectId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setActiveMenuUserId(null)
      toast.success('Role updated')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => membersApi.removeMember(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', projectId] })
      setActiveMenuUserId(null)
      toast.success('Member removed')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900">Members</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          title="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Section Title */}
      <div className="px-6 pt-5 pb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">Project members</span>
        <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold flex items-center justify-center">
          {members.length}
        </span>
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : (
          members.map((m: ProjectMember) => {
            const isSelf = m.user_id === user?.id
            const displayName = m.name ?? m.user?.name ?? m.email ?? m.user?.email ?? 'User'
            const displayEmail = m.email ?? m.user?.email ?? ''
            const isItemOwner = m.role === 'owner'
            const initials = displayName
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || 'DE'

            return (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50/80 transition-colors"
              >
                {/* Avatar and user info */}
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{displayName}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{displayEmail}</p>
                  </div>
                </div>

                {/* Role badge & menu */}
                <div className="flex items-center gap-2 shrink-0">
                  {isItemOwner ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                      <Crown className="h-3 w-3 text-amber-600" /> Owner
                    </span>
                  ) : (
                    <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
                      Member
                    </span>
                  )}

                  {/* Options menu for owner */}
                  {isOwner && !isSelf && (
                    <div className="relative" ref={activeMenuUserId === m.user_id ? menuRef : null}>
                      <button
                        onClick={() =>
                          setActiveMenuUserId(activeMenuUserId === m.user_id ? null : m.user_id)
                        }
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Member options"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>

                      {activeMenuUserId === m.user_id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 text-xs">
                          {isItemOwner ? (
                            <button
                              onClick={() => changeRoleMutation.mutate({ userId: m.user_id, role: 'member' })}
                              className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              Demote to Member
                            </button>
                          ) : (
                            <button
                              onClick={() => changeRoleMutation.mutate({ userId: m.user_id, role: 'owner' })}
                              className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Crown className="h-3.5 w-3.5 text-amber-600" />
                              Promote to Owner
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove ${displayName} from the project?`)) {
                                removeMutation.mutate(m.user_id)
                              }
                            }}
                            className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            Remove from project
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Bottom Invite Member Action */}
      {isOwner && (
        <div className="p-5 border-t border-gray-100 bg-white">
          <button
            onClick={() => setInviteModalOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Invite member
          </button>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={e => { if (e.target === e.currentTarget) setInviteModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Invite new member</h3>
              <button onClick={() => setInviteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email address</label>
                <input
                  type="email"
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                <select
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-500 bg-white"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'member' | 'owner')}
                >
                  <option value="member">Member (cards & comments)</option>
                  <option value="owner">Owner (full control)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => inviteEmail.trim() && inviteMutation.mutate()}
                  disabled={!inviteEmail.trim() || inviteMutation.isPending}
                  className="btn-primary text-xs py-2.5 rounded-xl flex-1"
                >
                  {inviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Send Invite
                </button>
                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="btn-secondary text-xs py-2.5 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
