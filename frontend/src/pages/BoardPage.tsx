import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '../api/projects'
import { useBoard } from '../hooks/useBoard'
import { useFilters } from '../hooks/useFilters'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeft, Users, Activity, Filter, LogOut } from 'lucide-react'
import { KanbanBoard } from '../components/board/KanbanBoard'
import { BoardFilters } from '../components/board/BoardFilters'
import { MembersPanel } from '../components/board/MembersPanel'
import { ActivityPanel } from '../components/board/ActivityPanel'

type Panel = 'members' | 'activity' | null

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [activePanel, setActivePanel] = useState<Panel>(null)
  const [showFilters, setShowFilters] = useState(false)
  const { filters, setAssignee, setLabel, setOverdue, clearFilters, activeCount } = useFilters()

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  })

  const board = useBoard(projectId!, filters)

  // Real-time updates
  useWebSocket(projectId)

  const togglePanel = (panel: Panel) =>
    setActivePanel(p => (p === panel ? null : panel))

  const isOwner = project?.my_role === 'owner'

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600 p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <h1 className="font-semibold text-gray-900 truncate">{project?.name ?? '…'}</h1>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
            isOwner
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {isOwner ? '👑 Owner' : '👤 Member'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`btn-secondary text-xs flex items-center gap-1.5 ${activeCount > 0 ? 'border-primary-400 text-primary-700' : ''}`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters {activeCount > 0 && <span className="bg-primary-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{activeCount}</span>}
          </button>
          <button
            onClick={() => togglePanel('members')}
            className={`btn-secondary text-xs flex items-center gap-1.5 ${activePanel === 'members' ? 'bg-primary-50 border-primary-300' : ''}`}
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Members</span>
          </button>
          <button
            onClick={() => togglePanel('activity')}
            className={`btn-secondary text-xs flex items-center gap-1.5 ${activePanel === 'activity' ? 'bg-primary-50 border-primary-300' : ''}`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Activity</span>
          </button>
          <button onClick={() => logout()} className="text-gray-400 hover:text-gray-600 p-1 ml-1">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Filters bar */}
      {showFilters && projectId && (
        <BoardFilters
          projectId={projectId}
          filters={filters}
          onAssignee={setAssignee}
          onLabel={setLabel}
          onOverdue={setOverdue}
          onClear={clearFilters}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Board */}
        <div className="flex-1 overflow-x-auto">
          {projectId && (
            <KanbanBoard
              projectId={projectId}
              board={board}
              isOwner={isOwner}
            />
          )}
        </div>

        {/* Side panel */}
        {activePanel && projectId && (
          <div className="w-80 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            {activePanel === 'members' && (
              <MembersPanel projectId={projectId} isOwner={isOwner} onClose={() => setActivePanel(null)} />
            )}
            {activePanel === 'activity' && (
              <ActivityPanel projectId={projectId} onClose={() => setActivePanel(null)} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
