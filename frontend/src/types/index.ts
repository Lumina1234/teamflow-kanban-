export interface User {
  id: string
  email: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
  my_role?: 'owner' | 'member'
}

export interface ProjectMember {
  id: string
  user_id: string
  project_id: string
  role: 'owner' | 'member'
  joined_at: string
  // Denormalized user fields from backend
  email?: string
  name?: string
  user?: User
}

export interface Invitation {
  id: string
  project_id: string
  invited_email: string
  role: 'owner' | 'member'
  expires_at: string
  accepted_at?: string
  revoked_at?: string
  invited_by: string
  created_at: string
}

export interface BoardColumn {
  id: string
  project_id: string
  name: string
  position: number
  is_completed: boolean
  created_at: string
  updated_at: string
}

export interface Label {
  id: string
  project_id: string
  name: string
  color: string
}

export interface Card {
  id: string
  project_id: string
  column_id: string
  title: string
  description?: string
  assignee_id?: string
  assignee?: User
  due_date?: string
  position: number
  version: number
  labels: Label[]
  created_by: string
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  card_id: string
  project_id: string
  author_id: string
  author?: User
  text: string
  created_at: string
  updated_at: string
  edited_at?: string
}

export interface ActivityEvent {
  id: string
  project_id: string
  actor_id: string
  actor?: User
  event_type: string
  resource_type: string
  resource_id?: string
  details?: Record<string, unknown>
  created_at: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, string[]>
}

export interface BoardFilters {
  assignee_id?: string
  label_id?: string
  overdue?: boolean
}
