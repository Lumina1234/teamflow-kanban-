import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useState } from 'react'
import { BoardColumn } from './BoardColumn'
import type { Card, BoardColumn as Col, ProjectMember } from '../../types'
import type { useBoard } from '../../hooks/useBoard'
import { Plus, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { columnsApi } from '../../api/columns'
import { useToast } from '../../providers/ToastProvider'
import { extractError } from '../../utils/errors'

type BoardHook = ReturnType<typeof useBoard>

interface KanbanBoardProps {
  projectId: string
  board: BoardHook
  isOwner: boolean
  searchQuery?: string
  members?: ProjectMember[]
}

function CardDragOverlay({ card }: { card: Card | null }) {
  if (!card) return null
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-[290px] opacity-95 rotate-2 cursor-grabbing">
      <p className="text-sm font-bold text-gray-900 truncate">{card.title}</p>
      {card.description && (
        <p className="text-xs text-gray-500 line-clamp-1 mt-1">{card.description}</p>
      )}
    </div>
  )
}

export function KanbanBoard({
  projectId,
  board,
  isOwner,
  searchQuery = '',
  members = [],
}: KanbanBoardProps) {
  const { columns, cardsByColumn, moveCard, columnsLoading } = board
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColName, setNewColName] = useState('')
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const createColMutation = useMutation({
    mutationFn: (name: string) => columnsApi.create(projectId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', projectId] })
      setNewColName('')
      setAddingColumn(false)
      toast.success('Column created')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    for (const cards of Object.values(cardsByColumn)) {
      const found = cards.find(c => c.id === active.id)
      if (found) { setActiveCard(found); break }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveCard(null)
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    let sourceColumnId: string | undefined
    let targetColumnId: string | undefined
    let beforeCardId: string | undefined

    for (const [colId, cards] of Object.entries(cardsByColumn)) {
      if (cards.some(c => c.id === activeId)) sourceColumnId = colId
    }

    for (const [colId, cards] of Object.entries(cardsByColumn)) {
      const idx = cards.findIndex(c => c.id === overId)
      if (idx !== -1) {
        targetColumnId = colId
        beforeCardId = overId
        break
      }
    }

    if (!targetColumnId && columns.some(c => c.id === overId)) {
      targetColumnId = overId
      beforeCardId = undefined
    }

    if (!sourceColumnId || !targetColumnId) return

    try {
      await moveCard(activeId, targetColumnId, beforeCardId)
    } catch { /* error already shown by hook */ }
  }

  // Filter cards by search query if provided
  const query = searchQuery.trim().toLowerCase()
  const filteredCardsByColumn: Record<string, Card[]> = {}

  for (const [colId, cards] of Object.entries(cardsByColumn)) {
    if (!query) {
      filteredCardsByColumn[colId] = cards
    } else {
      filteredCardsByColumn[colId] = cards.filter(c =>
        c.title.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query)) ||
        (c.labels && c.labels.some(l => l.name.toLowerCase().includes(query)))
      )
    }
  }

  if (columnsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-5 p-6 h-full items-start overflow-x-auto">
        {columns.map((col: Col) => (
          <BoardColumn
            key={col.id}
            column={col}
            cards={filteredCardsByColumn[col.id] ?? []}
            projectId={projectId}
            isOwner={isOwner}
            members={members}
          />
        ))}

        {/* Add Column Button / Form - Owner only */}
        {isOwner && (
          <div className="shrink-0">
            {addingColumn ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 w-[280px] shadow-sm">
                <input
                  className="w-full text-xs font-semibold text-gray-800 border border-gray-200 rounded-xl px-3 py-2 mb-2 outline-none focus:border-blue-500"
                  placeholder="Column name…"
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newColName.trim()) createColMutation.mutate(newColName.trim())
                    if (e.key === 'Escape') { setAddingColumn(false); setNewColName('') }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => newColName.trim() && createColMutation.mutate(newColName.trim())}
                    disabled={!newColName.trim() || createColMutation.isPending}
                    className="btn-primary text-xs py-1.5 px-3 rounded-lg flex-1"
                  >
                    {createColMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Add Column
                  </button>
                  <button
                    onClick={() => { setAddingColumn(false); setNewColName('') }}
                    className="btn-secondary text-xs py-1.5 px-3 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-blue-600 bg-white hover:bg-gray-50 border border-gray-200/80 rounded-2xl px-4 py-2.5 shadow-xs transition-all cursor-pointer h-fit"
              >
                <Plus className="h-4 w-4" /> Add column
              </button>
            )}
          </div>
        )}
      </div>

      <DragOverlay>
        <CardDragOverlay card={activeCard} />
      </DragOverlay>
    </DndContext>
  )
}
