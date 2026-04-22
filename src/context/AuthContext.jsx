import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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

  const authValue = useMemo(() => ({ token, user, login, logout }), [token, user, login, logout]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

