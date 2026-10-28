import { format, isBefore, parseISO, isValid, formatDistanceToNow } from 'date-fns'

export function formatDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr)
    if (!isValid(d)) return dateStr
    return format(d, 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

export function formatDateShort(dateStr: string): string {
  try {
    const d = parseISO(dateStr)
    if (!isValid(d)) return dateStr
    return format(d, 'MMM d')
  } catch {
    return dateStr
  }
}

export function formatTimeAgo(dateStr: string): string {
  try {
    const d = parseISO(dateStr)
    if (!isValid(d)) return dateStr
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return dateStr
  }
}

export function isOverdue(dueDateStr: string): boolean {
  try {
    // due_date is a date string like "2026-10-01"
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDateStr + 'T00:00:00')
    return isBefore(due, today)
  } catch {
    return false
  }
}
