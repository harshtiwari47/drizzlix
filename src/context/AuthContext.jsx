import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function readStoredToken() {
  try {
    return localStorage.getItem('token') || null;
  } catch {
    return null;
  }
}

function readStoredUser() {
  try {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) return null;
    return JSON.parse(rawUser);
  } catch {
    try {
      localStorage.removeItem('user');
    } catch {
      // Ignore localStorage cleanup failure.
    }
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken());
  const [user, setUser] = useState(() => readStoredUser());
  const [stats, setStats] = useState(null);

  const fetchStats = useCallback(async (currentToken) => {
    if (!currentToken) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/stats`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchStats(token);
    } else {
      setStats(null);
    }
  }, [token, fetchStats]);

  const logActivityAndXP = useCallback(async (xpGain = 0, logActivity = true) => {
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ xpGain, logActivity })
      });
      if (res.ok) {
        const updatedStats = await res.json();
        setStats(updatedStats);
      }
    } catch (err) {
      console.error('Failed to log activity/XP:', err);
    }
  }, [token]);

  const login = useCallback((jwtData, userData) => {
    setToken(jwtData);
    setUser(userData);
    try {
      localStorage.setItem('token', jwtData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch {
      // Ignore storage errors and keep in-memory auth state.
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const authValue = useMemo(() => ({
    token, 
    user, 
    stats,
    login, 
    logout,
    logActivityAndXP
  }), [token, user, stats, login, logout, logActivityAndXP]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

