import { useAuthContext } from '../providers/AuthProvider'
import { authApi } from '../api/auth'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useAuth() {
  const { user, isLoading, isAuthenticated, refetch, clearUser } = useAuthContext()
  const queryClient = useQueryClient()

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: () => refetch(),
  })

  const registerMutation = useMutation({
    mutationFn: ({ name, email, password }: { name: string; email: string; password: string }) =>
      authApi.register(name, email, password),
    onSuccess: () => refetch(),
  })

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      clearUser()
      queryClient.clear()
    },
  })

  return {
    user,
    isLoading,
    isAuthenticated,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginPending: loginMutation.isPending,
    registerPending: registerMutation.isPending,
    logoutPending: logoutMutation.isPending,
  }
}
