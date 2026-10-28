import { apiClient } from './client'
import type { BoardColumn } from '../types'

export const columnsApi = {
  list: async (projectId: string): Promise<BoardColumn[]> => {
    const { data } = await apiClient.get<BoardColumn[]>(`/api/projects/${projectId}/columns`)
    return data
  },

  create: async (projectId: string, name: string): Promise<BoardColumn> => {
    const { data } = await apiClient.post<BoardColumn>(`/api/projects/${projectId}/columns`, { name })
    return data
  },

  update: async (
    projectId: string,
    columnId: string,
    columnData: Partial<Pick<BoardColumn, 'name' | 'is_completed'>>
  ): Promise<BoardColumn> => {
    const { data } = await apiClient.patch<BoardColumn>(
      `/api/projects/${projectId}/columns/${columnId}`,
      columnData
    )
    return data
  },

  reorder: async (projectId: string, order: Array<{ id: string }>): Promise<void> => {
    await apiClient.post(`/api/projects/${projectId}/columns/reorder`, order)
  },

  delete: async (projectId: string, columnId: string, targetColumnId: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/columns/${columnId}`, {
      data: { target_column_id: targetColumnId },
    })
  },
}
