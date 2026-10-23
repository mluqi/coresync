import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      const storedTenant = localStorage.getItem('tenant');
      const activeTenantId = localStorage.getItem('activeTenantId');

      if (!storedToken || !storedUser) {
        setLoading(false);
        return;
      }

      let currentUserObj = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(currentUserObj);

      try {
        const profileRes = await api.get('/auth/profile', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        if (profileRes.data?.user) {
          currentUserObj = profileRes.data.user;
          setUser(currentUserObj);
          localStorage.setItem('user', JSON.stringify(currentUserObj));
        }
      } catch (err) {
        console.error('Failed to sync profile on session restore:', err);
      }

      if (currentUserObj.role === 'SUPERADMIN' && activeTenantId) {
        try {
          const res = await api.get('/tenant/settings');
          setTenant(res.data.data);
        } catch (err) {
          console.error('Failed to fetch impersonated tenant:', err);
          if (storedTenant) setTenant(JSON.parse(storedTenant));
        }
      } else {
        if (storedTenant) setTenant(JSON.parse(storedTenant));
      }

      setLoading(false);
    };

    restoreSession();
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/login', { email, password });
      
      const { token: jwtToken, user: userData } = response.data;
      
      localStorage.setItem('token', jwtToken);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(jwtToken);
      setUser(userData);

      // Fetch user profile to get full tenant details (taxStatus, subdomain, modules)
      const profileResponse = await api.get('/auth/profile', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      
      const tenantData = profileResponse.data.tenant;
      localStorage.setItem('tenant', JSON.stringify(tenantData));
      setTenant(tenantData);
      
      setLoading(false);
      return { success: true };
    } catch (error) {
      setLoading(false);
      const msg = error.response?.data?.message || 'Login failed. Please check credentials.';
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
      localStorage.removeItem('activeTenantId'); // Clear Act As selection on logout
      setToken(null);
      setUser(null);
      setTenant(null);
    }
  };

  const actAsTenant = async (tenantId) => {
    if (!tenantId) {
      localStorage.removeItem('activeTenantId');
      try {
        const profileResponse = await api.get('/auth/profile');
        const tenantData = profileResponse.data.tenant;
        localStorage.setItem('tenant', JSON.stringify(tenantData));
        setTenant(tenantData);
      } catch (err) {
        console.error(err);
      }
      window.location.reload();
      return;
    }
    localStorage.setItem('activeTenantId', tenantId.toString());
    try {
      const res = await api.get('/tenant/settings');
      setTenant(res.data.data);
    } catch (err) {
      console.error('Act as tenant error:', err);
    }
    window.location.reload();
  };

  const updateUser = (updatedUserData) => {
    setUser(updatedUserData);
    localStorage.setItem('user', JSON.stringify(updatedUserData));
  };

  return (
    <AuthContext.Provider value={{ user, token, tenant, setTenant, loading, login, logout, actAsTenant, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
