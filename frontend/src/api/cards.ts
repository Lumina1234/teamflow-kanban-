import { apiClient } from './client'
import type { Card, BoardFilters } from '../types'

export const cardsApi = {
  list: async (projectId: string, filters?: BoardFilters): Promise<Card[]> => {
    const { data } = await apiClient.get<Card[]>(`/api/projects/${projectId}/cards`, {
      params: filters,
    })
    return data
  },

  create: async (
    projectId: string,
    cardData: { title: string; column_id: string; description?: string; assignee_id?: string; due_date?: string }
  ): Promise<Card> => {
    const { data } = await apiClient.post<Card>(`/api/projects/${projectId}/cards`, cardData)
    return data
  },

  get: async (projectId: string, cardId: string): Promise<Card> => {
    const { data } = await apiClient.get<Card>(`/api/projects/${projectId}/cards/${cardId}`)
    return data
  },

  update: async (
    projectId: string,
    cardId: string,
    cardData: Partial<Pick<Card, 'title' | 'description' | 'assignee_id' | 'due_date'>> & { version?: number }
  ): Promise<Card> => {
    const { data } = await apiClient.patch<Card>(`/api/projects/${projectId}/cards/${cardId}`, cardData)
    return data
  },

  delete: async (projectId: string, cardId: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/cards/${cardId}`)
  },

  move: async (projectId: string, cardId: string, targetColumnId: string, beforeCardId?: string): Promise<Card> => {
    const { data } = await apiClient.post<Card>(
      `/api/projects/${projectId}/cards/${cardId}/move`,
      { target_column_id: targetColumnId, before_card_id: beforeCardId ?? null }
    )
    return data
  },

  addLabel: async (projectId: string, cardId: string, labelId: string): Promise<void> => {
    await apiClient.post(`/api/projects/${projectId}/cards/${cardId}/labels/${labelId}`)
  },

  removeLabel: async (projectId: string, cardId: string, labelId: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/cards/${cardId}/labels/${labelId}`)
  },
}
