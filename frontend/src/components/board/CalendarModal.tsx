import { useState, useMemo } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  Filter,
} from 'lucide-react'
import type { Card } from '../../types'
import { isOverdue, formatDateShort } from '../../utils/dates'

interface Props {
  cards: Card[]
  onSelectCard: (card: Card) => void
  onClose: () => void
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarModal({ cards, onSelectCard, onClose }: Props) {
  // Current view date
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [filterTeam, setFilterTeam] = useState<string>('all')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  // Extract unique teams from cards for filtering
  const teams = useMemo(() => {
    const set = new Set<string>()
    cards.forEach(c => {
      if (c.team_name) set.add(c.team_name)
    })
    return Array.from(set)
  }, [cards])

  // Filter cards if a team filter is active
  const filteredCards = useMemo(() => {
    if (filterTeam === 'all') return cards
    return cards.filter(c => c.team_name === filterTeam)
  }, [cards, filterTeam])

  // Group cards by due date string "YYYY-MM-DD"
  const cardsByDate = useMemo(() => {
    const map: Record<string, Card[]> = {}
    filteredCards.forEach(c => {
      if (c.due_date) {
        // Normalize due date to YYYY-MM-DD
        const dateKey = c.due_date.slice(0, 10)
        if (!map[dateKey]) map[dateKey] = []
        map[dateKey].push(c)
      }
    })
    return map
  }, [filteredCards])

  // Calendar calculations
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  // Grid cells
  const calendarDays = useMemo(() => {
    const days: Array<{ day: number; isCurrentMonth: boolean; dateKey: string; isToday: boolean }> = []

    // Previous month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      const dateKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, isCurrentMonth: false, dateKey, isToday: false })
    }

    // Current month days
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        day: d,
        isCurrentMonth: true,
        dateKey,
        isToday: dateKey === todayKey,
      })
    }

    // Next month padding to fill complete weeks (up to 35 or 42)
    const remaining = (7 - (days.length % 7)) % 7
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      const dateKey = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, isCurrentMonth: false, dateKey, isToday: false })
    }

    return days
  }, [year, month, firstDayOfMonth, daysInMonth, daysInPrevMonth])

  // Overdue and upcoming summary
  const scheduledCards = useMemo(() => {
    return filteredCards.filter(c => !!c.due_date).sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1))
  }, [filteredCards])

  const overdueList = useMemo(() => {
    return scheduledCards.filter(c => isOverdue(c.due_date!))
  }, [scheduledCards])

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToToday = () => setCurrentDate(new Date())

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6"
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Task Schedule & Deadlines</h2>
              <p className="text-xs text-gray-500">
                Track due dates, upcoming milestones, and cross-team deliveries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Team Filter */}
            {teams.length > 0 && (
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 rounded-xl px-2.5 py-1.5 text-xs">
                <Filter className="h-3 w-3 text-gray-400" />
                <select
                  value={filterTeam}
                  onChange={e => setFilterTeam(e.target.value)}
                  className="bg-transparent text-gray-700 font-semibold outline-none cursor-pointer"
                >
                  <option value="all">All Teams</option>
                  {teams.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Navigation Controls */}
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200/80 rounded-xl p-1">
              <button
                onClick={prevMonth}
                className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-gray-800 px-2 min-w-[120px] text-center">
                {monthNames[month]} {year}
              </span>
              <button
                onClick={nextMonth}
                className="p-1 hover:bg-white rounded-lg text-gray-600 transition-colors"
                title="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={goToToday}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              Today
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Calendar Body + Side Panel */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main Month Grid */}
          <div className="flex-1 flex flex-col p-5 overflow-y-auto min-w-0">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {DAYS_OF_WEEK.map(day => (
                <div
                  key={day}
                  className="text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-2 flex-1 auto-rows-fr">
              {calendarDays.map((cell, idx) => {
                const dayCards = cardsByDate[cell.dateKey] || []
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-2 flex flex-col min-h-[92px] transition-all ${
                      cell.isCurrentMonth
                        ? cell.isToday
                          ? 'bg-blue-50/40 border-blue-300 ring-2 ring-blue-100'
                          : 'bg-white border-gray-100 hover:border-gray-200'
                        : 'bg-gray-50/60 border-transparent text-gray-300'
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-bold inline-flex items-center justify-center rounded-full w-5 h-5 ${
                          cell.isToday
                            ? 'bg-blue-600 text-white font-extrabold'
                            : cell.isCurrentMonth
                            ? 'text-gray-700'
                            : 'text-gray-300'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayCards.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100/70 px-1.5 py-0.2 rounded-full">
                          {dayCards.length}
                        </span>
                      )}
                    </div>

                    {/* Cards on this day */}
                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[78px] pr-0.5">
                      {dayCards.map(c => {
                        const overdue = isOverdue(c.due_date!)
                        return (
                          <div
                            key={c.id}
                            onClick={() => onSelectCard(c)}
                            className={`p-1.5 rounded-lg text-[10px] font-semibold border cursor-pointer hover:shadow-xs transition-all leading-tight ${
                              overdue
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-200'
                            }`}
                            title={`${c.title} (${c.team_name ?? 'Team'})`}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              {c.team_name && (
                                <span className="font-bold text-[8px] uppercase tracking-wider text-slate-500">
                                  {c.team_name.split(' ')[0]}
                                </span>
                              )}
                              {overdue && <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />}
                            </div>
                            <div className="truncate">{c.title}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Summary Sidebar */}
          <aside className="w-80 border-l border-gray-100 bg-gray-50/50 flex flex-col p-5 shrink-0 overflow-y-auto">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              <div className="bg-white border border-gray-200/70 rounded-2xl p-3 shadow-2xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Scheduled
                </span>
                <span className="text-xl font-extrabold text-gray-900">{scheduledCards.length}</span>
              </div>
              <div className="bg-white border border-red-200/70 rounded-2xl p-3 shadow-2xs">
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider block mb-1">
                  Overdue
                </span>
                <span className="text-xl font-extrabold text-red-600">{overdueList.length}</span>
              </div>
            </div>

            {/* Overdue Section */}
            {overdueList.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Action Needed (Overdue)</span>
                </div>
                <div className="space-y-2">
                  {overdueList.map(c => (
                    <div
                      key={c.id}
                      onClick={() => onSelectCard(c)}
                      className="bg-white border border-red-200 rounded-xl p-2.5 hover:shadow-xs cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                        <span className="text-red-600">Past Due</span>
                        <span className="text-gray-400">{formatDateShort(c.due_date!)}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-gray-900 leading-snug truncate">
                        {c.title}
                      </h4>
                      {c.team_name && (
                        <span className="text-[9px] font-bold text-gray-400 mt-1 block">
                          {c.team_name}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Deadlines */}
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-2">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span>Upcoming Milestones</span>
              </div>
              <div className="space-y-2">
                {scheduledCards
                  .filter(c => !isOverdue(c.due_date!))
                  .slice(0, 8)
                  .map(c => (
                    <div
                      key={c.id}
                      onClick={() => onSelectCard(c)}
                      className="bg-white border border-gray-200/70 rounded-xl p-2.5 hover:border-blue-300 hover:shadow-xs cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                        <span className="text-blue-600 font-bold">Due</span>
                        <span className="text-gray-400">{formatDateShort(c.due_date!)}</span>
                      </div>
                      <h4 className="text-xs font-semibold text-gray-900 leading-snug truncate">
                        {c.title}
                      </h4>
                      <div className="flex items-center justify-between mt-1.5 text-[9px] text-gray-400">
                        <span>{c.team_name ?? 'Engineering'}</span>
                        {c.visibility === 'selected_teams' && (
                          <span className="font-bold text-indigo-600">Shared</span>
                        )}
                      </div>
                    </div>
                  ))}

                {scheduledCards.length === 0 && (
                  <p className="text-xs text-gray-400 italic py-4 text-center">
                    No scheduled tasks found for this selection.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
