import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, loginRequest, logoutRequest } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: Infinity,
  });

  async function login(credentials) {
    const loggedInUser = await loginRequest(credentials);
    queryClient.setQueryData(['currentUser'], loggedInUser);
    return loggedInUser;
  }

  async function logout() {
    await logoutRequest();
    queryClient.setQueryData(['currentUser'], null);
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
