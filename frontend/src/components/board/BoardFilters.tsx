import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { labelsApi } from '../../api/labels'
import { membersApi } from '../../api/members'
import type { BoardFilters, Label, ProjectMember } from '../../types'

interface Props {
  projectId: string
  filters: BoardFilters
  onAssignee: (id: string | undefined) => void
  onLabel: (id: string | undefined) => void
  onOverdue: (v: boolean | undefined) => void
  onClear: () => void
}

export function BoardFilters({ projectId, filters, onAssignee, onLabel, onOverdue, onClear }: Props) {
  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
  })

  const { data: labels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
  })

  const hasFilters = !!(filters.assignee_id || filters.label_id || filters.overdue)

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-wrap shrink-0">
      {/* Assignee */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 font-medium">Assignee</label>
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:border-primary-400 outline-none bg-white"
          value={filters.assignee_id ?? ''}
          onChange={e => onAssignee(e.target.value || undefined)}
        >
          <option value="">All</option>
          {members.map((m: ProjectMember) => (
            <option key={m.user_id} value={m.user_id}>{m.name ?? m.user?.name ?? m.user_id}</option>
          ))}
        </select>
      </div>

      {/* Label */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 font-medium">Label</label>
        <select
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:border-primary-400 outline-none bg-white"
          value={filters.label_id ?? ''}
          onChange={e => onLabel(e.target.value || undefined)}
        >
          <option value="">All</option>
          {labels.map((l: Label) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Overdue toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
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
