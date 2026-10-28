import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function useWebSocket(projectId: string | undefined) {
  const ws = useRef<WebSocket | null>(null)
  const queryClient = useQueryClient()
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pingInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const connect = useCallback(async () => {
    if (!projectId) return

    try {
      // Fetch WS token via authenticated HTTP request (session cookie is HttpOnly)
      const { data } = await apiClient.get<{ token: string }>('/api/auth/ws-token')
      const token = data.token
      if (!token) return

      const wsBase = API_BASE.replace(/^https?/, API_BASE.startsWith('https') ? 'wss' : 'ws')
      const wsUrl = `${wsBase}/api/ws/${projectId}?token=${encodeURIComponent(token)}`

      const socket = new WebSocket(wsUrl)
      ws.current = socket

      socket.onopen = () => {
        // Start heartbeat
        pingInterval.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send('ping')
          }
        }, 30000)
      }

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg === 'pong') return
          const { event: eventType } = msg

          // Invalidate relevant queries based on event type
          if (eventType?.startsWith('card.')) {
            queryClient.invalidateQueries({ queryKey: ['cards', projectId] })
            queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
          } else if (eventType?.startsWith('column.')) {
            queryClient.invalidateQueries({ queryKey: ['columns', projectId] })
          } else if (eventType?.startsWith('comment.')) {
            queryClient.invalidateQueries({ queryKey: ['comments'] })
            queryClient.invalidateQueries({ queryKey: ['activity', projectId] })
          } else if (eventType?.startsWith('member.')) {
            queryClient.invalidateQueries({ queryKey: ['members', projectId] })
          }
        } catch { /* ignore parse errors */ }
      }

      socket.onclose = (e) => {
        clearInterval(pingInterval.current)
        // Don't reconnect if kicked (4003) or auth failure (4001, 4004)
        if (e.code !== 4001 && e.code !== 4003 && e.code !== 4004) {
          reconnectTimeout.current = setTimeout(connect, 4000)
        }
      }

      socket.onerror = () => {
        socket.close()
      }
    } catch {
      // Retry on network errors (e.g. backend not yet up)
      reconnectTimeout.current = setTimeout(connect, 5000)
    }
  }, [projectId, queryClient])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeout.current)
      clearInterval(pingInterval.current)
      ws.current?.close()
    }
  }, [connect])
}
