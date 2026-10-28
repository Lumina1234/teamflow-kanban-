import { useParams, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '../api/projects'
import { membersApi } from '../api/members'
import { useBoard } from '../hooks/useBoard'
import { useFilters } from '../hooks/useFilters'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../hooks/useAuth'
import { isOverdue } from '../utils/dates'
import {
  Folder,
  Calendar,
  Settings,
  Star,
  Search,
  Filter,
  Activity,
  LogOut,
  LayoutGrid,
  CheckCircle2,
  Clock,
  PieChart,
  Bell,
} from 'lucide-react'
import { KanbanBoard } from '../components/board/KanbanBoard'
import { BoardFilters } from '../components/board/BoardFilters'
import { RightSideWidgets } from '../components/board/RightSideWidgets'
import { MembersPanel } from '../components/board/MembersPanel'
import { ActivityPanel } from '../components/board/ActivityPanel'
import { CalendarModal } from '../components/board/CalendarModal'
import { UserSettingsModal } from '../components/board/UserSettingsModal'
import { CardDetailModal } from '../components/board/CardDetailModal'
import type { Card } from '../types'

type OverlayPanel = 'full_members' | 'full_activity' | null

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [overlayPanel, setOverlayPanel] = useState<OverlayPanel>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isStarred, setIsStarred] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedCardForModal, setSelectedCardForModal] = useState<Card | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  const { filters, setAssignee, setLabel, setOverdue, setTeam, clearFilters, activeCount } = useFilters()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId!),
    enabled: !!projectId,
  })

  const board = useBoard(projectId!, filters)

  // Real-time WebSocket connection
  useWebSocket(projectId)

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close more menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    if (moreMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [moreMenuOpen])

  const isOwner = project?.my_role === 'owner'
  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'DE'

  // ── Metrics calculations ──────────────────────────────────────────────
  const allCards = Object.values(board.cardsByColumn).flat()
  const totalTasks = allCards.length
  const completedColumnIds = new Set(
    board.columns
      .filter(c => c.is_completed || c.name.toLowerCase().includes('done'))
      .map(c => c.id)
  )
  const completedTasks = allCards.filter(c => completedColumnIds.has(c.column_id)).length
  const overdueTasks = allCards.filter(
    c => c.due_date && isOverdue(c.due_date) && !completedColumnIds.has(c.column_id)
  ).length
  const remainingTasks = totalTasks - completedTasks
  const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="h-screen flex bg-[#F8FAFC] overflow-hidden select-none">
      {/* ── Left Navigation Rail ────────────────────────────────────────── */}
      <aside className="w-[72px] bg-white border-r border-gray-100 flex flex-col items-center py-5 justify-between shrink-0 z-20">
        <div className="flex flex-col items-center gap-7 w-full">
          {/* App Logo */}
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 cursor-pointer">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="12 8 8 12 12 16 16 12 12 8" />
            </svg>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col items-center gap-4 w-full px-2">
            {/* Board (Active) */}
            <button
              onClick={() => {}}
              className="flex flex-col items-center gap-1 py-2 px-1 w-full rounded-2xl text-blue-600 hover:bg-blue-50/50 transition-colors"
              title="Kanban Board"
            >
              <div className="w-10 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <span className="font-extrabold text-sm tracking-tighter">00</span>
              </div>
              <span className="text-[10px] font-bold text-blue-600">Board</span>
            </button>

            {/* Projects (For owners or project switches) */}
            <button
              onClick={() => navigate('/dashboard')}
              className="flex flex-col items-center gap-1 py-2 px-1 w-full rounded-2xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              title="Projects"
            >
              <div className="w-10 h-8 flex items-center justify-center">
                <Folder className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium text-gray-400">Projects</span>
            </button>

            {/* Calendar */}
            <button
              onClick={() => setShowCalendar(true)}
              className={`flex flex-col items-center gap-1 py-2 px-1 w-full rounded-2xl transition-all cursor-pointer ${
                showCalendar
                  ? 'text-blue-600 bg-blue-50 font-bold shadow-2xs'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`}
              title="Calendar & Deadlines"
            >
              <div className="w-10 h-8 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <span className={`text-[10px] font-medium ${showCalendar ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                Calendar
              </span>
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className={`flex flex-col items-center gap-1 py-2 px-1 w-full rounded-2xl transition-all cursor-pointer ${
                showSettings
                  ? 'text-blue-600 bg-blue-50 font-bold shadow-2xs'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`}
              title="User Profile & Settings"
            >
              <div className="w-10 h-8 flex items-center justify-center">
                <Settings className="h-5 w-5" />
              </div>
              <span className={`text-[10px] font-medium ${showSettings ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
                Settings
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom User Avatar */}
        <div
          onClick={() => setMoreMenuOpen(prev => !prev)}
          className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 font-bold text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all shadow-xs"
          title={user?.name ?? 'Account'}
        >
          {userInitials}
        </div>
      </aside>

      {/* ── Main Workspace ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 px-6 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 z-10">
          {/* Left: Project Brand & Info */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Project Capsule Icon */}
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-xs shadow-sm shadow-blue-500/20 shrink-0">
              00
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-gray-900 truncate">
                  {project?.name ?? 'Demo Kanban Project'}
                </h1>
                <button
                  onClick={() => setIsStarred(!isStarred)}
                  className="text-gray-300 hover:text-amber-400 p-0.5 transition-colors"
                  title="Favorite project"
                >
                  <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    isOwner
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : project?.my_job_role === 'hr'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : project?.my_job_role === 'designer'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {isOwner
                    ? '👑 Project Lead · Owner'
                    : project?.my_job_role === 'designer'
                    ? 'UI/UX Design · Designer'
                    : project?.my_job_role === 'hr'
                    ? 'HR & People Ops · Manager'
                    : project?.my_team_name
                    ? `${project.my_team_name} · Member`
                    : 'Engineering · Member'}
                </span>
                <p className="text-xs text-gray-400 truncate">
                  {project?.description ?? 'A small team project to manage and track work'}
                </p>
              </div>
            </div>
          </div>

          {/* Middle: Search Bar */}
          <div className="flex-1 max-w-md mx-6 hidden md:block">
            <div className="relative flex items-center w-full">
              <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search cards, labels or members..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-gray-200/90 rounded-xl pl-9 pr-14 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
              />
              <span className="absolute right-2.5 bg-gray-100 text-gray-400 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-200">
                Ctrl K
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Filters Button */}
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all ${
                showFilters || activeCount > 0
                  ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-2xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeCount}
                </span>
              )}
            </button>

            {/* Members Button with overlapping avatars */}
            <button
              onClick={() => setOverlayPanel(p => (p === 'full_members' ? null : 'full_members'))}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                overlayPanel === 'full_members'
                  ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-2xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex -space-x-1.5 overflow-hidden">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 font-bold text-[9px] flex items-center justify-center ring-2 ring-white">
                  DE
                </div>
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-bold text-[9px] flex items-center justify-center ring-2 ring-white">
                  DE
                </div>
              </div>
              <span className="ml-1 hidden sm:inline">Members</span>
            </button>

            {/* Activity Button */}
            <button
              onClick={() => setOverlayPanel(p => (p === 'full_activity' ? null : 'full_activity'))}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all ${
                overlayPanel === 'full_activity'
                  ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-2xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Activity</span>
            </button>

            {/* Notification Bell */}
            <button
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>

            {/* User Avatar Circle */}
            <div
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center cursor-pointer ring-2 ring-blue-100"
              title={user?.name ?? 'Account'}
            >
              {userInitials}
            </div>

            {/* More Menu Dropdown */}
            {moreMenuOpen && (
              <div
                ref={moreMenuRef}
                className="absolute right-6 top-16 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-30 text-xs"
              >
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="font-bold text-gray-900 truncate">{user?.name ?? 'Demo Member'}</p>
                  <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setMoreMenuOpen(false); navigate('/dashboard') }}
                  className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Folder className="h-3.5 w-3.5 text-gray-400" />
                  All Projects
                </button>
                <button
                  onClick={() => { setMoreMenuOpen(false); setShowSettings(true) }}
                  className="w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Settings className="h-3.5 w-3.5 text-gray-400" />
                  Profile & Settings
                </button>
                <button
                  onClick={() => { setMoreMenuOpen(false); logout() }}
                  className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut className="h-3.5 w-3.5 text-red-500" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Stats / Metrics Bar ───────────────────────────────────────── */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between text-xs shrink-0 overflow-x-auto">
          <div className="flex items-center gap-6 shrink-0">
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <LayoutGrid className="h-4 w-4 text-blue-600" />
              <span className="font-bold text-gray-900">{totalTasks}</span> Total tasks
            </div>
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-bold text-gray-900">{completedTasks}</span> Completed
            </div>
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="font-bold text-gray-900">{overdueTasks}</span> Overdue
            </div>
            <div className="flex items-center gap-2 text-gray-700 font-semibold">
              <PieChart className="h-4 w-4 text-blue-500" />
              <span className="font-bold text-gray-900">{remainingTasks}</span> Remaining
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3 w-56 md:w-64 shrink-0 ml-4">
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-500 shrink-0">
              {percentComplete}% complete
            </span>
          </div>
        </div>

        {/* Board Filters Bar (Collapsible) */}
        {showFilters && projectId && (
          <BoardFilters
            projectId={projectId}
            filters={filters}
            onAssignee={setAssignee}
            onLabel={setLabel}
            onOverdue={setOverdue}
            onTeam={setTeam}
            onClear={clearFilters}
          />
        )}

        {/* ── Main Canvas: Board + Right Side Panels ───────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main Kanban Board */}
          <main className="flex-1 overflow-x-auto bg-[#F8FAFC]">
            {projectId && (
              <KanbanBoard
                projectId={projectId}
                board={board}
                isOwner={isOwner}
                searchQuery={searchQuery}
                members={members}
              />
            )}
          </main>

          {/* Right Sidebar Widgets: Members + Recent Activity */}
          {projectId && (
            <aside className="hidden lg:block">
              <RightSideWidgets
                projectId={projectId}
                isOwner={isOwner}
                members={members}
                onOpenInvite={() => setOverlayPanel('full_members')}
                onOpenFullActivity={() => setOverlayPanel('full_activity')}
              />
            </aside>
          )}

          {/* Drawer Overlay for Mobile or full detail view */}
          {overlayPanel && projectId && (
            <aside className="w-80 shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-hidden shadow-2xl z-30 absolute right-0 top-16 bottom-0">
              {overlayPanel === 'full_members' && (
                <MembersPanel
                  projectId={projectId}
                  isOwner={isOwner}
                  onClose={() => setOverlayPanel(null)}
                />
              )}
              {overlayPanel === 'full_activity' && (
                <ActivityPanel
                  projectId={projectId}
                  onClose={() => setOverlayPanel(null)}
                />
              )}
            </aside>
          )}

          {/* Schedule & Calendar Modal */}
          {showCalendar && (
            <CalendarModal
              cards={allCards}
              onSelectCard={c => setSelectedCardForModal(c)}
              onClose={() => setShowCalendar(false)}
            />
          )}

          {/* User Profile & Settings Modal */}
          {showSettings && (
            <UserSettingsModal
              project={project}
              onClose={() => setShowSettings(false)}
            />
          )}

          {/* Card Detail Modal (when opening a task from Calendar) */}
          {selectedCardForModal && projectId && (
            <CardDetailModal
              card={selectedCardForModal}
              projectId={projectId}
              isOwner={isOwner}
              onClose={() => setSelectedCardForModal(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
