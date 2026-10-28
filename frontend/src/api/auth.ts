import { apiClient } from './client';
import type { User } from '../types';

export const authApi = {
  login: async (email: string, password: string): Promise<User> => {
    const { data } = await apiClient.post<User>('/api/auth/login', { email, password });
    return data;
  },

  register: async (name: string, email: string, password: string): Promise<User> => {
    const { data } = await apiClient.post<User>('/api/auth/register', { name, email, password });
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/api/auth/me');
    return data;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/api/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, password: string): Promise<void> => {
    await apiClient.post('/api/auth/reset-password', { token, password });
  },

  updateProfile: async (payload: { name?: string; current_password?: string; new_password?: string }): Promise<User> => {
    const { data } = await apiClient.patch<User>('/api/auth/profile', payload);
    return data;
  },
};
