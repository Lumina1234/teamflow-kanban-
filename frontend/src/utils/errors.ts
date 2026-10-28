import axios from 'axios'

export function extractError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data?.detail === 'string') return data.detail
    if (typeof data?.message === 'string') return data.message
    if (typeof data?.detail === 'object') return JSON.stringify(data.detail)
    if (error.response?.status === 422) {
      const detail = data?.detail
      if (Array.isArray(detail)) {
        return detail.map((d: { msg: string }) => d.msg).join('; ')
      }
    }
    if (error.response?.status === 429) return 'Too many requests. Please try again later.'
    if (error.response?.status === 409) return 'This resource was modified by another user. Please refresh.'
    return error.message || 'An unexpected error occurred'
  }
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred'
}
