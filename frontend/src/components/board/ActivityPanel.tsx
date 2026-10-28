import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, ChevronDown } from 'lucide-react'
import { activityApi } from '../../api/activity'
import { formatDate } from '../../utils/dates'
import type { ActivityEvent } from '../../types'

interface Props {
  projectId: string
  onClose: () => void
}

function eventMessage(event: ActivityEvent): string {
  const d = event.details ?? {}
  void (d.actor_name) // reserved for future messages

  switch (event.event_type) {
    case 'card.created':
      return `Created card "${d.title ?? 'Untitled'}"`
    case 'card.moved':
      return `Moved a card`
    case 'card.updated':
      return `Updated a card`
    case 'card.deleted':
      return `Deleted card "${d.title ?? 'Untitled'}"`
    case 'comment.created':
      return `Commented on "${d.card_title ?? 'a card'}"`
    case 'column.created':
      return `Created column "${d.name ?? ''}"`
    case 'column.updated':
      return `Updated column "${d.name ?? ''}"`
    case 'column.deleted':
      return `Deleted column "${d.name ?? ''}"`
    case 'project.created':
      return `Created project "${d.name ?? ''}"`
    default:
      return event.event_type.replace('.', ' ')
  }
}

export function ActivityPanel({ projectId, onClose }: Props) {
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['activity', projectId, page],
    queryFn: () => activityApi.list(projectId, page),
  })

  const events = data?.items ?? []
  const hasMore = data ? page < data.pages : false

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 text-sm">Activity</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary-600" /></div>
        ) : events.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8 italic">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event: ActivityEvent) => (
              <div key={event.id} className="flex gap-2.5">
                <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] text-gray-500 font-bold">
                    {event.actor_id.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-700">{eventMessage(event)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(event.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={isFetching}
            className="mt-4 w-full text-xs text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1 py-2"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Load more
          </button>
        )}
      </div>
    </div>
  )
}
