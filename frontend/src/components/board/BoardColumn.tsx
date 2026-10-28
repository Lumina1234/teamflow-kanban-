import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react'
import { BoardCard } from './BoardCard'
import { CardDetailModal } from './CardDetailModal'
import { cardsApi } from '../../api/cards'
import { columnsApi } from '../../api/columns'
import { useToast } from '../../providers/ToastProvider'
import { extractError } from '../../utils/errors'
import type { BoardColumn as Col, Card, ProjectMember } from '../../types'

interface BoardColumnProps {
  column: Col
  cards: Card[]
  projectId: string
  isOwner: boolean
  members?: ProjectMember[]
}

export function BoardColumn({ column, cards, projectId, isOwner, members = [] }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const [addingCard, setAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [columnName, setColumnName] = useState(column.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    setColumnName(column.name)
  }, [column.name])

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

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
      const otherCols = queryClient.getQueryData<Col[]>(['columns', projectId])?.filter(c => c.id !== column.id)
      const target = otherCols?.[0]
      if (!target) {
        toast.error('Cannot delete the only column')
        return Promise.reject()
      }
      return columnsApi.delete(projectId, column.id, target.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', projectId] })
      queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
      toast.success('Column deleted')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  // Status dot style according to column type/name
  const colLower = column.name.toLowerCase()
  let dotColor = 'bg-blue-600 ring-blue-100'
  if (colLower.includes('progress')) {
    dotColor = 'bg-amber-500 ring-amber-100'
  } else if (column.is_completed || colLower.includes('done')) {
    dotColor = 'bg-emerald-500 ring-emerald-100'
  }

  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-[310px] min-w-[310px] flex flex-col rounded-2xl transition-all ${
        isOver ? 'bg-blue-50/70 ring-2 ring-blue-300' : 'bg-[#F4F6FB]/85'
      } p-3 max-h-full`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-1 py-1.5 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status Dot */}
          <span className={`w-3 h-3 rounded-full shrink-0 ring-4 ${dotColor}`} />

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
                className="text-sm font-bold text-gray-900 bg-white border border-blue-400 rounded-lg px-2 py-0.5 outline-none w-full shadow-xs"
                autoFocus
              />
              <button
                onClick={() => columnName.trim() && renameColumnMutation.mutate(columnName.trim())}
                className="text-blue-600 hover:text-blue-700 p-1"
                title="Save name"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setEditingName(false); setColumnName(column.name) }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <h2
              onClick={() => isOwner && setEditingName(true)}
              className={`text-sm font-bold text-gray-900 truncate ${
                isOwner ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''
              }`}
              title={isOwner ? 'Click to rename' : column.name}
            >
              {column.name}
            </h2>
          )}

          {/* Count Badge */}
          <span className="text-xs font-semibold text-gray-400 bg-gray-200/70 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
            {cards.length}
          </span>
        </div>

        {/* Options Menu (Three dots) - Owner only */}
        {isOwner && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200/50 transition-colors"
              title="Column menu"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 text-xs">
                <button
                  onClick={() => { setMenuOpen(false); setEditingName(true) }}
                  className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Pencil className="h-3.5 w-3.5 text-gray-400" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    if (window.confirm(`Delete "${column.name}"? Cards will be moved to another column.`)) {
                      deleteColumnMutation.mutate()
                    }
                  }}
                  className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  Delete column
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards stack */}
      <div className="space-y-3 flex-1 overflow-y-auto px-0.5 pb-2 min-h-[3rem]">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map(card => (
            <BoardCard
              key={card.id}
              card={card}
              members={members}
              onClick={() => setSelectedCard(card)}
            />
          ))}
        </SortableContext>

        {cards.length === 0 && !addingCard && (
          <div className="h-20 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-xs text-gray-400 font-medium">
            Drop cards here
          </div>
        )}
      </div>

      {/* Add card area - Owner only */}
      {isOwner && (
        <div className="pt-1">
          {addingCard ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-xs">
              <textarea
                className="w-full text-xs text-gray-900 resize-none border-0 outline-none placeholder-gray-400 font-medium"
                rows={2}
                placeholder="What needs to be done?…"
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
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => newCardTitle.trim() && addCardMutation.mutate(newCardTitle.trim())}
                  disabled={!newCardTitle.trim() || addCardMutation.isPending}
                  className="btn-primary text-xs py-1.5 px-3 rounded-lg flex-1"
                >
                  {addCardMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Add Card
                </button>
                <button
                  onClick={() => { setAddingCard(false); setNewCardTitle('') }}
                  className="btn-secondary text-xs py-1.5 px-3 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCard(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 rounded-xl py-2.5 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add card
            </button>
          )}
        </div>
      )}

      {/* Card Detail Modal (Members can view and comment) */}
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
