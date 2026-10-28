import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Activity,
  ChevronRight,
  Crown,
  UserPlus,
  Loader2,
  FileText,
  CheckCircle,
  Move,
  Edit3,
  Plus,
} from 'lucide-react'
import { activityApi } from '../../api/activity'
import { formatTimeAgo } from '../../utils/dates'
import type { ProjectMember, ActivityEvent } from '../../types'

interface Props {
  projectId: string
  isOwner: boolean
  members: ProjectMember[]
  onOpenInvite?: () => void
  onOpenFullActivity?: () => void
}

function getActivityIcon(eventType: string) {
  switch (eventType) {
    case 'card.moved':
      return {
        bg: 'bg-purple-100 text-purple-600',
        icon: <FileText className="h-3.5 w-3.5" />,
      }
    case 'card.completed':
      return {
        bg: 'bg-red-100 text-red-600',
        icon: <CheckCircle className="h-3.5 w-3.5" />,
      }
    case 'card.created':
      return {
        bg: 'bg-emerald-100 text-emerald-600',
        icon: <Plus className="h-3.5 w-3.5" />,
      }
    case 'card.updated':
      return {
        bg: 'bg-amber-100 text-amber-600',
        icon: <Edit3 className="h-3.5 w-3.5" />,
      }
    default:
      return {
        bg: 'bg-blue-100 text-blue-600',
        icon: <Move className="h-3.5 w-3.5" />,
      }
  }
}

export function RightSideWidgets({
  projectId,
  isOwner,
  members,
  onOpenInvite,
  onOpenFullActivity,
}: Props) {
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['activity', projectId, 1],
    queryFn: () => activityApi.list(projectId, 1, 8),
  })

  const activities = activityData?.items ?? []

  return (
    <div className="w-[330px] shrink-0 h-full overflow-y-auto p-4 space-y-4 border-l border-gray-100 bg-[#F8FAFC]/50 select-none">
      {/* ── 1. Members Section ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100/60 mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-700" />
            <h3 className="text-xs font-bold text-gray-900">Members</h3>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>

        {/* Member Items */}
        <div className="space-y-2.5">
          {members.map(m => {
            const displayName = m.name ?? m.user?.name ?? m.email ?? m.user?.email ?? 'Demo User'
            const displayEmail = m.email ?? m.user?.email ?? ''
            const isItemOwner = m.role === 'owner'
            const initials = displayName
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || 'DE'

            return (
              <div key={m.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-xs flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">{displayName}</p>
                    <p className="text-[11px] text-gray-400 truncate">{displayEmail}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isItemOwner ? (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crown className="h-3 w-3 text-amber-600" /> Owner
                    </span>
                  ) : (
                    <span className="bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                      Member
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Invite Member Button: ONLY VISIBLE TO OWNER */}
        {isOwner ? (
          <div className="pt-3 mt-2 border-t border-gray-100/60">
            <button
              onClick={onOpenInvite}
              className="w-full bg-white hover:bg-blue-50/50 text-blue-600 border border-blue-200 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" /> Invite member
            </button>
          </div>
        ) : (
          <div className="mt-3 pt-2 border-t border-gray-100/60">
            <p className="text-[10px] text-gray-400 text-center italic">
              Members are managed exclusively by project owners.
            </p>
          </div>
        )}
      </div>

      {/* ── 2. Recent Activity Section ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div
          onClick={onOpenFullActivity}
          className="flex items-center justify-between pb-3 border-b border-gray-100/60 mb-3 cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-700 group-hover:text-blue-600 transition-colors" />
            <h3 className="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              Recent Activity
            </h3>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
        </div>

        {activityLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {activities.length === 0 && (
              <p className="text-xs text-gray-400 italic">No recent activity.</p>
            )}
            {activities.map((ev: ActivityEvent) => {
              const actorMember = members.find(m => m.user_id === ev.actor_id)
              const actorName = actorMember?.name ?? actorMember?.user?.name ?? 'Demo Owner'
              const details = ev.details ?? {}
              const title = (details.title ?? details.card_title ?? details.name ?? 'a card') as string
              const targetCol = (details.target_column_name ?? details.column_name ?? '') as string
              const timeAgo = formatTimeAgo(ev.created_at)

              let actionText = `interacted with ${title}`
              if (ev.event_type === 'card.moved') {
                actionText = `moved ${title}${targetCol ? ` to ${targetCol}` : ' to Done'}`
              } else if (ev.event_type === 'card.created') {
                actionText = `created ${title}`
              } else if (ev.event_type === 'card.updated') {
                actionText = `updated ${title}`
              } else if (ev.event_type === 'comment.created') {
                actionText = `commented on ${title}`
              }

              const { bg, icon } = getActivityIcon(ev.event_type)

              return (
                <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                    {icon}
                  </div>
                  <div className="min-w-0 flex-1 leading-snug">
                    <p className="text-xs text-gray-800">
                      <strong className="font-bold text-gray-900">{actorName}</strong>{' '}
                      <span className="text-gray-600">{actionText}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
