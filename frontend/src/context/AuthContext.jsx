import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('calar-token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/api/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('calar-token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const { data } = await api.post('/api/auth/login', credentials);
    localStorage.setItem('calar-token', data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(details) {
    await api.post('/api/auth/register', details);
    return login({ email: details.email, password: details.password });
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout');
    } finally {
      localStorage.removeItem('calar-token');
      setUser(null);
    }
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}