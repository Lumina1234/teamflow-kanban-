import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Trash2, Pencil, Check } from 'lucide-react'
import { BoardCard } from './BoardCard'
import { CardDetailModal } from './CardDetailModal'
import { cardsApi } from '../../api/cards'
import { columnsApi } from '../../api/columns'
import { useToast } from '../../providers/ToastProvider'
import { extractError } from '../../utils/errors'
import type { BoardColumn as Col, Card } from '../../types'

interface BoardColumnProps {
  column: Col
  cards: Card[]
  projectId: string
  isOwner: boolean
}

export function BoardColumn({ column, cards, projectId, isOwner }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [addingCard, setAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [columnName, setColumnName] = useState(column.name)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    setColumnName(column.name)
  }, [column.name])

  const renameColumnMutation = useMutation({
    mutationFn: (newName: string) => columnsApi.update(projectId, column.id, { name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', projectId] })
      setEditingName(false)
      toast.success('Column renamed')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const addCardMutation = useMutation({
    mutationFn: (title: string) => cardsApi.create(projectId, { column_id: column.id, title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
      setNewCardTitle('')
      setAddingCard(false)
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const deleteColumnMutation = useMutation({
    mutationFn: () => {
      // Move cards to first other column
      const otherCols = queryClient.getQueryData<Col[]>(['columns', projectId])?.filter(c => c.id !== column.id)
      const target = otherCols?.[0]
      if (!target) { toast.error('Cannot delete the only column'); return Promise.reject() }
      return columnsApi.delete(projectId, column.id, target.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', projectId] })
      queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
      toast.success('Column deleted')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-[var(--board-column-width)] flex flex-col rounded-xl transition-colors ${
        isOver ? 'bg-primary-50 ring-2 ring-primary-300' : 'bg-gray-100'
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {editingName && isOwner ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={columnName}
                onChange={e => setColumnName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && columnName.trim()) renameColumnMutation.mutate(columnName.trim())
                  if (e.key === 'Escape') { setEditingName(false); setColumnName(column.name) }
                }}
                className="text-xs font-semibold text-gray-800 bg-white border border-primary-400 rounded px-1.5 py-0.5 outline-none w-full"
                autoFocus
              />
              <button
                onClick={() => columnName.trim() && renameColumnMutation.mutate(columnName.trim())}
                className="text-primary-600 hover:text-primary-800 p-0.5"
                title="Save name"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <h2
              onClick={() => isOwner && setEditingName(true)}
              className={`text-sm font-semibold text-gray-700 truncate ${
                isOwner ? 'cursor-pointer hover:text-primary-700' : ''
              }`}
              title={isOwner ? 'Click to rename' : column.name}
            >
              {column.name}
            </h2>
          )}
          <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5 font-medium shrink-0">
            {cards.length}
          </span>
          {column.is_completed && (
            <span className="text-[10px] text-green-700 bg-green-100 rounded px-1 shrink-0">Done</span>
          )}
        </div>
        {isOwner && !editingName && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditingName(true)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
              title="Rename column (Owner only)"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => window.confirm(`Delete "${column.name}"? Cards will be moved.`) && deleteColumnMutation.mutate()}
              className="text-gray-400 hover:text-red-500 p-1 rounded"
              title="Delete column (Owner only)"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 px-2 pb-2 space-y-2 min-h-[2rem]">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <BoardCard
              key={card.id}
              card={card}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && !addingCard && (
          <div className="h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400">
            Drop cards here
          </div>
        )}
      </div>

      {/* Add card */}
      <div className="px-2 pb-2">
        {addingCard ? (
          <div className="bg-white rounded-lg border border-gray-200 p-2">
            <textarea
              className="w-full text-sm resize-none border-0 outline-none text-gray-900 placeholder-gray-400"
              rows={2}
              placeholder="Card title…"
              value={newCardTitle}
              onChange={e => setNewCardTitle(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && newCardTitle.trim()) {
                  e.preventDefault()
                  addCardMutation.mutate(newCardTitle.trim())
                }
                if (e.key === 'Escape') { setAddingCard(false); setNewCardTitle('') }
              }}
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => newCardTitle.trim() && addCardMutation.mutate(newCardTitle.trim())}
                disabled={!newCardTitle.trim() || addCardMutation.isPending}
                className="btn-primary text-xs py-1 px-3"
              >
                {addCardMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
              </button>
              <button onClick={() => { setAddingCard(false); setNewCardTitle('') }} className="text-xs text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="w-full flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200/70 rounded-lg px-2 py-2 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add card
          </button>
        )}
      </div>

      {/* Card detail modal */}
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          projectId={projectId}
          isOwner={isOwner}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  )
}
