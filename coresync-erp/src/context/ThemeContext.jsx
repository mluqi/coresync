import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themePresets = [
  { id: 'indigo', name: 'Indigo Professional', desc: 'Warna standar ERP modern & elegan', hex: '#4f46e5', bg: 'bg-indigo-600', border: 'border-indigo-600', ring: 'ring-indigo-500/20', text: 'text-indigo-600', gradient: 'from-indigo-600 to-violet-600' },
  { id: 'emerald', name: 'Emerald Clean', desc: 'Warna hijau tenang & segar', hex: '#059669', bg: 'bg-emerald-600', border: 'border-emerald-600', ring: 'ring-emerald-500/20', text: 'text-emerald-600', gradient: 'from-emerald-600 to-teal-600' },
  { id: 'violet', name: 'Violet Premium', desc: 'Warna ungu eksklusif & mewah', hex: '#7c3aed', bg: 'bg-violet-600', border: 'border-violet-600', ring: 'ring-violet-500/20', text: 'text-violet-600', gradient: 'from-violet-600 to-purple-600' },
  { id: 'blue', name: 'Blue Corporate', desc: 'Warna biru korporat profesional', hex: '#2563eb', bg: 'bg-blue-600', border: 'border-blue-600', ring: 'ring-blue-500/20', text: 'text-blue-600', gradient: 'from-blue-600 to-cyan-600' },
  { id: 'amber', name: 'Amber Warm', desc: 'Warna oranye hangat & energik', hex: '#d97706', bg: 'bg-amber-600', border: 'border-amber-600', ring: 'ring-amber-500/20', text: 'text-amber-600', gradient: 'from-amber-600 to-orange-600' },
  { id: 'rose', name: 'Rose Modern', desc: 'Warna merah muda dinamis & tegas', hex: '#e11d48', bg: 'bg-rose-600', border: 'border-rose-600', ring: 'ring-rose-500/20', text: 'text-rose-600', gradient: 'from-rose-600 to-pink-600' },
  { id: 'slate', name: 'Slate Dark Accent', desc: 'Warna abu-abu gelap minimalis', hex: '#334155', bg: 'bg-slate-700', border: 'border-slate-700', ring: 'ring-slate-500/20', text: 'text-slate-700', gradient: 'from-slate-700 to-slate-900' }
];

export const ThemeProvider = ({ children }) => {
  const [appTheme, setAppTheme] = useState(() => {
    return localStorage.getItem('appThemeColor') || 'indigo';
  });

  const changeTheme = (newThemeId) => {
    setAppTheme(newThemeId);
    localStorage.setItem('appThemeColor', newThemeId);
    document.documentElement.setAttribute('data-theme', newThemeId);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  const currentPreset = themePresets.find(t => t.id === appTheme) || themePresets[0];

  return (
    <ThemeContext.Provider value={{ appTheme, changeTheme, themePresets, currentPreset }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
