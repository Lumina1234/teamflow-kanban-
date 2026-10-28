import { useState, useCallback } from 'react'
import type { BoardFilters } from '../types'

export function useFilters() {
  const [filters, setFilters] = useState<BoardFilters>({})

  const setAssignee = useCallback((assignee_id: string | undefined) => {
    setFilters(f => ({ ...f, assignee_id }))
  }, [])

  const setLabel = useCallback((label_id: string | undefined) => {
    setFilters(f => ({ ...f, label_id }))
  }, [])

  const setOverdue = useCallback((overdue: boolean | undefined) => {
    setFilters(f => ({ ...f, overdue }))
  }, [])

  const setTeam = useCallback((team_id: string | undefined) => {
    setFilters(f => ({ ...f, team_id }))
  }, [])

  const clearFilters = useCallback(() => setFilters({}), [])

  const activeCount = Object.values(filters).filter(v => v !== undefined && v !== false).length

  return { filters, setAssignee, setLabel, setOverdue, setTeam, clearFilters, activeCount }
}
