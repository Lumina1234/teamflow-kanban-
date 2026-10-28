import { apiClient } from './client'
import type { Project } from '../types'

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const { data } = await apiClient.get<Project[]>('/api/projects')
    return data
  },

  create: async (name: string, description?: string): Promise<Project> => {
    const { data } = await apiClient.post<Project>('/api/projects', { name, description })
    return data
  },

  get: async (id: string): Promise<Project> => {
    const { data } = await apiClient.get<Project>(`/api/projects/${id}`)
    return data
  },

  update: async (id: string, projectData: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project> => {
    const { data } = await apiClient.patch<Project>(`/api/projects/${id}`, projectData)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${id}`)
  },
}
