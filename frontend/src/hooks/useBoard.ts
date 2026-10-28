import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { columnsApi } from '../api/columns'
import { cardsApi } from '../api/cards'
import type { Card, BoardFilters } from '../types'
import { useToast } from '../providers/ToastProvider'

export function useBoard(projectId: string, filters: BoardFilters) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const columnsQuery = useQuery({
    queryKey: ['columns', projectId],
    queryFn: () => columnsApi.list(projectId),
    enabled: !!projectId,
  })

  const cardsQuery = useQuery({
    queryKey: ['cards', projectId, filters],
    queryFn: () => cardsApi.list(projectId, filters),
    enabled: !!projectId,
  })

  const moveMutation = useMutation({
    mutationFn: ({
      cardId,
      targetColumnId,
      beforeCardId,
    }: {
      cardId: string
      targetColumnId: string
      beforeCardId?: string
    }) => cardsApi.move(projectId, cardId, targetColumnId, beforeCardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
    },
    onError: (_err, _variables, context) => {
      // Roll back optimistic update
      queryClient.setQueryData(['cards', projectId, filters], context as Card[])
      toast.error('Failed to move card. Please try again.')
    },
  })

  const moveCard = useCallback(
    async (
      cardId: string,
      targetColumnId: string,
      beforeCardId?: string,
      optimisticCards?: Card[]
    ) => {
      // Apply optimistic update
      if (optimisticCards) {
        queryClient.setQueryData(['cards', projectId, filters], optimisticCards)
      }
      await moveMutation.mutateAsync({ cardId, targetColumnId, beforeCardId })
    },
    [moveMutation, queryClient, projectId, filters]
  )

  const columns = columnsQuery.data ?? []
  const cards = cardsQuery.data ?? []

  // Group cards by column
  const cardsByColumn: Record<string, Card[]> = {}
  for (const col of columns) {
    cardsByColumn[col.id] = cards
      .filter(c => c.column_id === col.id)
      .sort((a, b) => a.position - b.position)
  }

  return {
    columns,
    cards,
    cardsByColumn,
    columnsLoading: columnsQuery.isLoading,
    cardsLoading: cardsQuery.isLoading,
    moveCard,
    isMoving: moveMutation.isPending,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', projectId] })
      queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
    },
  }
}
