import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, MoreVertical } from 'lucide-react'
import { cn } from '../../utils/cn'
import { isOverdue, formatDateShort } from '../../utils/dates'
import type { Card, ProjectMember } from '../../types'

interface BoardCardProps {
  card: Card
  onClick: () => void
  members?: ProjectMember[]
}

function getLabelStyle(name: string) {
  const n = name.toLowerCase()
  if (n === 'feature') return 'bg-blue-50 text-blue-600 border-blue-100'
  if (n === 'backend') return 'bg-purple-50 text-purple-600 border-purple-100'
  if (n.includes('ui')) return 'bg-pink-50 text-pink-600 border-pink-100'
  if (n === 'export') return 'bg-emerald-50 text-emerald-600 border-emerald-100'
  if (n.includes('real')) return 'bg-rose-50 text-rose-600 border-rose-100'
  if (n.includes('attach')) return 'bg-sky-50 text-sky-600 border-sky-100'
  if (n.includes('sec')) return 'bg-amber-50 text-amber-600 border-amber-100'
  if (n.includes('web')) return 'bg-amber-50 text-amber-600 border-amber-100'
  if (n.includes('bug')) return 'bg-red-50 text-red-600 border-red-100'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

export function BoardCard({ card, onClick, members = [] }: BoardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const overdue = card.due_date ? isOverdue(card.due_date) : false

  // Find assignee name and initials
  const assigneeMember = members.find(m => m.user_id === card.assignee_id)
  const assigneeName = assigneeMember?.name ?? assigneeMember?.user?.name ?? (card.assignee_id ? 'Demo Owner' : null)
  const initials = assigneeName
    ? assigneeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'DE'

  // Has security / priority accent on left border
  const hasAmberAccent = card.labels?.some(l => l.name.toLowerCase().includes('sec'))

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-gray-100/90 p-4 cursor-pointer select-none',
        'shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-gray-200 transition-all group relative',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        hasAmberAccent && 'border-l-[3.5px] border-l-amber-400',
        isDragging && 'opacity-40 shadow-xl'
      )}
      tabIndex={0}
      role="button"
      aria-label={`Open card: ${card.title}`}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Top row: Label pills, Team badge, and options button */}
      <div className="flex items-center justify-between mb-2 gap-1.5 flex-wrap">
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Responsible Team Badge */}
          {card.team_name && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              {card.team_name}
            </span>
          )}

          {/* Visibility / Shared Pill */}
          {card.visibility === 'hr_only' && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              🔒 HR Only
            </span>
          )}
          {card.shared_teams && card.shared_teams.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              Shared: {card.shared_teams.join(', ')}
            </span>
          )}

          {card.labels && card.labels.length > 0 && (
            card.labels.map(label => (
              <span
                key={label.id}
                className={cn(
                  'text-[10px] font-semibold px-2.5 py-0.5 rounded-full border',
                  getLabelStyle(label.name)
                )}
              >
                {label.name}
              </span>
            ))
          )}
        </div>
        <button
          onClick={e => {
            e.stopPropagation()
            onClick()
          }}
          className="text-gray-300 hover:text-gray-500 p-0.5 rounded transition-colors ml-auto"
          title="Card options"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Title */}
      <h3 className="text-sm font-bold text-gray-900 leading-snug mb-1">
        {card.title}
      </h3>

      {/* Description */}
      {card.description && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
          {card.description}
        </p>
      )}

      {/* Footer: Assignee + Due Date */}
      <div className="flex items-center justify-between pt-1 text-xs">
        {/* Left: Avatar + Assignee Name */}
        {assigneeName ? (
          <div className="flex items-center gap-1.5 text-gray-500">
            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold text-[10px] flex items-center justify-center shrink-0">
              {initials}
            </div>
            <span className="text-xs text-gray-500 font-medium truncate max-w-[130px]">
              {assigneeName}
            </span>
          </div>
        ) : (
          <div />
        )}

        {/* Right: Due Date */}
        {card.due_date && (
          <div
            className={cn(
              'flex items-center gap-1 font-semibold text-xs',
              overdue ? 'text-red-500' : 'text-gray-400'
            )}
          >
            <Calendar className={cn('h-3.5 w-3.5', overdue ? 'text-red-500' : 'text-gray-400')} />
            <span>{formatDateShort(card.due_date)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
