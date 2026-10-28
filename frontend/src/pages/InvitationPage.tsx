import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { membersApi } from '../api/members'
import { useAuth } from '../hooks/useAuth'
import { extractError } from '../utils/errors'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [_projectId, setProjectId] = useState<string | null>(null)

  const accept = async () => {
    if (!token) return
    setState('loading')
    setError(null)
    try {
      const result = await membersApi.acceptInvitation(token)
      setProjectId(result.project_id)
      setState('success')
      setTimeout(() => navigate(`/board/${result.project_id}`), 2000)
    } catch (err) {
      setError(extractError(err))
      setState('error')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Invitation</h1>
          <p className="text-gray-500 mb-6">Please sign in to accept this invitation.</p>
          <button onClick={() => navigate(`/login?redirect=/invitation/${token}`)} className="btn-primary">
            Sign in to accept
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {state === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation accepted!</h1>
            <p className="text-sm text-gray-500">Redirecting to your new project…</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation failed</h1>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button onClick={() => navigate('/dashboard')} className="btn-secondary">Go to dashboard</button>
          </>
        )}
        {(state === 'idle' || state === 'loading') && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Invitation</h1>
            <p className="text-gray-500 mb-2">You've been invited to join a project.</p>
            <p className="text-sm text-gray-400 mb-6">Accepting as <strong>{user?.email}</strong></p>
            <button onClick={accept} disabled={state === 'loading'} className="btn-primary">
              {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accept invitation
            </button>
          </>
        )}
      </div>
    </div>
  )
}
