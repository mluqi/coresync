import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Search,
  ShoppingCart,
  Truck,
  Package,
  Layers,
  Printer,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  Sparkles,
  ClipboardCheck,
  ExternalLink,
  ChevronDown,
  Info,
  Palette,
  KeyRound,
  User,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Image as ImageIcon,
  RotateCcw,
  FileText,
  Check
} from 'lucide-react';

// Komponen Visual Tangkapan Layar (Screenshot Mockup) dengan MacOS Frame & Pin Anotasi
const ScreenshotMockup = ({ title, url, annotations = [], children }) => (
  <div className="my-3.5 rounded-xl border border-zinc-300/80 bg-zinc-900/5 shadow-md overflow-hidden text-left print:break-inside-avoid">
    {/* Window Titlebar */}
    <div className="bg-zinc-800 text-zinc-300 px-3.5 py-2 flex items-center justify-between text-[11px] border-b border-zinc-700 select-none">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
        </div>
        <span className="font-bold text-zinc-200 ml-1.5 flex items-center gap-1.5 text-xs">
          <ImageIcon size={13} className="text-indigo-400" />
          {title}
        </span>
      </div>
      <div className="px-2.5 py-0.5 rounded-md bg-zinc-900/90 text-zinc-400 font-mono text-[10px] hidden sm:block border border-zinc-700/60">
        {url || 'http://localhost:5173'}
      </div>
    </div>

    {/* Mockup Screen Content */}
    <div className="p-3 sm:p-4 bg-zinc-100/70 overflow-x-auto">
      {children}
    </div>

    {/* Annotations / Pins Legend */}
    {annotations && annotations.length > 0 && (
      <div className="bg-white border-t border-zinc-200 px-4 py-3 text-[11px] text-zinc-700">
        <div className="font-extrabold text-zinc-900 mb-2 flex items-center gap-1.5 text-xs">
          <Sparkles size={13} className="text-amber-500" />
          <span>Panduan Elemen Visual (Keterangan Pin):</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5">
          {annotations.map((ann, idx) => (
            <div key={idx} className="flex items-start gap-2 bg-zinc-50/80 p-1.5 rounded-lg border border-zinc-200/60">
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                {idx + 1}
              </span>
              <div className="leading-tight">
                <span className="font-bold text-zinc-900">{ann.label}: </span>
                <span className="text-zinc-600">{ann.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const Help = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [expandedSection, setExpandedSection] = useState(null);

  const categories = [
    { id: 'ALL', label: 'Semua Panduan', icon: BookOpen },
    { id: 'BASIC', label: 'Akun, Password & Tema', icon: Palette },
    { id: 'SALES', label: 'Sales Order (Penjualan)', icon: ShoppingCart },
    { id: 'PURCHASE', label: 'Purchase Order (Pembelian)', icon: Package },
    { id: 'MANIFEST', label: 'Manifest Driver (Logistik)', icon: Truck },
    { id: 'FLOW', label: 'Alur Kerja Sistem', icon: Layers },
    { id: 'SOP', label: 'SOP & Kasus Lapangan', icon: ClipboardCheck },
    { id: 'FAQ', label: 'Tanya Jawab & Tips', icon: HelpCircle },
  ];

  const handlePrint = () => {
    window.print();
  };

  const toggleSection = (id) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6 max-w-8xl mx-auto pb-12 print:space-y-4 print:pb-0 print:max-w-none">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-indigo-700/50 print:border-none print:bg-white print:text-black print:p-2">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 backdrop-blur-md border border-indigo-400/30 text-indigo-200 text-xs font-bold uppercase tracking-wider print:hidden">
              <Sparkles size={13} className="text-amber-300" />
              Pusat Panduan & Bantuan Operasional Staff
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white print:text-zinc-950">
              Panduan Penggunaan CoreSync ERP
            </h1>
            <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed print:text-zinc-700">
              Panduan lengkap langkah demi langkah: pengaturan akun, ganti password, ganti warna tema, modul Penjualan (Sales Order), Pembelian (Purchase Order), Manifest Driver, serta SOP operasional harian.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 backdrop-blur-md text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Cetak panduan ini untuk arsip fisik / papan pengumuman staff"
            >
              <Printer size={16} />
              <span>Cetak Panduan (PDF)</span>
            </button>
            <button
              onClick={() => navigate('/transactions/sales')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              <span>Buka Transaksi</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Decorative ambient backdrop */}
        <div className="absolute -right-16 -bottom-16 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none print:hidden" />
      </div>

      {/* Search and Filter Controls (Hidden on Print) */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Cari kata kunci (contoh: ganti password, ganti tema, diskon, bonus, surat jalan, cetak faktur, terima barang, retur, manifest)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium text-zinc-800 placeholder-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700 bg-zinc-200/80 hover:bg-zinc-300 px-2 py-0.5 rounded-md cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const IconComponent = cat.icon;
            const isActive = activeCategory === cat.id && !searchQuery;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchQuery('');
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-600 hover:text-zinc-900 border border-zinc-200/60'
                }`}
              >
                <IconComponent size={15} className={isActive ? 'text-white' : 'text-zinc-500'} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 0: BASIC SETTINGS (GANTI PASSWORD, TEMA, PROFIL, NAVIGASI) */}
      {(activeCategory === 'ALL' || activeCategory === 'BASIC') && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                <Palette size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-900">Panduan Dasar: Akun, Ganti Password & Pengaturan Tema Aplikasi</h2>
                <p className="text-xs text-zinc-500">Personalisasi tampilan akun Anda, ubah kata sandi, dan tips navigasi cepat</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/profile')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition-colors cursor-pointer w-fit"
              >
                <User size={13} />
                <span>Buka Profil Saya</span>
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 text-xs font-bold transition-colors cursor-pointer w-fit"
              >
                <SettingsIcon size={13} />
                <span>Buka Pengaturan Tema</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 0.1 Ganti Password */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                    <KeyRound size={15} />
                  </div>
                  <h3 className="text-sm font-black text-zinc-900">1. Cara Mengganti Kata Sandi (Password)</h3>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Keamanan</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-zinc-700 leading-relaxed pl-1">
                <li>Klik foto profil/nama Anda di <strong>Pojok Kanan Atas</strong> ➔ pilih <strong>Profil Saya</strong> (atau klik <span className="font-semibold text-indigo-600 cursor-pointer underline" onClick={() => navigate('/profile')}>ke menu Profil</span>).</li>
                <li>Pilih tab <strong>Keamanan (Password)</strong>.</li>
                <li>Masukkan <strong>Kata Sandi Saat Ini</strong> (password lama Anda).</li>
                <li>Masukkan <strong>Kata Sandi Baru</strong> (minimal 6 karakter kombinasi huruf & angka) dan ulangi di kolom <strong>Konfirmasi Sandi Baru</strong>.</li>
                <li>Klik tombol <strong>Simpan Kata Sandi Baru</strong>.</li>
              </ol>
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <span><strong>Tips Keamanan:</strong> Jangan gunakan tanggal lahir atau password yang mudah ditebak. Ganti password secara berkala setiap 3–6 bulan.</span>
              </div>
            </div>

            {/* Step 0.2 Ganti Foto Profil & Biodata */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <User size={15} />
                  </div>
                  <h3 className="text-sm font-black text-zinc-900">2. Mengubah Foto Profil & Data Diri</h3>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Akun</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-zinc-700 leading-relaxed pl-1">
                <li>Buka menu <strong>Profil Saya</strong> ➔ tab <strong>Informasi Akun</strong>.</li>
                <li><strong>Foto Avatar:</strong> Anda dapat mengklik tombol <strong>Unggah Foto</strong> dari komputer/HP, atau memilih salah satu <strong>Avatar Karakter</strong> yang telah disediakan.</li>
                <li><strong>Data Kontak:</strong> Perbarui Nama Lengkap, Nomor HP/WhatsApp aktif, serta Alamat jika ada perubahan.</li>
                <li>Klik tombol <strong>Simpan Profil</strong> di bagian bawah formulir.</li>
              </ol>
              <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200/80 text-[11px] text-indigo-900 flex items-start gap-2">
                <Info size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                <span>Foto avatar Anda akan muncul di pojok kanan atas aplikasi dan di riwayat pencatatan log transaksi sistem.</span>
              </div>
            </div>

            {/* Step 0.3 Ganti Warna Tema Aplikasi */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <Palette size={15} />
                  </div>
                  <h3 className="text-sm font-black text-zinc-900">3. Mengubah Warna Tema Tampilan Aplikasi</h3>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Tampilan</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-zinc-700 leading-relaxed pl-1">
                <li>Klik tombol <strong>Pengaturan</strong> di menu profil atau sidebar ➔ pilih tab <strong>Warna Tema</strong> (atau klik <span className="font-semibold text-indigo-600 cursor-pointer underline" onClick={() => navigate('/settings')}>Buka Pengaturan Tema</span>).</li>
                <li>Tersedia 6 pilihan palet warna tema profesional:
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <span className="px-2 py-1 bg-indigo-50 border border-indigo-200 rounded text-indigo-700 text-[10px] font-black text-center">Indigo Modern</span>
                    <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-[10px] font-black text-center">Emerald Green</span>
                    <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-blue-700 text-[10px] font-black text-center">Royal Blue</span>
                    <span className="px-2 py-1 bg-rose-50 border border-rose-200 rounded text-rose-700 text-[10px] font-black text-center">Rose Passion</span>
                    <span className="px-2 py-1 bg-purple-50 border border-purple-200 rounded text-purple-700 text-[10px] font-black text-center">Violet Luxury</span>
                    <span className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-amber-700 text-[10px] font-black text-center">Warm Amber</span>
                  </div>
                </li>
                <li className="mt-2">Klik warna pilihan Anda. Warna tombol, badge, dan highlight aplikasi akan <strong>berubah seketika</strong> dan tersimpan otomatis pada browser Anda.</li>
              </ol>
            </div>

            {/* Step 0.4 Navigasi Cepat, Buka/Tutup Sidebar & Filter */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <SlidersHorizontal size={15} />
                  </div>
                  <h3 className="text-sm font-black text-zinc-900">4. Tips Navigasi Cepat & Fitur Pencarian</h3>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Shortcut</span>
              </div>
              <ul className="space-y-2 text-xs text-zinc-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Tombol Menu Hamburger (☰):</strong> Klik ikon menu di pojok kiri atas untuk menciutkan sidebar agar tabel transaksi Anda menjadi lebih lebar dan lega.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Kotak Pencarian Tabel (Global Search):</strong> Ketik nama toko, SKU barang, nomor SO/PO, nama supir, atau alamat langsung di kotak pencarian tabel untuk menemukan data dalam hitungan detik.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Ekspor Excel & Cetak Dokumen:</strong> Di setiap halaman tabel terdapat tombol <em>Export Excel</em> untuk backup laporan harian.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* SCREENSHOT MOCKUP 00: Pengaturan Profil & Ganti Tema */}
          <ScreenshotMockup
            title="Tangkapan Layar: Pengaturan Akun, Kata Sandi & Personalisasi 6 Warna Tema"
            url="http://localhost:5173/settings"
            annotations={[
              { label: "Pin 1 (Ganti Password)", desc: "Form pembaruan kata sandi akun pada tab Keamanan." },
              { label: "Pin 2 (Palet Warna Tema)", desc: "6 pilihan warna kerja yang berganti seketika secara real-time." }
            ]}
          >
            <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs space-y-3 text-xs select-none">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Form Password Mini */}
                <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1.5 relative">
                  <span className="absolute -top-2.5 -left-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">1</span>
                  <div className="font-bold text-zinc-800 text-[11px] flex items-center gap-1.5">
                    <KeyRound size={13} className="text-rose-600" />
                    <span>Ubah Kata Sandi Akun</span>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="p-1 bg-white border border-zinc-200 rounded text-zinc-400">•••••••• (Sandi Lama)</div>
                    <div className="p-1 bg-white border border-zinc-200 rounded text-zinc-400">•••••••• (Sandi Baru Min. 6 Karakter)</div>
                  </div>
                  <button className="w-full mt-1 py-1 rounded bg-rose-600 text-white font-bold text-[10px]">
                    Simpan Kata Sandi Baru
                  </button>
                </div>

                {/* Palet Tema Mini */}
                <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1.5 relative">
                  <span className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">2</span>
                  <div className="font-bold text-zinc-800 text-[11px] flex items-center gap-1.5">
                    <Palette size={13} className="text-indigo-600" />
                    <span>Pilihan Warna Tema Aktif</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold text-center">
                    <div className="p-1 rounded bg-indigo-600 text-white shadow-xs">Indigo (Aktif)</div>
                    <div className="p-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">Emerald</div>
                    <div className="p-1 rounded bg-blue-100 text-blue-800 border border-blue-300">Royal Blue</div>
                    <div className="p-1 rounded bg-rose-100 text-rose-800 border border-rose-300">Rose</div>
                    <div className="p-1 rounded bg-purple-100 text-purple-800 border border-purple-300">Violet</div>
                    <div className="p-1 rounded bg-amber-100 text-amber-800 border border-amber-300">Amber</div>
                  </div>
                </div>
              </div>
            </div>
          </ScreenshotMockup>
        </div>
      )}

      {/* SECTION 1: SYSTEM OVERVIEW FLOW */}
      {(activeCategory === 'ALL' || activeCategory === 'FLOW') && !searchQuery && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-900">1. Alur Transaksi Utama (End-to-End Overview)</h2>
                <p className="text-xs text-zinc-500">Peta interaksi antara Pembelian (Supplier), Stok Gudang, Penjualan, dan Driver</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Integrasi Otomatis
            </span>
          </div>

          {/* Workflow Step Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-gradient-to-b from-blue-50/50 to-blue-50/10 border border-blue-200/80 relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">1</span>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">Restok</span>
              </div>
              <div>
                <h3 className="text-xs font-black text-blue-950 uppercase tracking-wider">Purchase Order</h3>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Pesan barang ke supplier. Saat truk supplier tiba & dibongkar, klik <strong>Terima Barang</strong> untuk memasukkan stok ke gudang (FIFO).
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-gradient-to-b from-amber-50/50 to-amber-50/10 border border-amber-200/80 relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-black flex items-center justify-center">2</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">Order Toko</span>
              </div>
              <div>
                <h3 className="text-xs font-black text-amber-950 uppercase tracking-wider">Sales Order (SO)</h3>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Input pesanan toko/langganan. Tentukan multi-satuan (Karton/Pack), diskon, serta kuantitas <strong>Bonus Gratis</strong> jika ada promo.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-50/50 to-emerald-50/10 border border-emerald-200/80 relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">3</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">Logistik</span>
              </div>
              <div>
                <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider">Manifest Driver</h3>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Gabungkan puluhan pesanan toko ke dalam <strong>1 Armada Supir</strong>. Cetak Rekap Muatan Truk & Surat Jalan rute harian.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl bg-gradient-to-b from-purple-50/50 to-purple-50/10 border border-purple-200/80 relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-black flex items-center justify-center">4</span>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md">Finansial</span>
              </div>
              <div>
                <h3 className="text-xs font-black text-purple-950 uppercase tracking-wider">Invoice & Pelunasan</h3>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                  Tagihan faktur otomatis terbentuk. Kasir menerima setoran Tunai / COD / Transfer Bank dan mencatat pelunasan piutang toko.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SALES ORDER MODULE */}
      {(activeCategory === 'ALL' || activeCategory === 'SALES') && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-900">Modul 1: Sales Order (Penjualan, Filter & Retur)</h2>
                <p className="text-xs text-zinc-500">Menu: <strong>Transaksi ➔ Penjualan (Sales)</strong> atau klik tombol pintas di bawah</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/transactions/sales')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors cursor-pointer w-fit"
            >
              <span>Buka Menu Sales</span>
              <ExternalLink size={13} />
            </button>
          </div>

          {/* Detailed Step list */}
          <div className="space-y-4">
            {/* Step 2.1 Toolbar & Filter 2 Tingkat */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-black flex items-center justify-center">A</span>
                <h3 className="text-sm font-black text-zinc-900">Toolbar Filter 2 Tingkat & Navigasi Transaksi</h3>
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Baris 1 (Navigasi & Aksi):</strong> Tab transaksi terdiri dari <strong>SO (Sales Order)</strong>, <strong>SJ (Surat Jalan)</strong>, dan <strong>RET (Retur Penjualan)</strong>. Di sisi kanan tersedia tombol <em>Export Excel (format DMS)</em> dan tombol <strong>+ Tambah Pesanan</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Baris 2 (Toolbar Filter Lengkap):</strong> Dilengkapi filter instan: Pencarian No. SO / Toko / Sales, Filter Status Pesanan, Status Pembayaran (Lunas/Tempo), Tipe Pajak (PKP / Non-PKP), Filter Salesman, Toggle Pesanan Batal, serta <strong>Tombol Reset Filter (1-klik)</strong> untuk mereset seluruh filter seketika.</span>
                </li>
              </ul>

              {/* SCREENSHOT MOCKUP 01: Toolbar 2-Tingkat Transaksi */}
              <ScreenshotMockup
                title="Tangkapan Layar: Toolbar Filter 2 Tingkat & Navigasi Halaman Penjualan"
                url="http://localhost:5173/transactions/sales"
                annotations={[
                  { label: "Pin 1 (Tab Transaksi)", desc: "Tab SO, SJ, dan RET (Faktur digabung di dalam SO agar hemat ruang)." },
                  { label: "Pin 2 (Aksi Utama)", desc: "Tombol Export DMS Excel dan tombol '+ Tambah Pesanan' untuk membuat SO baru." },
                  { label: "Pin 3 (Dedicated Filter Baris 2)", desc: "Pencarian instan toko/no SO, status pesanan, pembayaran, pajak, dan salesman." },
                  { label: "Pin 4 (Reset Filter 1-Klik)", desc: "Mengembalikan seluruh filter ke kondisi semula saat daftar pesanan kosong." }
                ]}
              >
                <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs space-y-2.5 text-xs select-none">
                  {/* Mockup Baris 1 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                    <div className="relative flex items-center gap-1.5">
                      <span className="absolute -top-2.5 -left-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">1</span>
                      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                        <span className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-bold text-[11px] shadow-xs flex items-center gap-1">
                          <span>SO (Sales Order)</span>
                          <span className="px-1 py-0.2 bg-indigo-700 rounded-full text-[9px]">48</span>
                        </span>
                        <span className="px-2.5 py-1 rounded-md text-zinc-600 hover:text-zinc-900 font-semibold text-[11px]">
                          SJ (Surat Jalan)
                        </span>
                        <span className="px-2.5 py-1 rounded-md text-zinc-600 hover:text-zinc-900 font-semibold text-[11px]">
                          RET (Retur)
                        </span>
                      </div>
                    </div>

                    <div className="relative flex items-center gap-1.5">
                      <span className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">2</span>
                      <span className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 font-bold text-[11px] flex items-center gap-1">
                        <FileText size={12} className="text-emerald-600" />
                        <span>Export DMS</span>
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] shadow-xs flex items-center gap-1">
                        <span>+ Tambah Pesanan</span>
                      </span>
                    </div>
                  </div>

                  {/* Mockup Baris 2 Toolbar Filter */}
                  <div className="relative flex flex-wrap items-center gap-2 p-2 bg-zinc-50/90 rounded-lg border border-zinc-200">
                    <span className="absolute -top-2 left-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">3</span>
                    <div className="flex-1 min-w-[160px] relative">
                      <input
                        type="text"
                        readOnly
                        value="Cari Toko Berkah / SO-2026..."
                        className="w-full pl-6 pr-2 py-1 text-[11px] bg-white border border-zinc-200 rounded-md text-zinc-700 font-medium"
                      />
                      <Search size={11} className="absolute left-2 top-1.5 text-zinc-400" />
                    </div>

                    <div className="px-2 py-1 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 font-medium flex items-center gap-1">
                      <span>Status: Semua</span>
                      <ChevronDown size={11} className="text-zinc-400" />
                    </div>

                    <div className="px-2 py-1 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 font-medium flex items-center gap-1">
                      <span>Bayar: Semua</span>
                      <ChevronDown size={11} className="text-zinc-400" />
                    </div>

                    <div className="px-2 py-1 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 font-medium flex items-center gap-1">
                      <span>Pajak: PKP</span>
                      <ChevronDown size={11} className="text-zinc-400" />
                    </div>

                    <div className="px-2 py-1 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 font-medium flex items-center gap-1">
                      <span>Sales: Budi</span>
                      <ChevronDown size={11} className="text-zinc-400" />
                    </div>

                    {/* Reset Button Pin 4 */}
                    <div className="relative ml-auto">
                      <span className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">4</span>
                      <span className="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-[11px] font-bold flex items-center gap-1">
                        <RotateCcw size={11} />
                        <span>Reset Filter</span>
                      </span>
                    </div>
                  </div>

                  {/* Mockup Mini Row Transaksi */}
                  <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white text-[11px]">
                    <div className="bg-zinc-100/80 px-3 py-1.5 text-zinc-500 font-bold uppercase text-[9px] grid grid-cols-6 gap-2">
                      <span>No. SO</span>
                      <span className="col-span-2">Pelanggan</span>
                      <span>Total (Rp)</span>
                      <span>Status Order</span>
                      <span className="text-right">Aksi</span>
                    </div>
                    <div className="px-3 py-2 grid grid-cols-6 gap-2 items-center hover:bg-zinc-50 border-t border-zinc-100">
                      <span className="font-bold text-indigo-700">SO-2026-09-0012</span>
                      <span className="col-span-2 font-medium text-zinc-800">TOKO BERKAH ABADI (Bumijawa)</span>
                      <span className="font-bold text-zinc-900">Rp 14.500.000</span>
                      <span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                          DIPROSES
                        </span>
                      </span>
                      <div className="flex items-center justify-end gap-1 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 font-semibold border border-zinc-200">
                          Faktur
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                          Detail
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </ScreenshotMockup>
            </div>

            {/* Step 2.2 Modal SO Baru (Split-Scroll Mandiri) */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-black flex items-center justify-center">B</span>
                <h3 className="text-sm font-black text-zinc-900">Membuat Pesanan Baru (Layout Split-Scroll & Skema Dokumen)</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-zinc-700 pl-1 leading-relaxed">
                <li>Klik tombol <strong>+ Tambah Pesanan</strong> di kanan atas halaman Transaksi.</li>
                <li><strong>Sisi Kiri (Informasi Transaksi - Scroll Mandiri):</strong> Pilih Pelanggan (Customer), Gudang Asal, Tanggal, dan Sales Person penanggung jawab.</li>
                <li><strong>Skema Dokumen Penjualan (🟢 PKP vs ⚪ Non-PKP):</strong> Kini diletakkan <strong>tepat di bawah Sales Person</strong> di luar menu tambahan sehingga langsung dapat dipilih tanpa perlu membuka accordion.</li>
                <li><strong>Sisi Kanan (Daftar Item Barang - Scroll Mandiri):</strong> Tambahkan item produk, tentukan Qty, diskon, dan bonus gratis. Area tabel produk dapat digulir sendiri tanpa menggeser kolom header kiri.</li>
                <li><strong>Ringkasan Totalan 1 Layar:</strong> Kotak perhitungan total (Bruto, Diskon, DPP, PPN, dan Grand Total) selalu terkunci di layar bagian bawah sehingga staf tidak perlu melakukan scroll untuk melihat total tagihan!</li>
              </ol>

              {/* SCREENSHOT MOCKUP 02: Modal SO Baru Split-Scroll */}
              <ScreenshotMockup
                title="Tangkapan Layar: Form Modal Sales Order Baru (Split-Scroll 2 Kolom & Skema Dokumen)"
                url="http://localhost:5173/transactions/sales/modal-new-so"
                annotations={[
                  { label: "Pin 1 (Skema Dokumen di Bawah Sales)", desc: "Pilihan 🟢 Jalur PKP vs ⚪ Non-PKP langsung terlihat di bawah Sales Person tanpa membuka menu tambahan." },
                  { label: "Pin 2 (Ringkasan Totalan 1 Layar)", desc: "Grand total, DPP, PPN 11% Termasuk, dan tombol Simpan selalu terkunci di layar tanpa perlu scroll." },
                  { label: "Pin 3 (Split Scroll Mandiri)", desc: "Kolom kiri (Header) dan kolom kanan (Daftar Barang) memiliki area gulir tersendiri yang terpisah." }
                ]}
              >
                <div className="bg-white rounded-xl border border-zinc-200 shadow-md p-3.5 space-y-3 select-none text-xs">
                  {/* Modal Header Mockup */}
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-black text-zinc-900 text-xs">Buat Pesanan Penjualan Baru (Sales Order)</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">ESC untuk Tutup</span>
                  </div>

                  {/* 2 Kolom Split Screen */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    {/* Kolom Kiri: Header Transaksi */}
                    <div className="md:col-span-5 bg-zinc-50/80 p-2.5 rounded-lg border border-zinc-200 space-y-2 relative">
                      <span className="absolute -top-2.5 -left-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">3</span>
                      <div className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider">Informasi Transaksi</div>
                      
                      <div>
                        <label className="text-[10px] font-bold text-zinc-600">Pelanggan Toko</label>
                        <div className="p-1.5 bg-white border border-zinc-200 rounded text-zinc-800 font-semibold text-[11px]">
                          TOKO BERKAH ABADI (C-0029)
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-600">Gudang Asal</label>
                          <div className="p-1.5 bg-white border border-zinc-200 rounded text-zinc-800 text-[10px]">
                            Gudang Utama
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-600">Termin (TOP)</label>
                          <div className="p-1.5 bg-white border border-zinc-200 rounded text-zinc-800 text-[10px]">
                            30 Hari (Tempo)
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-600">Sales Person</label>
                        <div className="p-1.5 bg-white border border-zinc-200 rounded text-zinc-800 font-semibold text-[11px]">
                          Budi Santoso (Rute Slawi - Bumijawa)
                        </div>
                      </div>

                      {/* Pin 1: Skema Dokumen Penjualan */}
                      <div className="relative p-2 rounded-lg bg-emerald-50/80 border border-emerald-300">
                        <span className="absolute -top-2 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">1</span>
                        <div className="text-[10px] font-black text-emerald-950 uppercase flex items-center gap-1 mb-1">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>Skema Dokumen Penjualan</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div className="py-1 px-2 rounded bg-emerald-600 text-white font-bold text-[10px] text-center shadow-xs flex items-center justify-center gap-1">
                            <Check size={11} />
                            <span>🟢 Jalur PKP</span>
                          </div>
                          <div className="py-1 px-2 rounded bg-white text-zinc-600 font-semibold text-[10px] text-center border border-zinc-200">
                            <span>⚪ Non-PKP</span>
                          </div>
                        </div>
                        <div className="text-[9px] text-emerald-800 mt-1">
                          Harga sudah termasuk PPN 11% (Tax Inclusive). DPP & PPN dihitung otomatis.
                        </div>
                      </div>
                    </div>

                    {/* Kolom Kanan: Daftar Barang & Sticky Totalan */}
                    <div className="md:col-span-7 space-y-2.5 flex flex-col justify-between">
                      {/* Tabel Barang Mini */}
                      <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
                        <div className="bg-zinc-100 px-2.5 py-1.5 font-bold text-[10px] text-zinc-600 grid grid-cols-12 gap-1">
                          <span className="col-span-5">Produk</span>
                          <span className="col-span-2 text-center">Qty</span>
                          <span className="col-span-2 text-center">Disc</span>
                          <span className="col-span-3 text-right">Subtotal</span>
                        </div>
                        <div className="p-2 border-t border-zinc-100 grid grid-cols-12 gap-1 items-center text-[10px]">
                          <div className="col-span-5 font-bold text-zinc-800">
                            <div>INDOMIE GORENG SPESIAL</div>
                            <div className="text-[9px] text-zinc-400 font-normal">Karton / Dus (40 Pcs)</div>
                          </div>
                          <div className="col-span-2 text-center font-bold">50 Dus</div>
                          <div className="col-span-2 text-center text-rose-600 font-semibold">5+2%</div>
                          <div className="col-span-3 text-right font-black text-zinc-900">Rp 5.390.000</div>
                        </div>
                        <div className="p-2 border-t border-zinc-100 grid grid-cols-12 gap-1 items-center text-[10px] bg-emerald-50/30">
                          <div className="col-span-5 font-bold text-zinc-800">
                            <div>MINYAK GORENG BIMOLI 2L</div>
                            <div className="text-[9px] text-emerald-700 font-semibold">+ Free Bonus 1 Dus</div>
                          </div>
                          <div className="col-span-2 text-center font-bold">20 Dus</div>
                          <div className="col-span-2 text-center text-zinc-400">-</div>
                          <div className="col-span-3 text-right font-black text-zinc-900">Rp 2.110.000</div>
                        </div>
                      </div>

                      {/* Pin 2: Sticky Footer Totalan 1 Layar */}
                      <div className="relative p-2.5 rounded-lg bg-indigo-50/90 border border-indigo-200 space-y-1.5">
                        <span className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">2</span>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <span className="text-zinc-500">Nilai Bruto:</span>
                            <div className="font-bold text-zinc-800">Rp 7.875.000</div>
                          </div>
                          <div>
                            <span className="text-zinc-500">DPP Penjualan:</span>
                            <div className="font-bold text-indigo-700">Rp 6.756.757</div>
                          </div>
                          <div className="text-right">
                            <span className="text-zinc-500">PPN (11% Inc):</span>
                            <div className="font-bold text-emerald-700">Rp 743.243</div>
                          </div>
                        </div>

                        <div className="border-t border-indigo-200/80 pt-1.5 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-indigo-900 tracking-wider">Total Tagihan (SO):</span>
                            <div className="text-sm font-black text-indigo-950">Rp 7.500.000</div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded bg-zinc-200 text-zinc-700 font-bold text-[10px]">Batal</span>
                            <span className="px-3.5 py-1 rounded bg-indigo-600 text-white font-black text-[10px] shadow-sm">
                              Simpan Pesanan
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScreenshotMockup>
            </div>

            {/* Step 2.3 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-black flex items-center justify-center">C</span>
                <h3 className="text-sm font-black text-zinc-900">Multi-Satuan, Diskon & Barang Bonus (Free Goods)</h3>
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Multi-Satuan Fleksibel:</strong> Anda dapat menjual dalam satuan besar (<em>Karton/Box</em>) maupun satuan eceran (<em>Pack/Pcs</em>). Nilai harga jual otomatis dikalikan rasio konversi unit secara akurat.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Diskon per Item:</strong> Masukkan diskon potongan harga per barang (berupa nominal rupiah atau format bertingkat seperti <code>5+2%</code>).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Kuantitas Bonus (Free Goods):</strong> Jika terdapat promo (misal: <em>Beli 10 Karton Gratis 1 Pack</em>), isi kolom <strong>Qty Bonus</strong> dan pilih unit bonusnya. Sistem akan mengecek ketersediaan stok bonus gudang secara otomatis.</span>
                </li>
              </ul>
            </div>

            {/* Step 2.4 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-black flex items-center justify-center">D</span>
                <h3 className="text-sm font-black text-zinc-900">Pilihan: Auto Buat Surat Jalan vs Order Bertahap</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 text-emerald-950 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 size={14} />
                    <span>Centang "Auto Buat Surat Jalan" (Rekomendasi Kirim Langsung)</span>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    Sistem otomatis menerbitkan Surat Jalan, memotong stok fisik gudang saat itu juga, dan mencatat mutasi kartu stok keluar. Cocok untuk toko yang langsung berangkat hari ini.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-zinc-100/80 border border-zinc-200 text-zinc-800 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5 text-zinc-700">
                    <Info size={14} />
                    <span>Tidak Dicentang (Untuk Booking / Plotting Manifest Nanti)</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Status pesanan tersimpan sebagai <code>CONFIRMED</code>. Stok fisik belum terpotong sampai pesanan dimasukkan ke dalam jadwal pengiriman Manifest Driver.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2.5 Detail SO & Form Retur Kosongan */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-black flex items-center justify-center">E</span>
                <h3 className="text-sm font-black text-zinc-900">Detail SO, Form Retur Kosongan & Format Kuantitas Bersih</h3>
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-700 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Modal Detail SO 2 Kolom:</strong> Kolom kiri menampilkan ringkasan toko, status, salesman, dan badge skema dokumen; kolom kanan menampilkan tabel rincian item barang; footer ringkasan keuangan terkunci di layar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Form Retur Kosongan (A4):</strong> Klik tombol <em>Form Retur Kosongan</em> di header detail SO untuk mencetak form bergaris kosong bagi supir armada agar toko dapat mencatat fisik barang yang ditolak di tempat.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Pencatatan Retur & Format Kuantitas Bersih:</strong> Kuantitas retur ditampilkan rapi (misal: <code>10 pcs</code>, bukan desimal <code>10.000</code>). Barang rusak masuk gudang BS dan barang baik masuk stok aktif.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                  <span><strong>Cetak Faktur Continuous Form (9.5"x5.5"):</strong> Format cetak presisi pas 1 lembar untuk printer dot matrix (Epson LX-310/LQ-310).</span>
                </li>
              </ul>

              {/* SCREENSHOT MOCKUP 03: Modal Detail SO & Form Retur Kosongan */}
              <ScreenshotMockup
                title="Tangkapan Layar: Modal Detail Sales Order, Tombol Retur Kosongan & Kuantitas Bersih"
                url="http://localhost:5173/transactions/sales/modal-detail-so"
                annotations={[
                  { label: "Pin 1 (Tombol Aksi Header)", desc: "Tombol 'Form Retur Kosongan' untuk mencetak lembar kosong supir, 'Cetak Faktur', dan 'Revisi Pesanan'." },
                  { label: "Pin 2 (Format Kuantitas Bersih)", desc: "Kuantitas retur ditampilkan natural (contoh: 10 pcs, bukan desimal panjang 10.000)." },
                  { label: "Pin 3 (Badge Skema Dokumen)", desc: "Menampilkan status pajak 🟢 JALUR PKP atau ⚪ REGULER secara transparan." }
                ]}
              >
                <div className="bg-white rounded-xl border border-zinc-200 shadow-md p-3.5 space-y-3 select-none text-xs">
                  {/* Header Detail SO */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2.5">
                    <div className="relative flex items-center gap-2">
                      <span className="absolute -top-2.5 -left-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">3</span>
                      <span className="font-black text-zinc-900 text-sm">SO-2026-09-0012</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        🟢 JALUR PKP
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                        DIPROSES
                      </span>
                    </div>

                    {/* Tombol Aksi Header Pin 1 */}
                    <div className="relative flex flex-wrap items-center gap-1.5">
                      <span className="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">1</span>
                      <span className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-[10px] border border-zinc-300 flex items-center gap-1">
                        <Printer size={11} />
                        <span>Faktur (Dot Matrix)</span>
                      </span>
                      <span className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-[10px] border border-zinc-300 flex items-center gap-1">
                        <Truck size={11} />
                        <span>Surat Jalan</span>
                      </span>
                      <span className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 font-black text-[10px] border border-amber-300 shadow-xs flex items-center gap-1">
                        <FileText size={11} className="text-amber-700" />
                        <span>Form Retur Kosongan</span>
                      </span>
                      <span className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                        Revisi Pesanan
                      </span>
                    </div>
                  </div>

                  {/* Body Detail Mini */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    <div className="md:col-span-5 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-[11px] space-y-1.5">
                      <div className="font-bold text-zinc-800">TOKO BERKAH ABADI</div>
                      <div className="text-[10px] text-zinc-500">Jl. Raya Bumijawa No. 18, Tegal</div>
                      <div className="text-[10px] text-zinc-600">Salesman: <strong>Budi Santoso</strong> | TOP: <strong>30 Hari</strong></div>
                    </div>

                    <div className="md:col-span-7 bg-rose-50/60 p-2.5 rounded-lg border border-rose-200 relative text-[11px] space-y-1.5">
                      <span className="absolute -top-2 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">2</span>
                      <div className="font-bold text-rose-950 flex items-center justify-between">
                        <span>Riwayat Retur Penjualan (Tolak Toko)</span>
                        <span className="text-[10px] font-normal text-rose-700">RET-2026-09-0004</span>
                      </div>
                      <div className="bg-white p-2 rounded border border-rose-200 flex items-center justify-between text-[11px]">
                        <div>
                          <div className="font-bold text-zinc-900">INDOMIE GORENG SPESIAL</div>
                          <div className="text-[10px] text-rose-700 font-semibold">Rusak / Bocor Kardus di Truk</div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-xs">
                            10 pcs
                          </span>
                          <div className="text-[9px] text-zinc-400 mt-0.5">Bukan 10.000</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScreenshotMockup>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: PURCHASE ORDER MODULE */}
      {(activeCategory === 'ALL' || activeCategory === 'PURCHASE') && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
                <Package size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-900">Modul 2: Purchase Order (Pembelian / Restok Supplier)</h2>
                <p className="text-xs text-zinc-500">Menu: <strong>Transaksi ➔ Pembelian (Purchase)</strong> atau klik tombol pintas di bawah</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/transactions/purchases')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition-colors cursor-pointer w-fit"
            >
              <span>Buka Menu Purchase</span>
              <ExternalLink size={13} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Step 3.1 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">A</span>
                <h3 className="text-sm font-black text-zinc-900">Membuat Purchase Order Baru ke Supplier</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-zinc-700 pl-1 leading-relaxed">
                <li>Klik tombol <strong>+ Tambah Purchase Order</strong> di modul Pembelian.</li>
                <li><strong>Pilih Supplier:</strong> Pilih nama pabrik/pemasok asal barang (contoh: <em>PT INDOFOOD CBP</em>).</li>
                <li><strong>Pilih Gudang Penerimaan:</strong> Tentukan gudang tempat membongkar muatan saat barang tiba.</li>
                <li><strong>Input Rincian Barang:</strong> Masukkan kuantiti pesanan, harga beli (HPP), diskon dari supplier, serta bonus barang pabrik jika ada.</li>
                <li>Klik <strong>Simpan Purchase Order</strong>. Dokumen berstatus <code>ORDERED</code> (Stok belum bertambah sampai muatan tiba).</li>
              </ol>
            </div>

            {/* Step 3.2 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">B</span>
                <h3 className="text-sm font-black text-zinc-900">Penerimaan Barang Fisik (Goods Receipt)</h3>
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                Ketika truk ekspedisi supplier tiba di gudang dan barang selesai dihitung:
              </p>
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-2">
                <div className="font-extrabold flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-blue-700" />
                  <span>Langkah Konfirmasi Penerimaan:</span>
                </div>
                <p>1. Buka nomor PO terkait ➔ Klik tombol <strong>Terima Barang</strong>.</p>
                <p>2. Cocokkan fisik barang dengan Surat Jalan dari supplier, lalu klik <strong>Konfirmasi Penerimaan</strong>.</p>
                <div className="pt-2 border-t border-blue-200 text-[11px] text-blue-900 space-y-1">
                  <p><strong>✨ Efek Otomatis di Sistem:</strong></p>
                  <p>• Stok fisik gudang langsung bertambah.</p>
                  <p>• Batch persediaan FIFO (First-In, First-Out) otomatis dibuat dengan nilai HPP yang presisi.</p>
                  <p>• Kartu Stok mencatat riwayat mutasi <strong>MASUK (IN)</strong>.</p>
                  <p>• Tagihan Hutang Usaha otomatis tercatat di modul Keuangan.</p>
                </div>
              </div>
            </div>

            {/* Step 3.3 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">C</span>
                <h3 className="text-sm font-black text-zinc-900">Cetak Dokumen PO untuk Dikirim ke Supplier</h3>
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                Gunakan tombol <strong>Cetak PO</strong> untuk mengunduh format lembar PO resmi perusahaan untuk dikirimkan via WhatsApp / Email kepada Sales Manager Supplier.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: DELIVERY MANIFEST MODULE */}
      {(activeCategory === 'ALL' || activeCategory === 'MANIFEST') && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-900">Modul 3: Manifest Pengiriman (Logistik Driver & Armada)</h2>
                <p className="text-xs text-zinc-500">Menu: <strong>Transaksi ➔ Manifest Pengiriman</strong> atau klik tombol pintas di bawah</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/delivery-manifest')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer w-fit"
            >
              <span>Buka Manifest Driver</span>
              <ExternalLink size={13} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Step 4.1 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">A</span>
                <h3 className="text-sm font-black text-zinc-900">Pengertian & Fungsi Manifest Pengiriman</h3>
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                <strong>Manifest Pengiriman</strong> adalah lembar operasional gabungan untuk menugaskan <strong>1 Driver & 1 Mobil Armada</strong> membawa <strong>puluhan Surat Jalan toko</strong> dalam 1 rute perjalanan harian. Hal ini mempermudah kuli gudang dalam menaikkan total barang dan mempermudah supir memverifikasi rute toko.
              </p>
            </div>

            {/* Step 4.2 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">B</span>
                <h3 className="text-sm font-black text-zinc-900">Membuat Manifest Baru (Plotting Supir & Toko)</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-zinc-700 pl-1 leading-relaxed">
                <li>Buka menu <strong>Manifest Pengiriman</strong> ➔ Klik <strong>+ Buat Manifest Baru</strong>.</li>
                <li><strong>Pilih Armada & Driver:</strong> Pilih supir (misal: <em>SLAMET</em>), masukkan nomor plat mobil (misal: <em>G 8492 BZ</em>), dan tanggal keberangkatan.</li>
                <li><strong>Centang Toko yang Dikirim:</strong> Berikan tanda centang <code>[✓]</code> pada daftar Sales Order yang searah dengan jalur supir tersebut.</li>
                <li>Klik <strong>Simpan Manifest</strong>.</li>
              </ol>
            </div>

            {/* Step 4.3 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">C</span>
                <h3 className="text-sm font-black text-zinc-900">Cetak 2 Lembar Dokumen Manifest</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-zinc-100 rounded-lg border border-zinc-200 space-y-1">
                  <span className="font-extrabold text-zinc-900">1. Loading Sheet (Kuli / Gudang)</span>
                  <p className="text-zinc-600 text-[11px]">
                    Rekap total seluruh jenis barang yang harus dinaikkan ke bak truk (contoh: <em>Total 150 Dus Mie, 80 Dus Kecap, 25 Dus Saos</em>).
                  </p>
                </div>
                <div className="p-3 bg-zinc-100 rounded-lg border border-zinc-200 space-y-1">
                  <span className="font-extrabold text-zinc-900">2. Run Sheet Supir (Daftar Rute Toko)</span>
                  <p className="text-zinc-600 text-[11px]">
                    Urutan kunjungan toko pelanggan lengkap dengan alamat, nomor telepon toko, nomor faktur, serta nominal tagihan COD / Tempo.
                  </p>
                </div>
              </div>

              {/* SCREENSHOT MOCKUP 04: Manifest Driver & Rekap Loading */}
              <ScreenshotMockup
                title="Tangkapan Layar: Dokumen Cetak Manifest Driver & Loading Sheet Muatan Gudang"
                url="http://localhost:5173/delivery-manifest/print-preview"
                annotations={[
                  { label: "Pin 1 (Header Armada & Supir)", desc: "Menampilkan nama driver (Slamet), plat truk (G 8492 BZ), dan rute Bumijawa." },
                  { label: "Pin 2 (Rekap SKU Loading Sheet)", desc: "Daftar total koli/karton per item produk untuk memudahkan kuli menaikkan barang." },
                  { label: "Pin 3 (Daftar Toko & Kolom Tanda Tangan)", desc: "Rute toko berurutan lengkap dengan status pembayaran dan tanda terima toko." }
                ]}
              >
                <div className="bg-white rounded-xl border border-zinc-200 p-3 shadow-xs space-y-2.5 text-xs select-none">
                  {/* Header Cetak Manifest Mini */}
                  <div className="border-b border-zinc-200 pb-2 flex items-center justify-between">
                    <div className="relative flex items-center gap-2">
                      <span className="absolute -top-2.5 -left-2 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">1</span>
                      <div>
                        <div className="font-black text-zinc-900 text-xs">LEMBAR MANIFEST PENGIRIMAN & MUATAN TRUK</div>
                        <div className="text-[10px] text-zinc-500">CV. JATIMAS | Driver: <strong>SLAMET</strong> | Plat: <strong>G 8492 BZ</strong></div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                      SIAP BERANGKAT
                    </span>
                  </div>

                  {/* 2 Kolom: Rekap SKU & Rute Toko */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    {/* Rekap Muatan Truk */}
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200 space-y-1 relative">
                      <span className="absolute -top-2 -left-1.5 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">2</span>
                      <div className="font-bold text-zinc-800 text-[10px] uppercase text-zinc-500">Rekap Muatan Gudang (Loading Sheet)</div>
                      <div className="space-y-1">
                        <div className="flex justify-between bg-white px-2 py-1 rounded border border-zinc-100">
                          <span>Indomie Goreng Spesial</span>
                          <span className="font-black text-zinc-900">70 Dus</span>
                        </div>
                        <div className="flex justify-between bg-white px-2 py-1 rounded border border-zinc-100">
                          <span>Minyak Goreng Bimoli 2L</span>
                          <span className="font-black text-zinc-900">30 Dus</span>
                        </div>
                      </div>
                    </div>

                    {/* Urutan Kunjungan Toko */}
                    <div className="bg-zinc-50 p-2 rounded-lg border border-zinc-200 space-y-1 relative">
                      <span className="absolute -top-2 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs z-10">3</span>
                      <div className="font-bold text-zinc-800 text-[10px] uppercase text-zinc-500">Daftar Rute Kunjungan Toko</div>
                      <div className="space-y-1">
                        <div className="bg-white px-2 py-1 rounded border border-zinc-100 flex justify-between items-center">
                          <span>1. Toko Berkah Abadi</span>
                          <span className="font-semibold text-amber-700 text-[10px]">Tempo 30H</span>
                        </div>
                        <div className="bg-white px-2 py-1 rounded border border-zinc-100 flex justify-between items-center">
                          <span>2. Toko Sumber Rejeki</span>
                          <span className="font-semibold text-emerald-700 text-[10px]">Tunai / COD</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScreenshotMockup>
            </div>

            {/* Step 4.4 */}
            <div className="p-4 rounded-xl border border-zinc-200/90 bg-zinc-50/50 hover:bg-white transition-all space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center">D</span>
                <h3 className="text-sm font-black text-zinc-900">Konfirmasi Pengiriman Selesai</h3>
              </div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                Saat supir kembali ke kantor: Klik tombol <strong>Selesaikan Manifest</strong>. Masukkan catatan bukti tanda terima toko. Status seluruh order toko otomatis diperbarui menjadi <code>DELIVERED</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: SOP & FIELD CASES */}
      {(activeCategory === 'ALL' || activeCategory === 'SOP') && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-bold">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-900">Standar Operasional Prosedur (SOP) & Kasus Lapangan</h2>
              <p className="text-xs text-zinc-500">Pedoman tindakan cepat jika terjadi kendala operasional sehari-hari</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-zinc-200 rounded-xl overflow-hidden">
              <thead className="bg-zinc-100/80 text-zinc-700 font-black uppercase text-[10px] tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="p-3.5 w-12 text-center">No</th>
                  <th className="p-3.5 w-1/3">Kondisi / Kasus di Lapangan</th>
                  <th className="p-3.5">Tindakan Staff yang Tepat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                <tr className="hover:bg-zinc-50/80 transition-colors">
                  <td className="p-3.5 text-center font-bold text-zinc-500">1</td>
                  <td className="p-3.5 font-bold text-zinc-900">
                    Toko minta tambah atau kurangi barang saat truk sudah sampai
                  </td>
                  <td className="p-3.5 leading-relaxed">
                    Buka detail Sales Order ➔ Klik <strong>Revisi Pesanan</strong> ➔ Sesuaikan kuantiti barang yang diinginkan toko ➔ Cetak ulang faktur revisi. Stok gudang dan tagihan otomatis sinkron.
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/80 transition-colors">
                  <td className="p-3.5 text-center font-bold text-zinc-500">2</td>
                  <td className="p-3.5 font-bold text-zinc-900">
                    Toko menolak 1 jenis barang / Barang rusak saat dikirim (Retur)
                  </td>
                  <td className="p-3.5 leading-relaxed">
                    Bawakan <strong>Form Retur Kosongan</strong> dari header Detail SO untuk supir sebelum jalan. Ketika barang kembali, catat kuantitas dan alasan pada panel <strong>Retur Penjualan</strong>. Nilai tagihan faktur akan otomatis berkurang dan barang yang dikembalikan masuk ke pencatatan stok retur dengan format kuantitas bersih (tanpa desimal nol).
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/80 transition-colors">
                  <td className="p-3.5 text-center font-bold text-zinc-500">3</td>
                  <td className="p-3.5 font-bold text-zinc-900">
                    Daftar pesanan tidak muncul / kosong di tabel transaksi
                  </td>
                  <td className="p-3.5 leading-relaxed">
                    Periksa baris filter di bawah tab transaksi. Jika ada filter status, salesman, atau tipe pajak yang tidak sesuai, klik <strong>Reset Filter</strong> di ujung kanan toolbar untuk menampilkan seluruh data kembali.
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/80 transition-colors">
                  <td className="p-3.5 text-center font-bold text-zinc-500">4</td>
                  <td className="p-3.5 font-bold text-zinc-900">
                    Ada angka merah / kuning (Badge Notifikasi) di menu sidebar
                  </td>
                  <td className="p-3.5 leading-relaxed">
                    Angka tersebut menunjukkan transaksi yang masih menunggu tindakan (misal PO belum diterima, SO belum dikirim, atau stok di bawah minimum). Pastikan dicek dan diproses setiap hari kerja.
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/80 transition-colors">
                  <td className="p-3.5 text-center font-bold text-zinc-500">5</td>
                  <td className="p-3.5 font-bold text-zinc-900">
                    Aplikasi tiba-tiba keluar ke halaman Login (Sesi Berakhir)
                  </td>
                  <td className="p-3.5 leading-relaxed">
                    Sistem CoreSync menerapkan <em>Keamanan Single-Device</em>. Jika akun yang sama digunakan login di HP atau laptop lain, sesi sebelumnya otomatis ditutup. Silakan login kembali jika ingin aktif di perangkat saat ini.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 6: FAQ & SHORTCUTS */}
      {(activeCategory === 'ALL' || activeCategory === 'FAQ') && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold">
              <HelpCircle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-900">Pertanyaan yang Sering Diajukan (FAQ)</h2>
              <p className="text-xs text-zinc-500">Pertanyaan umum seputar fitur & operasional CoreSync ERP</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* FAQ 1 */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('faq-1')}
                className="w-full flex items-center justify-between p-4 bg-zinc-50/80 hover:bg-zinc-100 text-left transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                  <HelpCircle size={15} className="text-indigo-600 shrink-0" />
                  Bagaimana jika stok barang di gudang tertulis 0 saat ingin membuat Sales Order?
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 transition-transform duration-200 ${expandedSection === 'faq-1' ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === 'faq-1' && (
                <div className="p-4 bg-white text-xs text-zinc-700 border-t border-zinc-100 leading-relaxed space-y-2">
                  <p>
                    Periksa apakah sudah dilakukan <strong>Penerimaan Barang</strong> pada Purchase Order supplier terkait, atau cek apakah ada transaksi <strong>Stock Opname</strong> yang belum difinalisasi. Jika barang fisik memang sudah ada di gudang, pastikan admin gudang telah mencatat penerimaan barangnya terlebih dahulu.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 2 */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('faq-2')}
                className="w-full flex items-center justify-between p-4 bg-zinc-50/80 hover:bg-zinc-100 text-left transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                  <HelpCircle size={15} className="text-indigo-600 shrink-0" />
                  Apakah bisa membatalkan transaksi yang salah input?
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 transition-transform duration-200 ${expandedSection === 'faq-2' ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === 'faq-2' && (
                <div className="p-4 bg-white text-xs text-zinc-700 border-t border-zinc-100 leading-relaxed space-y-2">
                  <p>
                    Bisa. Buka detail transaksi yang bersangkutan lalu klik tombol <strong>Batalkan Transaksi</strong>. Sistem akan mengembalikan seluruh stok barang ke gudang asal dan membatalkan alokasi pesanan secara otomatis.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 3 */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('faq-3')}
                className="w-full flex items-center justify-between p-4 bg-zinc-50/80 hover:bg-zinc-100 text-left transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                  <HelpCircle size={15} className="text-indigo-600 shrink-0" />
                  Bagaimana cara mengetahui posisi rute dan total muatan supir hari ini?
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 transition-transform duration-200 ${expandedSection === 'faq-3' ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === 'faq-3' && (
                <div className="p-4 bg-white text-xs text-zinc-700 border-t border-zinc-100 leading-relaxed space-y-2">
                  <p>
                    Buka menu <strong>Manifest Pengiriman</strong> ➔ Pilih nomor manifest supir hari ini ➔ Klik <strong>Cetak Manifest Gabungan</strong>. Di sana tertera rincian nama supir, plat armada, total kardus yang dimuat, serta urutan alamat toko yang harus dikunjungi.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 4 Skema Dokumen PKP */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('faq-4')}
                className="w-full flex items-center justify-between p-4 bg-zinc-50/80 hover:bg-zinc-100 text-left transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                  <HelpCircle size={15} className="text-indigo-600 shrink-0" />
                  Di mana letak pilihan Jalur PKP vs Non-PKP pada form Sales Order baru?
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 transition-transform duration-200 ${expandedSection === 'faq-4' ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === 'faq-4' && (
                <div className="p-4 bg-white text-xs text-zinc-700 border-t border-zinc-100 leading-relaxed space-y-2">
                  <p>
                    Pilihan Skema Dokumen Penjualan kini ditempatkan <strong>tepat di bawah pilihan Sales Person</strong> pada sisi kiri modal form pesanan baru (di luar menu tambahan). Anda dapat langsung mengklik tombol <strong>🟢 Jalur PKP</strong> atau <strong>⚪ Non-PKP</strong> tanpa perlu membuka accordion pengaturan tambahan.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 5 Form Retur Kosongan */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('faq-5')}
                className="w-full flex items-center justify-between p-4 bg-zinc-50/80 hover:bg-zinc-100 text-left transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                  <HelpCircle size={15} className="text-indigo-600 shrink-0" />
                  Bagaimana fungsi "Form Retur Kosongan" dan mengapa kuantitas tidak desimal (.000)?
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 transition-transform duration-200 ${expandedSection === 'faq-5' ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === 'faq-5' && (
                <div className="p-4 bg-white text-xs text-zinc-700 border-t border-zinc-100 leading-relaxed space-y-2">
                  <p>
                    <strong>Form Retur Kosongan</strong> dapat dicetak berstandar A4 dari header Detail Sales Order sebelum armada supir berangkat. Lembaran resmi ini memiliki garis-garis kosong tempat supir dan toko mencatat fisik barang yang ditolak di tempat lengkap dengan tanda tangan toko. Format kuantitas kini otomatis diformat bersih (misal: <code>10 pcs</code>, bukan <code>10.000</code>) agar tidak menimbulkan kerancuan pembacaan.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ 6 Ganti Tema & Password */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('faq-6')}
                className="w-full flex items-center justify-between p-4 bg-zinc-50/80 hover:bg-zinc-100 text-left transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                  <HelpCircle size={15} className="text-indigo-600 shrink-0" />
                  Bagaimana jika saya lupa password akun saya?
                </span>
                <ChevronDown
                  size={16}
                  className={`text-zinc-400 transition-transform duration-200 ${expandedSection === 'faq-6' ? 'rotate-180' : ''}`}
                />
              </button>
              {expandedSection === 'faq-6' && (
                <div className="p-4 bg-white text-xs text-zinc-700 border-t border-zinc-100 leading-relaxed space-y-2">
                  <p>
                    Jika Anda lupa password akun Anda, segera hubungi <strong>Super Admin</strong> atau <strong>Owner</strong> perusahaan. Super Admin dapat mereset password akun Anda melalui menu <em>Pengaturan ➔ Tab Pengguna</em>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer info & Contact */}
      <div className="text-center text-xs text-zinc-500 pt-4 border-t border-zinc-200/80 print:hidden">
        <p className="font-semibold text-zinc-700">CoreSync ERP • Panduan Resmi Operasional Staff CV. JATIMAS</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">Jika membutuhkan bantuan teknis tambahan, silakan hubungi Tim IT / Super Administrator.</p>
      </div>
    </div>
  );
};

export default Help;
