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
import type { Card, BoardColumn as Col } from '../../types'
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
}

function CardDragOverlay({ card }: { card: Card | null }) {
  if (!card) return null
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-[260px] opacity-90 rotate-2">
      <p className="text-sm font-medium text-gray-900 truncate">{card.title}</p>
    </div>
  )
}

export function KanbanBoard({ projectId, board, isOwner }: KanbanBoardProps) {
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
    // Find the card being dragged
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

    // Determine source and target columns
    let sourceColumnId: string | undefined
    let targetColumnId: string | undefined
    let beforeCardId: string | undefined

    for (const [colId, cards] of Object.entries(cardsByColumn)) {
      if (cards.some(c => c.id === activeId)) sourceColumnId = colId
    }

    // Over a card?
    for (const [colId, cards] of Object.entries(cardsByColumn)) {
      const idx = cards.findIndex(c => c.id === overId)
      if (idx !== -1) {
        targetColumnId = colId
        beforeCardId = overId
        break
      }
    }

    // Over a column (dropped on empty area)?
    if (!targetColumnId && columns.some(c => c.id === overId)) {
      targetColumnId = overId
      beforeCardId = undefined
    }

    if (!sourceColumnId || !targetColumnId) return

    try {
      await moveCard(activeId, targetColumnId, beforeCardId)
    } catch { /* error already shown by hook */ }
  }

  if (columnsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
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
      <div className="flex gap-4 p-4 h-full items-start">
        {columns.map((col: Col) => (
          <BoardColumn
            key={col.id}
            column={col}
            cards={cardsByColumn[col.id] ?? []}
            projectId={projectId}
            isOwner={isOwner}
          />
        ))}

        {/* Add Column */}
        {isOwner && (
          <div className="shrink-0 w-[var(--board-column-width)]">
            {addingColumn ? (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <input
                  className="input mb-2 text-sm"
                  placeholder="Column name"
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
                    className="btn-primary text-xs flex-1"
                  >
                    {createColMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                  </button>
                  <button onClick={() => { setAddingColumn(false); setNewColName('') }} className="btn-secondary text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 bg-gray-200/50 hover:bg-gray-200 rounded-xl px-4 py-3 transition-colors"
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
