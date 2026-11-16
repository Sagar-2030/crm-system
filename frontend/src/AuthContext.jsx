import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('crm_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier, password) => {
    const res = await api.post('/auth/login', { identifier, password });
    localStorage.setItem('crm_token', res.data.token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('crm_token');
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser) => setUser(updatedUser), []);

  const isManager = !!user && (user.role === 'superadmin' || user.role === 'manager');

  return <AuthContext.Provider value={{ user, loading, login, logout, updateUser, isManager }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
