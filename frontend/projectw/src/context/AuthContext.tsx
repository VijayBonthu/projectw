import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  login: (token: string) => void;
  logout: () => void;
}

const defaultValue: AuthContextType = {
  isAuthenticated: false,
  user: null,
  login: () => {},
  logout: () => {}
};

const AuthContext = createContext<AuthContextType>(defaultValue);

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any | null>(null);
  
  useEffect(() => {
    // Check if token exists in localStorage on mount
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      // Optionally fetch user profile here
    }
  }, []);

  const login = (token: string) => {
    // Clear any existing tokens first
    localStorage.removeItem('regular_token');
    localStorage.removeItem('google_auth_token');
    
    // Set the new token
    localStorage.setItem('token', token);
    
    // Update Authorization header
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 