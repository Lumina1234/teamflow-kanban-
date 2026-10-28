import { apiClient } from './client'
import type { Label } from '../types'

export const labelsApi = {
  list: async (projectId: string): Promise<Label[]> => {
    const { data } = await apiClient.get<Label[]>(`/api/projects/${projectId}/labels`)
    return data
  },

  create: async (projectId: string, name: string, color: string): Promise<Label> => {
    const { data } = await apiClient.post<Label>(`/api/projects/${projectId}/labels`, { name, color })
    return data
  },

  update: async (
    projectId: string,
    labelId: string,
    labelData: Partial<Pick<Label, 'name' | 'color'>>
  ): Promise<Label> => {
    const { data } = await apiClient.patch<Label>(
      `/api/projects/${projectId}/labels/${labelId}`,
      labelData
    )
    return data
  },

  delete: async (projectId: string, labelId: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/labels/${labelId}`)
  },
}
