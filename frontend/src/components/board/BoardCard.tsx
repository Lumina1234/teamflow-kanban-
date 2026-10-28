import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, User } from 'lucide-react'
import { cn } from '../../utils/cn'
import { isOverdue, formatDateShort } from '../../utils/dates'
import type { Card } from '../../types'

interface BoardCardProps {
  card: Card
  onClick: () => void
}

export function BoardCard({ card, onClick }: BoardCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-3 cursor-pointer select-none',
        'hover:shadow-md hover:border-gray-300 transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        isDragging && 'opacity-40 shadow-lg'
      )}
      tabIndex={0}
      role="button"
      aria-label={`Open card: ${card.title}`}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map(label => (
            <span
              key={label.id}
              className="inline-block h-1.5 w-8 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 leading-snug mb-2">
        {card.title}
      </p>

      {/* Footer: assignee + due date */}
      <div className="flex items-center justify-between mt-1">
        {card.assignee_id ? (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[80px]">Assigned</span>
          </div>
        ) : <span />}

        {card.due_date && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs rounded px-1.5 py-0.5',
              overdue
                ? 'text-red-700 bg-red-50'
                : 'text-gray-500 bg-gray-100'
            )}
          >
            <Calendar className="h-3 w-3" />
            {formatDateShort(card.due_date)}
          </span>
        )}
      </div>
    </div>
  )
}
