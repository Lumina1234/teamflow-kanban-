import { apiClient } from './client'
import type { Comment } from '../types'

export const commentsApi = {
  list: async (projectId: string, cardId: string): Promise<Comment[]> => {
    const { data } = await apiClient.get<Comment[]>(
      `/api/projects/${projectId}/cards/${cardId}/comments`
    )
    return data
  },

  create: async (projectId: string, cardId: string, text: string): Promise<Comment> => {
    const { data } = await apiClient.post<Comment>(
      `/api/projects/${projectId}/cards/${cardId}/comments`,
      { text }
    )
    return data
  },

  update: async (projectId: string, cardId: string, commentId: string, text: string): Promise<Comment> => {
    const { data } = await apiClient.patch<Comment>(
      `/api/projects/${projectId}/cards/${cardId}/comments/${commentId}`,
      { text }
    )
    return data
  },

  delete: async (projectId: string, cardId: string, commentId: string): Promise<void> => {
    await apiClient.delete(
      `/api/projects/${projectId}/cards/${cardId}/comments/${commentId}`
    )
  },
}
