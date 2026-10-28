import { apiClient } from './client'
import type { ActivityEvent } from '../types'

interface ActivityPage {
  items: ActivityEvent[]
  total: number
  page: number
  per_page: number
  pages: number
}

export const activityApi = {
  list: async (projectId: string, page = 1, perPage = 25): Promise<ActivityPage> => {
    const { data } = await apiClient.get<ActivityPage>(
      `/api/projects/${projectId}/activity`,
      { params: { page, per_page: perPage } }
    )
    return data
  },
}
