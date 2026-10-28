import { apiClient } from './client'
import type { Team } from '../types'

export const teamsApi = {
  list: async (projectId: string): Promise<Team[]> => {
    const { data } = await apiClient.get<Team[]>(`/api/projects/${projectId}/teams`)
    return data
  },
}
