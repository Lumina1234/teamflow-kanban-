import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Trash2,
  Calendar,
  User,
  Tag,
  Loader2,
  Send,
  Pencil,
  Check,
  Share2,
  ShieldAlert,
} from 'lucide-react'
import { cardsApi } from '../../api/cards'
import { commentsApi } from '../../api/comments'
import { labelsApi } from '../../api/labels'
import { membersApi } from '../../api/members'
import { teamsApi } from '../../api/teams'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../providers/ToastProvider'
import { extractError } from '../../utils/errors'
import { formatDate } from '../../utils/dates'
import { cn } from '../../utils/cn'
import type { Card, Comment, Label, ProjectMember, Team } from '../../types'

interface Props {
  card: Card
  projectId: string
  isOwner?: boolean
  onClose: () => void
}

export function CardDetailModal({ card: initialCard, projectId, isOwner = false, onClose }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const modalRef = useRef<HTMLDivElement>(null)

  const [card, setCard] = useState(initialCard)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(initialCard.title)
  const [description, setDescription] = useState(initialCard.description ?? '')
  const [commentText, setCommentText] = useState('')
  const [selectedTeamToShare, setSelectedTeamToShare] = useState('')

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Trap focus
  useEffect(() => {
    modalRef.current?.focus()
  }, [])

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', projectId, card.id],
    queryFn: () => commentsApi.list(projectId, card.id),
  })

  const { data: labels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
  })

  const { data: membersData = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
  })

  const { data: teamsData = [] } = useQuery({
    queryKey: ['teams', projectId],
    queryFn: () => teamsApi.list(projectId),
  })

  // Determine read-only state for Designer on non-design card
  const currentMember = membersData.find((m: ProjectMember) => m.user_id === user?.id)
  const isDesigner = currentMember?.job_role === 'designer' || currentMember?.team_slug === 'design'
  const isDesignCard = card.team_slug === 'design'
  const isReadOnly = !isOwner && isDesigner && !isDesignCard

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
    queryClient.invalidateQueries({ queryKey: ['comments', projectId, card.id] })
    queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
  }

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Card> & { version?: number }) =>
      cardsApi.update(projectId, card.id, updates),
    onSuccess: (updated) => {
      setCard(updated)
      invalidate()
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => cardsApi.delete(projectId, card.id),
    onSuccess: () => {
      invalidate()
      onClose()
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const addCommentMutation = useMutation({
    mutationFn: (text: string) => commentsApi.create(projectId, card.id, text),
    onSuccess: () => {
      setCommentText('')
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, card.id] })
      queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(projectId, card.id, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', projectId, card.id] })
      queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
      toast.success('Comment deleted')
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const addLabelMutation = useMutation({
    mutationFn: (labelId: string) => cardsApi.addLabel(projectId, card.id, labelId),
    onSuccess: () => invalidate(),
  })

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: string) => cardsApi.removeLabel(projectId, card.id, labelId),
    onSuccess: () => invalidate(),
  })

  const shareMutation = useMutation({
    mutationFn: (teamId: string) =>
      cardsApi.share(projectId, card.id, { team_id: teamId, permission: 'view' }),
    onSuccess: () => {
      toast.success('Task shared with team successfully')
      setSelectedTeamToShare('')
      invalidate()
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const revokeShareMutation = useMutation({
    mutationFn: (grantId: string) => cardsApi.revokeShare(projectId, card.id, grantId),
    onSuccess: () => {
      toast.success('Team share revoked')
      invalidate()
    },
    onError: (err) => toast.error(extractError(err)),
  })

  const saveTitle = () => {
    if (isReadOnly) return
    if (title.trim() && title.trim() !== card.title) {
      updateMutation.mutate({ title: title.trim(), version: card.version })
    }
    setEditingTitle(false)
  }

  const cardLabelIds = new Set(card.labels?.map((l) => l.id) ?? [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-2 sm:px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Card: ${card.title}`}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col outline-none overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3 border-b border-gray-100">
          <div className="flex-1 mr-3">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {card.team_name && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                  {card.team_name}
                </span>
              )}
              {card.visibility === 'hr_only' && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                  🔒 HR Only
                </span>
              )}
              {card.visibility === 'selected_teams' && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                  🌐 Shared Task
                </span>
              )}
              {isReadOnly && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                  Read-Only Cross-Team View
                </span>
              )}
            </div>

            {editingTitle && !isReadOnly ? (
              <div className="flex items-center gap-2">
                <input
                  className="text-lg font-semibold text-gray-900 border-b-2 border-blue-500 outline-none w-full bg-transparent"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTitle()
                    if (e.key === 'Escape') {
                      setTitle(card.title)
                      setEditingTitle(false)
                    }
                  }}
                  autoFocus
                />
                <button onClick={saveTitle} className="text-blue-600 hover:text-blue-700">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => !isReadOnly && setEditingTitle(true)}
                className={`text-lg font-semibold text-gray-900 text-left transition-colors flex items-center gap-2 group ${
                  isReadOnly ? 'cursor-default' : 'hover:text-blue-700'
                }`}
              >
                {card.title}
                {!isReadOnly && (
                  <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                onClick={() => window.confirm('Delete this card?') && deleteMutation.mutate()}
                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete card (Owner only)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Read-Only Notice for Designer */}
        {isReadOnly && (
          <div className="bg-amber-50 border-b border-amber-200/60 px-5 py-2 text-xs text-amber-800 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              You have read-only inspection access to this team task. You can collaborate and provide
              design feedback via comments below.
            </span>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 grid grid-cols-3 gap-5">
            {/* Main content — 2 cols */}
            <div className="col-span-3 sm:col-span-2 space-y-4">
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  disabled={isReadOnly}
                  className={`w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-2.5 resize-none outline-none min-h-[80px] ${
                    isReadOnly
                      ? 'bg-gray-50 text-gray-500 cursor-not-allowed'
                      : 'focus:border-blue-400 focus:ring-1 focus:ring-blue-400'
                  }`}
                  placeholder={isReadOnly ? 'No description.' : 'Add a description…'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => {
                    if (!isReadOnly && description !== (card.description ?? '')) {
                      updateMutation.mutate({ description, version: card.version })
                    }
                  }}
                />
              </div>

              {/* Task Sharing Section (Project Manager / Owner Only) */}
              {isOwner && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Share2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>Cross-Team Task Sharing</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Grant other teams permission to collaborate on this task.
                  </p>

                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 flex-1 outline-none focus:border-blue-400 font-medium"
                      value={selectedTeamToShare}
                      onChange={(e) => setSelectedTeamToShare(e.target.value)}
                    >
                      <option value="">Select a team to share with...</option>
                      {teamsData
                        .filter((t: Team) => t.id !== card.owner_team_id)
                        .map((t: Team) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                    <button
                      disabled={!selectedTeamToShare || shareMutation.isPending}
                      onClick={() => selectedTeamToShare && shareMutation.mutate(selectedTeamToShare)}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Share
                    </button>
                  </div>

                  {/* Active Grants */}
                  {card.access_grants && card.access_grants.length > 0 && (
                    <div className="pt-1.5 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Active Grants
                      </span>
                      {card.access_grants.map((grant) => (
                        <div
                          key={grant.id}
                          className="flex items-center justify-between text-xs bg-white border border-slate-200/70 rounded-lg px-2.5 py-1"
                        >
                          <span className="font-medium text-slate-700">
                            {grant.team_name ?? 'Team'} ({grant.permission})
                          </span>
                          <button
                            onClick={() => revokeShareMutation.mutate(grant.id)}
                            className="text-red-500 hover:text-red-700 font-semibold text-[11px]"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Comments */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Comments & Collaboration
                </label>
                <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
                  {comments.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No comments yet.</p>
                  )}
                  {comments.map((c: Comment) => {
                    const authorMember = membersData.find(
                      (m: ProjectMember) => m.user_id === c.author_id
                    )
                    const authorName =
                      c.author_id === user?.id
                        ? 'You'
                        : authorMember?.name ?? authorMember?.user?.name ?? 'Member'
                    const canDelete = c.author_id === user?.id || isOwner

                    return (
                      <div key={c.id} className="flex gap-2 group">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {authorName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-gray-700">{authorName}</span>
                            <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                            {c.edited_at && <span className="text-xs text-gray-400">(edited)</span>}
                            {canDelete && (
                              <button
                                onClick={() =>
                                  window.confirm('Delete comment?') &&
                                  deleteCommentMutation.mutate(c.id)
                                }
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-0.5 ml-auto transition-opacity"
                                title="Delete comment"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 break-words">
                            {c.text}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add comment */}
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 text-sm border border-gray-200 rounded-lg p-2 resize-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                    rows={2}
                    placeholder="Write a comment… (all members with card access can comment)"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
                        e.preventDefault()
                        addCommentMutation.mutate(commentText.trim())
                      }
                    }}
                  />
                  <button
                    onClick={() => commentText.trim() && addCommentMutation.mutate(commentText.trim())}
                    disabled={!commentText.trim() || addCommentMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg self-end px-3 py-2 transition-colors"
                    title="Send comment"
                  >
                    {addCommentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar — 1 col */}
            <div className="col-span-3 sm:col-span-1 space-y-4">
              {/* Assignee */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  <User className="h-3 w-3 inline mr-1" />
                  Assignee
                </label>
                <select
                  disabled={isReadOnly}
                  className={`w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none bg-white font-medium ${
                    isReadOnly ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'focus:border-blue-400'
                  }`}
                  value={card.assignee_id ?? ''}
                  onChange={(e) =>
                    updateMutation.mutate({
                      assignee_id: e.target.value || undefined,
                      version: card.version,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {membersData.map((m: ProjectMember) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name ?? m.user?.name ?? m.email ?? m.user_id} ({m.team_slug ?? m.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Due date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Due date
                </label>
                <input
                  type="date"
                  disabled={isReadOnly}
                  className={`w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none ${
                    isReadOnly ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'focus:border-blue-400'
                  }`}
                  value={card.due_date ?? ''}
                  onChange={(e) =>
                    updateMutation.mutate({
                      due_date: e.target.value || undefined,
                      version: card.version,
                    })
                  }
                />
              </div>

              {/* Labels */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  <Tag className="h-3 w-3 inline mr-1" />
                  Labels
                </label>
                <div className="space-y-1">
                  {labels.map((label: Label) => {
                    const active = cardLabelIds.has(label.id)
                    return (
                      <button
                        key={label.id}
                        disabled={isReadOnly}
                        onClick={() =>
                          active
                            ? removeLabelMutation.mutate(label.id)
                            : addLabelMutation.mutate(label.id)
                        }
                        className={cn(
                          'w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                          active ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50',
                          isReadOnly && 'cursor-not-allowed opacity-75'
                        )}
                      >
                        <span
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="flex-1 text-left text-gray-700">{label.name}</span>
                        {active && <Check className="h-3 w-3 text-blue-600" />}
                      </button>
                    )
                  })}
                  {labels.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No labels available.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
