import { apiClient } from './client'
import type { ProjectMember, Invitation } from '../types'

export const membersApi = {
  list: async (projectId: string): Promise<ProjectMember[]> => {
    const { data } = await apiClient.get<ProjectMember[]>(`/api/projects/${projectId}/members`)
    return data
  },

  createInvitation: async (projectId: string, email: string, role: 'owner' | 'member'): Promise<Invitation> => {
    const { data } = await apiClient.post<Invitation>(
      `/api/projects/${projectId}/invitations`,
      { email, role }
    )
    return data
  },

  listInvitations: async (projectId: string): Promise<Invitation[]> => {
    const { data } = await apiClient.get<Invitation[]>(`/api/projects/${projectId}/invitations`)
    return data
  },

  revokeInvitation: async (projectId: string, invitationId: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/invitations/${invitationId}`)
  },

  acceptInvitation: async (token: string): Promise<{ message: string; project_id: string }> => {
    const { data } = await apiClient.post<{ message: string; project_id: string }>(
      `/api/invitations/${token}/accept`
    )
    return data
  },

  changeMemberRole: async (projectId: string, userId: string, role: 'owner' | 'member'): Promise<void> => {
    await apiClient.patch(`/api/projects/${projectId}/members/${userId}`, { role })
  },

  removeMember: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/members/${userId}`)
  },
}
