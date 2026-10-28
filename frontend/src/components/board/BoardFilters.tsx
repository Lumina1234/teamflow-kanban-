import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { labelsApi } from '../../api/labels'
import { membersApi } from '../../api/members'
import { teamsApi } from '../../api/teams'
import type { BoardFilters, Label, ProjectMember, Team } from '../../types'

interface Props {
  projectId: string
  filters: BoardFilters
  onAssignee: (id: string | undefined) => void
  onLabel: (id: string | undefined) => void
  onOverdue: (v: boolean | undefined) => void
  onTeam: (id: string | undefined) => void
  onClear: () => void
}

export function BoardFilters({ projectId, filters, onAssignee, onLabel, onOverdue, onTeam, onClear }: Props) {
  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
  })

  const { data: labels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
  })

  const { data: teams = [] } = useQuery({
    queryKey: ['teams', projectId],
    queryFn: () => teamsApi.list(projectId),
  })

  const hasFilters = !!(filters.assignee_id || filters.label_id || filters.overdue || filters.team_id)

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-wrap shrink-0">
      {/* Team */}
      {teams.length > 0 && (
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 font-medium">Team</label>
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-400 outline-none bg-white font-medium text-gray-700"
            value={filters.team_id ?? ''}
            onChange={e => onTeam(e.target.value || undefined)}
          >
            <option value="">All Teams</option>
            {teams.map((t: Team) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Assignee */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 font-medium">Assignee</label>
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-400 outline-none bg-white font-medium text-gray-700"
          value={filters.assignee_id ?? ''}
          onChange={e => onAssignee(e.target.value || undefined)}
        >
          <option value="">All Members</option>
          {members.map((m: ProjectMember) => (
            <option key={m.user_id} value={m.user_id}>{m.name ?? m.user?.name ?? m.user_id}</option>
          ))}
        </select>
      </div>

      {/* Label */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 font-medium">Label</label>
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-400 outline-none bg-white font-medium text-gray-700"
          value={filters.label_id ?? ''}
          onChange={e => onLabel(e.target.value || undefined)}
        >
          <option value="">All Labels</option>
          {labels.map((l: Label) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Overdue toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          checked={!!filters.overdue}
          onChange={e => onOverdue(e.target.checked || undefined)}
        />
        <span className="text-xs text-gray-600 font-medium">Overdue only</span>
      </label>

      {/* Clear */}
      {hasFilters && (
        <button onClick={onClear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 ml-auto">
          <X className="h-3 w-3" /> Clear filters
        </button>
      )}
    </div>
  )
}
