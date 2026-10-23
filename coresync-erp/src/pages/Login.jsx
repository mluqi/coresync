import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Loader2, AlertCircle, AlertTriangle, Layers, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const isRemembered = localStorage.getItem('rememberMe') === 'true';
    if (isRemembered && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    // Check for session expiration or termination notification
    const rawNotice = sessionStorage.getItem('authNotification');
    if (rawNotice) {
      try {
        const parsed = JSON.parse(rawNotice);
        setSessionNotice(parsed);
      } catch (e) {
        setSessionNotice({ message: rawNotice, type: 'warning' });
      }
      sessionStorage.removeItem('authNotification');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }

    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberedEmail');
      localStorage.setItem('rememberMe', 'false');
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50/80 px-4 py-12 relative overflow-hidden antialiased">
      {/* Background Decorative Ambient Radial Meshes */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-theme-light/80 rounded-full blur-3xl pointer-events-none opacity-70" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-theme-light/80 rounded-full blur-3xl pointer-events-none opacity-70" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-card mx-auto mb-4 border border-zinc-200/80 overflow-hidden ring-4 ring-black/5 bg-white">
            <img src="/logo/logo.png" alt="Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
          <h2 className="text-3xl font-extrabold text-zinc-900 tracking-tight">CoreSync ERP</h2>
          <p className="text-sm text-zinc-500 font-medium">Portal Akses Sistem Terpadu Usaha & Perusahaan</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/85 backdrop-blur-xl border border-zinc-200/90 rounded-xl p-7 sm:p-8 shadow-dropdown">
          <form onSubmit={handleSubmit} className="space-y-5">
            {sessionNotice && (
              <div className={`border rounded-lg p-4 flex items-start space-x-3 text-sm animate-fadeIn ${
                sessionNotice.code === 'SESSION_TERMINATED' || sessionNotice.type === 'warning'
                  ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                  : 'bg-indigo-50/90 border-indigo-200 text-indigo-900'
              }`}>
                {sessionNotice.code === 'SESSION_TERMINATED' || sessionNotice.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 text-indigo-600 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs uppercase tracking-wider">
                    {sessionNotice.code === 'SESSION_TERMINATED'
                      ? 'Sesi Berakhir (Login Perangkat Lain)'
                      : 'Pemberitahuan Sesi'}
                  </p>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">{sessionNotice.message}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start space-x-3 text-rose-700 text-sm animate-fadeIn">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@perusahaan.com"
                  className="w-full pl-11 pr-4 py-3 bg-zinc-50/80 border border-zinc-200/90 rounded-lg text-sm placeholder-zinc-400 focus:bg-white focus:ring-4 focus:ring-primary-ring focus:border-theme transition-all outline-none"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-zinc-50/80 border border-zinc-200/90 rounded-lg text-sm placeholder-zinc-400 focus:bg-white focus:ring-4 focus:ring-primary-ring focus:border-theme transition-all outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
                  title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-zinc-600 hover:text-zinc-900 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 cursor-pointer text-theme focus:ring-0 accent-theme"
                />
                <span>Ingat saya di perangkat ini</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-theme-gradient text-white rounded-lg text-sm font-bold hover:opacity-95 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:shadow-none cursor-pointer mt-2 active:scale-[0.985]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Masuk...</span>
                </>
              ) : (
                <span>Masuk Sekarang</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-400 font-medium">
          &copy; {new Date().getFullYear()} CoreSync ERP &bull; Enterprise Platform
        </p>
      </div>
    </div>
  );
};

export default Login;
