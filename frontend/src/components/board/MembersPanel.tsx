import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, UserPlus, Trash2, Loader2, Crown, User, ShieldCheck } from 'lucide-react'
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
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'owner'>('member')
  const [inviting, setInviting] = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
  })

  const inviteMutation = useMutation({
    mutationFn: () => membersApi.createInvitation(projectId, inviteEmail.trim(), inviteRole),
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviting(false)
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'member' | 'owner' }) =>
      membersApi.changeMemberRole(projectId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Role updated')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => membersApi.removeMember(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', projectId] })
      toast.success('Member removed')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <h2 className="font-semibold text-gray-900 text-sm">Project Members</h2>
          <p className="text-[11px] text-gray-500">
            {isOwner ? 'Owners manage members & columns' : 'Members collaborate on cards & comments'}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isOwner && (
        <div className="mx-4 mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            You are a <strong>Member</strong>. You have full access to create, move, and edit cards, assign teammates, and comment.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary-600" /></div>
        ) : (
          members.map((m: ProjectMember) => {
            const isSelf = m.user_id === user?.id
            const displayName = m.name ?? m.user?.name ?? m.email ?? m.user?.email ?? 'Unknown'
            const displayEmail = m.email ?? m.user?.email ?? ''

            return (
              <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  m.role === 'owner' ? 'bg-amber-100 text-amber-800' : 'bg-primary-100 text-primary-700'
                }`}>
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                    {isSelf && <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">(You)</span>}
                  </div>
                  {displayEmail && <p className="text-xs text-gray-500 truncate">{displayEmail}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isOwner && !isSelf ? (
                    <select
                      value={m.role}
                      onChange={e => changeRoleMutation.mutate({ userId: m.user_id, role: e.target.value as 'member' | 'owner' })}
                      disabled={changeRoleMutation.isPending}
                      className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-700 font-medium cursor-pointer hover:border-primary-400 focus:outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="owner">Owner</option>
                    </select>
                  ) : (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                      m.role === 'owner' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {m.role === 'owner' ? <Crown className="h-3 w-3 text-amber-600" /> : <User className="h-3 w-3 text-gray-400" />}
                      <span className="capitalize">{m.role}</span>
                    </span>
                  )}
                  {isOwner && !isSelf && (
                    <button
                      onClick={() => window.confirm(`Remove ${displayName} from the project?`) && removeMutation.mutate(m.user_id)}
                      className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                      title="Remove member (Owner only)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {isOwner && (
        <div className="border-t border-gray-200 p-4 bg-gray-50/50">
          {inviting ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-600">Invite new member</label>
              <input
                type="email"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-primary-400 outline-none bg-white"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Role:</label>
                <select
                  className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:border-primary-400 outline-none bg-white flex-1"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'member' | 'owner')}
                >
                  <option value="member">Member (cards & comments)</option>
                  <option value="owner">Owner (full control)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => inviteEmail.trim() && inviteMutation.mutate()}
                  disabled={!inviteEmail.trim() || inviteMutation.isPending}
                  className="btn-primary text-xs flex-1"
                >
                  {inviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Send invite
                </button>
                <button onClick={() => setInviting(false)} className="btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setInviting(true)}
              className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 py-2"
            >
              <UserPlus className="h-3.5 w-3.5" /> Invite new member
            </button>
          )}
        </div>
      )}
    </div>
  )
}
