import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  User, Lock, BookOpen, Clock, FileText, Camera, MapPin, 
  CheckCircle, AlertCircle, Plus, ChevronLeft, LogOut, 
  Search, Calendar, Send, Info, Bell, X, ChevronRight,
  TrendingUp, Activity, Pencil, Trash2, Download, Printer, ArrowUpDown, Filter, Loader2,
  Sun, Moon,
  PhoneCallIcon
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { api, session, localDrafts, theme, pingServer } from './api';
import dosenData from './data/dosen.json';

// --- MOCK DATA & CONSTANTS (yang TIDAK datang dari server) ---
// Daftar ini dipakai sebagai fallback kalau getMasterData() belum selesai
// dimuat / gagal, supaya form tetap bisa diisi tanpa freeze.
const FAKULTAS_LIST_FALLBACK = [
  'Fakultas Keguruan dan Ilmu Pendidikan',
  'Fakultas Ilmu Sosial dan Ilmu Politik',
  'Fakultas Ekonomi dan Bisnis',
  'Fakultas Hukum',
  'Fakultas Pertanian',
  'Fakultas Teknik',
  'Fakultas Matematika dan Ilmu Pengetahuan Alam',
  'Fakultas Kehutanan',
  'Fakultas Peternakan dan Perikanan',
  'Fakultas Kesehatan Masyarakat',
  'Fakultas Kedokteran'
];
const PRODI_LIST_FALLBACK = [
  'Pendidikan Bahasa Indonesia', 'Pendidikan Bahasa Inggris', 'Bimbingan dan Konseling',
  'Pendidikan Guru Sekolah Dasar', 'Pendidikan Anak Usia Dini', 'Pendidikan Jasmani, Kesehatan dan Rekreasi',
  'Pendidikan Pancasila dan Kewarganegaraan', 'Pendidikan Sejarah', 'Pendidikan Geografi',
  'Pendidikan Fisika', 'Pendidikan Kimia', 'Pendidikan Matematika', 'Pendidikan Biologi',
  'MIPA', 'Pendidikan IPS', 'Ilmu Administrasi Publik', 'Ilmu Pemerintahan', 'Sosiologi',
  'Antropologi', 'Ilmu Komunikasi', 'Ilmu Ekonomi Pembangunan', 'Manajemen',
  'Akuntansi Sektor Publik', 'Akuntansi', 'Ilmu Hukum', 'Agroteknologi', 'Agribisnis',
  'Teknik Sipil', 'Arsitektur', 'Teknik Mesin', 'Teknik Rekayasa Kelistrikan',
  'Teknik Elektro', 'Teknik Informatika', 'Teknik Geologi', 'Perencanaan Wilayah dan Kota',
  'Sistem Informasi', 'Fisika', 'Matematika', 'Statistika', 'Kimia', 'Biologi', 'Farmasi',
  'Teknik Geofisika', 'Kehutanan', 'Konservasi Hutan', 'Pendidikan Dokter', 'Peternakan',
  'Akuakultur', 'Sumber Daya Akuatik', 'Kesehatan Masyarakat', 'Gizi'
];
const PROGRAM_LIST_FALLBACK = [
  'Kampus Mengajar Berdampak', 'Magang Berdampak', 'Studi Independen Berdampak', 
  'Pertukaran Mahasiswa Berdampak', 'Bina Desa Berdampak', 'Kewirausahaan Berdampak', 
  'Proyek Kemanusiaan Berdampak'
];
const KEGIATAN_DEFAULT = [
  'Pembekalan', 'Rapat Koordinasi', 'Observasi Lapangan', 'Pengembangan Sistem', 
  'Pelatihan', 'Evaluasi', 'Laporan Mingguan'
];

// --- UTILITIES ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const getWitaDateString = () => {
  const d = new Date();
  const witaTime = new Date(d.getTime() + (8 * 60 * 60 * 1000));
  const year = witaTime.getUTCFullYear();
  const month = String(witaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(witaTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const parseSafeDate = (dateString) => {
  if (!dateString) return new Date();

  const strDate = String(dateString);

  // Kalau ini string ISO dengan informasi timezone (ada 'T' dan/atau 'Z'),
  // geser dulu ke WITA (UTC+8) SEBELUM memotong bagian tanggalnya.
  // Spreadsheet/GAS sering mengirim Date sebagai ISO UTC, misal
  // "2026-06-22T16:00:00.000Z" yang sebenarnya = 23 Juni 2026 00:00 WITA.
  // Tanpa pergeseran ini, split('T')[0] akan mengambil tanggal UTC (22),
  // bukan tanggal WITA yang dimaksud (23) -> bug "mundur 1 hari".
  if (strDate.includes('T') && (strDate.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(strDate))) {
    const utcDate = new Date(strDate);
    if (!isNaN(utcDate.getTime())) {
      const witaTime = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
      return new Date(
        witaTime.getUTCFullYear(),
        witaTime.getUTCMonth(),
        witaTime.getUTCDate()
      );
    }
  }

  // 2. Bersihkan embel-embel jam/timezone untuk kasus string biasa
  // (misal: "2026-06-23 00:00:00" tanpa Z, atau sudah berupa date-only)
  const justDate = strDate.split('T')[0].split(' ')[0];

  // 3. Jika formatnya YYYY-MM-DD
  if (justDate.includes('-')) {
    const [y, m, d] = justDate.split('-');
    return new Date(y, m - 1, parseInt(d, 10));
  }

  // 4. Jika format dari Spreadsheet berubah jadi DD/MM/YYYY
  if (justDate.includes('/')) {
    const parts = justDate.split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }

  // 5. Fallback terakhir menggunakan bawaan JavaScript
  const fallbackDate = new Date(strDate);
  return isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate;
};
const formatDateForInput = (rawDate) => {
  if (!rawDate) return ''; // Biarkan kosong jika data memang belum ada
  
  // Gunakan fungsi parseSafeDate milik Anda yang sudah ada
  const d = parseSafeDate(rawDate);
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${day}`;
};
// Format tampilan tanggal ala Indonesia, contoh: "30 Juni 2026"
const formatDateIndo = (rawDate) => {
  if (!rawDate) return '-';
  const d = parseSafeDate(rawDate);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Versi pendek untuk kartu/list yang sempit, contoh: "30 Jun 2026"
const formatDateIndoShort = (rawDate) => {
  if (!rawDate) return '-';
  const d = parseSafeDate(rawDate);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
// Drive seringkali memblokir tag <img> langsung (CORS/X-Frame-Options).
// Konversi ke endpoint lh3.googleusercontent.com yang lebih permisif untuk
// preview gambar. Data URL (base64, belum diupload) dibiarkan apa adanya.
const getSafeImageUrl = (url) => {
  if (!url) return '';
  if (String(url).startsWith('data:')) return url;

  const driveRegex = /[-\w]{25,}/;
  const match = String(url).match(driveRegex);

  if (match && String(url).includes('drive.google')) {
    return `https://lh3.googleusercontent.com/d/${match[0]}`;
  }

  return url;
};

// Helper warna badge status logbook/laporan, dipakai di DashboardView,
// LogbookTableView, dan ReviewerView supaya konsisten di satu tempat.
const getStatusBadgeClass = (status) => {
  if (status === 'Disetujui')               return 'bg-emerald-100 text-emerald-700';
  if (status === 'Draf')                    return 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200';
  if (status === 'Revisi Mentor')           return 'bg-rose-100 text-rose-700';
  if (status === 'Revisi DPL')              return 'bg-orange-100 text-orange-700';
  if (status === 'Menunggu Persetujuan Mentor') return 'bg-amber-100 text-amber-700';
  if (status === 'Menunggu Persetujuan DPL')    return 'bg-indigo-100 text-indigo-700';
  return 'bg-slate-100 text-slate-500';
};

// --- COMPONENTS ---

// 1. Reusable UI Components
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300 w-11/12 max-w-sm pointer-events-none">
      <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-3 border border-slate-700/50 backdrop-blur-md">
        {type === 'success' ? <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" /> : <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />}
        <span className="leading-tight">{message}</span>
      </div>
    </div>
  );
};

// Spinner full-page, dipakai saat fetch data utama (profil/logbook/laporan)
// sedang berlangsung sehingga halaman belum bisa dirender.
const PageLoader = ({ label = 'Memuat data...' }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 h-full">
    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    <p className="mt-4 text-slate-500 dark:text-slate-400 font-bold text-sm tracking-widest uppercase text-center px-8">{label}</p>
  </div>
);

// Spinner kecil untuk dipasang di dalam button saat proses submit berjalan,
// supaya tombol tidak terlihat freeze/diam saat menunggu respon server.
const ButtonSpinner = ({ className = '' }) => (
  <Loader2 className={`w-5 h-5 animate-spin ${className}`} />
);

// Tombol toggle light/dark mode, dipasang di pojok beberapa halaman
// (Login, header Dashboard). Ikon berganti sesuai mode AKTIF saat ini
// (matahari = sedang gelap, tekan untuk terang; bulan = sedang terang,
// tekan untuk gelap) -- ikon menunjukkan tujuan tekan, bukan status saat ini.
const ThemeToggle = ({ mode, onToggle, className = '' }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={mode === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${className}`}
  >
    {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
  </button>
);

const Input = ({ label, type = "text", error, disabled, icon: Icon, ...props }) => (
  <div className="mb-4 relative">
    <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">{label}</label>
    <div className="relative">
      {Icon && <Icon className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500" />}
      <input 
        type={type} 
        disabled={disabled}
        className={`w-full p-3.5 ${Icon ? 'pl-11' : 'pl-4'} bg-slate-50 dark:bg-slate-900 border rounded-2xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-200 outline-none
        ${error ? 'border-rose-400 focus:ring-rose-500 bg-rose-50' : 'border-slate-200 dark:border-slate-600'} 
        ${disabled ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80 shadow-inner' : 'shadow-sm hover:border-slate-300'}`}
        {...props} 
      />
    </div>
    {error && <p className="text-rose-500 text-xs mt-1.5 ml-1 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</p>}
  </div>
);

const SearchableSelect = ({ label, options, value, onChange, placeholder, onAddCustom, clearOnSelect }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value !== undefined && value !== searchTerm && !isOpen) {
      setSearchTerm(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));
  const isExactMatch = options.some(opt => opt.toLowerCase() === searchTerm.toLowerCase());

  const handleSelect = (opt) => {
    onChange(opt);
    if (clearOnSelect) {
      setSearchTerm('');
    } else {
      setSearchTerm(opt);
    }
    setIsOpen(false);
  };

  const handleAddCustom = () => {
    if (searchTerm.trim() && onAddCustom) {
      onAddCustom(searchTerm.trim());
      onChange(searchTerm.trim());
      if (clearOnSelect) setSearchTerm('');
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      if (searchTerm.trim() && !isExactMatch && onAddCustom) {
        handleAddCustom();
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
    }
  };

  return (
    <div className="mb-4 relative" ref={wrapperRef}>
      <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          className="w-full p-3.5 pl-4 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-2xl shadow-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all outline-none"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <Search className="absolute right-4 top-3.5 text-slate-400 dark:text-slate-500 w-5 h-5 pointer-events-none" />
      </div>
      {isOpen && (
        <div className="absolute z-20 w-full mt-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl dark:shadow-slate-900/50 max-h-56 overflow-y-auto ring-1 ring-slate-900/5 dark:ring-white/5">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => (
              <div 
                key={i} 
                className="px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                onClick={() => handleSelect(opt)}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center italic">Tidak ada di referensi.</div>
          )}
          
          {searchTerm.trim() && !isExactMatch && onAddCustom && (
            <button 
              type="button"
              className="w-full p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex justify-center items-center gap-2 border-t border-indigo-100 dark:border-indigo-800/50"
              onClick={handleAddCustom}
            >
              <Plus className="w-4 h-4"/> Input "{searchTerm}" (Enter)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
// 2. Auth View
const LoginView = ({ onLogin, themeMode, onToggleTheme }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  // --- State form Login ---
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- State form Register ---
  const [regNim, setRegNim] = useState('');
  const [regNama, setRegNama] = useState('');
  const [regWa, setRegWa] = useState('62');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regError, setRegError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Warm-up GAS begitu LoginView pertama tampil -- mahasiswa biasanya
  // perlu beberapa detik untuk mengetik NIM & password, waktu itu cukup
  // untuk "memanaskan" instance GAS di belakang sebelum tombol Mulai
  // Sesi ditekan. Lihat catatan lengkap di pingServer (api.js).
  useEffect(() => {
    pingServer();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nim || !password) {
      setError('NIM dan Kata Sandi wajib diisi!');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const result = await api.login(nim.trim(), password);
      // result: { nim, nama }
      onLogin(result.nim, result.nama);
    } catch (err) {
      setError(err.message || 'NIM atau kata sandi salah.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateRegister = () => {
    if (!regNim.trim() || !regNama.trim() || !regPassword) {
      return 'NIM, Nama, dan Kata Sandi wajib diisi.';
    }
    if (regPassword.length < 6) {
      return 'Kata sandi minimal 6 karakter.';
    }
    if (regPassword !== regPasswordConfirm) {
      return 'Konfirmasi kata sandi tidak cocok.';
    }
    if (regWa && !String(regWa).startsWith('62')) {
      return 'Nomor WhatsApp wajib diawali 62.';
    }
    return '';
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateRegister();
    if (validationError) {
      setRegError(validationError);
      return;
    }

    setRegError('');
    setIsRegistering(true);
    try {
      const result = await api.register({
        nim: regNim.trim(),
        nama: regNama.trim(),
        password: regPassword,
        wa: regWa,
      });
      // Register sukses -> langsung login otomatis & lanjut ke Setup Profil.
      onLogin(result.nim, result.nama);
    } catch (err) {
      setRegError(err.message || 'Gagal membuat akun. Coba lagi.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-[450px] bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 dark:from-slate-800 dark:via-indigo-950 dark:to-slate-900 rounded-b-[3rem] shadow-lg dark:shadow-indigo-900/20 transform -skew-y-6 -translate-y-24"></div>

      <ThemeToggle 
        mode={themeMode} 
        onToggle={onToggleTheme} 
        className="absolute top-6 right-6 z-20 bg-white/15 text-white hover:bg-white/25 backdrop-blur-md border border-white/20"
      />
      
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10 overflow-y-auto">
        <div className="w-24 h-24 bg-white/90 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-white/30 ring-4 ring-white/10 p-2 overflow-hidden shrink-0">
          <img 
            src="/untad.png" 
            alt="Logo UNTAD" 
            className="w-full h-full object-contain"
            onError={(e) => {
              e.target.onerror = null; 
              e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234f46e5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'%3E%3C/path%3E%3Cpath d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'%3E%3C/path%3E%3C/svg%3E";
            }}
          />
        </div>
        
        <div className="text-center mb-8 shrink-0">
          <h1 className="text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md">SIDAMPAK</h1>
          <p className="text-indigo-100 font-medium text-sm leading-relaxed px-2">
            Sistem Informasi Dokumentasi Aktivitas Kampus Berdampak<br/>
            <span className="font-bold text-white">Universitas Tadulako</span>
          </p>
        </div>
        
        <div className="w-full bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl shadow-indigo-900/10 p-8 border border-slate-100 dark:border-slate-700">

          {/* TOGGLE LOGIN / REGISTER */}
          <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-1 flex gap-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${mode === 'login' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${mode === 'register' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-200 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Daftar
            </button>
          </div>

          {mode === 'login' ? (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 text-center">Masuk ke Akun Anda</h2>
              <form onSubmit={handleSubmit} className="w-full space-y-5">
                <Input 
                  label="Nomor Induk Mahasiswa (NIM)" 
                  placeholder="Contoh: G20118043" 
                  value={nim} 
                  onChange={(e) => setNim(e.target.value)} 
                  error={error.includes('NIM') ? " " : ""}
                  icon={User}
                  disabled={isSubmitting}
                />
                <Input 
                  label="Kata Sandi" 
                  type="password" 
                  placeholder="Masukkan password..." 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  error={error}
                  icon={Lock}
                  disabled={isSubmitting}
                />
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-800 dark:to-blue-800 text-white font-bold p-4 rounded-2xl mt-4 hover:shadow-lg hover:shadow-indigo-500/30 dark:hover:shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? <><ButtonSpinner /> Memeriksa...</> : 'Mulai Sesi'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
                  >
                    Daftar Sekarang
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-2 duration-300">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 text-center">Buat Akun Baru</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-6 leading-relaxed">
                Pendaftaran untuk mahasiswa peserta Program Kampus Berdampak. Anda bisa melengkapi data profil lainnya setelah akun dibuat.
              </p>
              <form onSubmit={handleRegisterSubmit} className="w-full space-y-5">
                <Input 
                  label="Nomor Induk Mahasiswa (NIM)" 
                  placeholder="Contoh: G20118043" 
                  value={regNim} 
                  onChange={(e) => setRegNim(e.target.value)} 
                  error={regError.includes('NIM') ? " " : ""}
                  icon={User}
                  disabled={isRegistering}
                />
                <Input 
                  label="Nama Lengkap" 
                  placeholder="Sesuai data SIGA-8" 
                  value={regNama} 
                  onChange={(e) => setRegNama(e.target.value)} 
                  error={regError.includes('Nama') ? " " : ""}
                  icon={User}
                  disabled={isRegistering}
                />
                <Input 
                  label="No WhatsApp" 
                  type="tel"
                  placeholder="628..." 
                  value={regWa} 
                  onChange={(e) => setRegWa(e.target.value)} 
                  error={regError.includes('WhatsApp') ? " " : ""}
                  icon={FaWhatsapp}
                  disabled={isRegistering}
                />
                <Input 
                  label="Kata Sandi" 
                  type="password" 
                  placeholder="Minimal 6 karakter" 
                  value={regPassword} 
                  onChange={(e) => setRegPassword(e.target.value)} 
                  error={regError.includes('Kata sandi') && !regError.includes('cocok') ? " " : ""}
                  icon={Lock}
                  disabled={isRegistering}
                />
                <Input 
                  label="Konfirmasi Kata Sandi" 
                  type="password" 
                  placeholder="Ulangi kata sandi..." 
                  value={regPasswordConfirm} 
                  onChange={(e) => setRegPasswordConfirm(e.target.value)} 
                  error={regError.includes('cocok') ? regError : ""}
                  icon={Lock}
                  disabled={isRegistering}
                />
                {regError && !regError.includes('cocok') && (
                  <p className="text-rose-500 text-xs -mt-2 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {regError}</p>
                )}
                <button 
                  type="submit" 
                  disabled={isRegistering}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold p-4 rounded-2xl mt-4 hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isRegistering ? <><ButtonSpinner /> Membuat akun...</> : 'Daftar & Lanjutkan'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-indigo-600 dark:text-indigo-200 font-bold hover:text-indigo-700 transition-colors"
                  >
                    Masuk di sini
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-8 text-center shrink-0">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold tracking-widest uppercase">
            © PMM UNTAD 2026
          </p>
        </div>
      </div>
    </div>
  );
};

// --- LEAFLET CUSTOM ICON & EVENT HANDLER ---
const customMarkerIcon = new L.divIcon({
  className: 'bg-transparent border-none',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#e11d48" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40]
});

const LocationPicker = ({ position, setPosition, setTempLokasi }) => {
  useMapEvents({
    click(e) {
      const lat = e.latlng.lat.toFixed(5);
      const lng = e.latlng.lng.toFixed(5);
      setPosition(e.latlng);
      setTempLokasi(`${lat}, ${lng}`);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={customMarkerIcon} />
  );
};
// 3. Profile Setup View
const ProfileSetupView = ({ userProfile, currentNim, masterData, programSuggestions, dosenList, onSave, onBack, showToast }) => {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const fakultasOptions = masterData?.fakultas?.length ? masterData.fakultas : FAKULTAS_LIST_FALLBACK;
  const prodiOptions = masterData?.prodi?.length ? masterData.prodi.map(p => p.nama) : PRODI_LIST_FALLBACK;
  const programOptions = masterData?.jenisProgram?.length ? masterData.jenisProgram : PROGRAM_LIST_FALLBACK;
  const dosenOptions = (dosenList || []).map(d => d['NAMA DOSEN']);
  const dosenByNama = (dosenList || []).reduce((acc, d) => {
    acc[d['NAMA DOSEN']] = d.NUPTK;
    return acc;
  }, {});

  // Saran datalist Nama Program & Nama Mitra (lihat ProgramSuggestions di
  // api.js). Tidak ada fallback hardcode di sini -- belum ada data hanya
  // berarti belum ada saran yang muncul, field tetap berfungsi normal
  // sebagai input teks bebas (datalist HTML bersifat opsional, tidak
  // memvalidasi/membatasi nilai yang diketik).
  const namaProgramSuggestions = programSuggestions?.namaProgram || [];
  const mitraSuggestions = programSuggestions?.mitra || [];
  
  // PERBAIKAN: Memastikan object 'dokumen' selalu ada (Backward Compatibility)
  const [formData, setFormData] = useState(() => {
    const defaultDokumen = { kerjasama: '', rps: '', krs: '', suratTugas: '', skDpl: '' };
    if (userProfile) {
      return { ...userProfile, dokumen: userProfile.dokumen || defaultDokumen };
    }
    return {
      nim: currentNim || '', nama: '', wa: '62', email: '', prodi: '', fakultas: '', jenisProgram: '', 
      namaProgram: '', mitra: '', lokasi: '', tglAwal: '', tglAkhir: '',
      mataKuliah: [], 
      mentorNama: '', mentorJabatan: '', mentorWa: '62', mentorEmail: '',
      dplNama: '', dplNuptk: '', dplJabatan: '', dplWa: '62', dplEmail: '',
      dokumen: defaultDokumen 
    };
  });
  
  const [newMk, setNewMk] = useState({ kode: '', nama: '', sks: '' });

  // State untuk Modal Peta React-Leaflet
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapPinPos, setMapPinPos] = useState(null);
  const [tempLokasi, setTempLokasi] = useState('');

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  // Saat nama dosen dipilih dari daftar dosen.json, NUPTK otomatis ikut
  // terisi (dan field NUPTK jadi readonly -- lihat step 3). Kalau pengguna
  // mengetik nama bebas yang TIDAK ada di dosenByNama (dosen tidak
  // terdaftar di data), NUPTK dikosongkan supaya tidak salah pasang dengan
  // NUPTK dosen lain, dan field NUPTK kembali bisa diisi manual.
  const handleDplNamaChange = (namaTerpilih) => {
    setFormData(prev => ({
      ...prev,
      dplNama: namaTerpilih,
      dplNuptk: dosenByNama[namaTerpilih] || ''
    }));
  };

  const addMataKuliah = () => {
    if (newMk.kode && newMk.nama && newMk.sks) {
      handleChange('mataKuliah', [...formData.mataKuliah, { ...newMk, id: generateId() }]);
      setNewMk({ kode: '', nama: '', sks: '' });
      showToast('Mata kuliah berhasil ditambahkan.');
    }
  };

  const removeMataKuliah = (id) => {
    handleChange('mataKuliah', formData.mataKuliah.filter(mk => mk.id !== id));
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        handleChange('lokasi', `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        showToast('Lokasi GPS berhasil diambil.');
      }, () => {
        showToast('Gagal mengambil lokasi. Izinkan akses GPS browser Anda.', 'error');
      });
    } else {
      showToast('GPS tidak didukung di perangkat ini.', 'error');
    }
  };

  // Upload dokumen: simpan sebagai data URL base64 di state (sama seperti
  // foto logbook) -- baru benar-benar diupload ke Drive saat formData
  // dikirim lewat onSave -> api.saveProfile.
  const handleDocUpload = (docType, e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showToast('Hanya format PDF yang diizinkan', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file maksimal 5MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          dokumen: { ...(prev.dokumen || {}), [docType]: reader.result }
        }));
        showToast(`${file.name} terpilih.`);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper: tampilkan nama file kalau dokumen berupa link Drive (sudah
  // tersimpan), atau "Dokumen terpilih" kalau masih data URL base64 (baru
  // dipilih, belum disubmit), atau placeholder kalau kosong.
  const getDocLabel = (docType) => {
    const val = formData.dokumen?.[docType];
    if (!val) return 'Pilih File PDF...';
    if (String(val).indexOf('data:') === 0) return 'Dokumen baru terpilih (belum disimpan)';
    return 'Dokumen tersimpan (klik untuk ganti)';
  };

  const validateStep1 = () => formData.nama && String(formData.wa || '').startsWith('62') && formData.email && formData.prodi && formData.fakultas && formData.lokasi;
  const validateStep3 = () => 
    (!formData.dplWa || String(formData.dplWa || '').startsWith('62')) && 
    (!formData.dplNama || !!formData.dplNuptk);

  const openMapPicker = () => {
    if (formData.lokasi) {
      const [lat, lng] = formData.lokasi.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        setMapPinPos({ lat, lng });
        setTempLokasi(formData.lokasi);
      }
    } else {
      setMapPinPos(null);
      setTempLokasi('');
    }
    setShowMapPicker(true);
  };

  const handleFinalSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative">
      <div className="bg-white/80 dark:bg-white/20 backdrop-blur-md px-6 pt-8 pb-4 shadow-sm border-b border-slate-100 dark:border-slate-700 sticky top-0 z-20 flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-slate-100 dark:bg-slate-700 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
          </button>
        )}
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Setup Profil</h1>
      </div>

      <div className="px-6 py-5 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center relative z-10 shadow-sm overflow-hidden">
        <div className="absolute left-10 right-10 h-1 bg-slate-100 dark:bg-slate-700 top-1/2 -translate-y-1/2 -z-10 rounded-full"></div>
        <div className="absolute left-10 h-1 bg-indigo-500 top-1/2 -translate-y-1/2 -z-10 rounded-full transition-all duration-500 ease-out" 
             style={{ width: step === 1 ? '0%' : step === 2 ? '33%' : step === 3 ? '66%' : '100%' }}></div>
        
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex flex-col items-center gap-1.5 bg-white dark:bg-slate-800 px-1">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-300
              ${step === s ? 'bg-indigo-600 text-white scale-110 shadow-indigo-200 ring-2 sm:ring-4 ring-indigo-50' : 
                (step > s ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500')}`}>
              {step > s ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : s}
            </div>
            <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider ${step >= s ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'} text-center w-12 truncate`}>
              {s === 1 ? 'Data' : s === 2 ? 'Matkul' : s === 3 ? 'Review' : 'Berkas'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth pb-10">
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-500" /> Informasi Pribadi
              </h2>
              <Input label="NIM (Tidak Bisa Diubah)" value={formData.nim} disabled title="NIM ditetapkan saat login" />
              <Input label="Nama Lengkap Sesuai Data SIGA-8" value={formData.nama} onChange={e => handleChange('nama', e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="No WhatsApp" type="tel" placeholder="628..." value={formData.wa} onChange={e => handleChange('wa', e.target.value)} error={!String(formData.wa || '').startsWith('62') ? "Wajib 62" : ""} />
                <Input label="Email Aktif" type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-500" /> Detail Penugasan
              </h2>
              <SearchableSelect label="Fakultas" options={fakultasOptions} value={formData.fakultas} onChange={v => handleChange('fakultas', v)} placeholder="Pilih Fakultas..." />
              <SearchableSelect label="Program Studi" options={prodiOptions} value={formData.prodi} onChange={v => handleChange('prodi', v)} placeholder="Pilih Prodi..." />
              <SearchableSelect label="Jenis Program MBKM" options={programOptions} value={formData.jenisProgram} onChange={v => handleChange('jenisProgram', v)} placeholder="Pilih Program..." />
              
              <Input
                label="Nama Spesifik Program"
                placeholder="Cth: Kampus Mengajar Batch 6"
                value={formData.namaProgram}
                onChange={e => handleChange('namaProgram', e.target.value)}
                list="datalist-nama-program"
                autoComplete="off"
              />
              <datalist id="datalist-nama-program">
                {namaProgramSuggestions.map(nama => <option key={nama} value={nama} />)}
              </datalist>

              <Input
                label="Nama Mitra Penugasan"
                placeholder="Cth: SD Negeri 1 Palu"
                value={formData.mitra}
                onChange={e => handleChange('mitra', e.target.value)}
                list="datalist-nama-mitra"
                autoComplete="off"
              />
              <datalist id="datalist-nama-mitra">
                {mitraSuggestions.map(nama => <option key={nama} value={nama} />)}
              </datalist>
              
              <div className="mb-4">
                <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-1.5 ml-1">Lokasi Penugasan (Wajib)</label>
                <div className="flex flex-col gap-3">
                  <input 
                    type="text" 
                    className={`w-full p-3.5 pl-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl text-sm text-slate-800 dark:text-slate-100 outline-none transition-all ${!formData.lokasi ? 'border-rose-300 bg-rose-50' : 'border-slate-200 dark:border-slate-600'}`} 
                    value={formData.lokasi} 
                    readOnly 
                    placeholder="Pilih lokasi di bawah..." 
                  />
                  <div className="flex gap-2">
                    <button onClick={handleGetLocation} className="flex-1 py-3.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors text-xs border border-indigo-100">
                      <MapPin className="w-4 h-4" /> GPS Saat Ini
                    </button>
                    <button 
                      onClick={openMapPicker} 
                      className="flex-1 py-3.5 bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors text-xs shadow-md"
                    >
                      <Search className="w-4 h-4" /> Pilih di Peta
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-5 mt-2">
                <Input 
                  label="Mulai Tugas" 
                  type="date" 
                  value={formatDateForInput(formData.tglAwal)} 
                  onChange={e => handleChange('tglAwal', e.target.value)} 
                />
                <Input 
                  label="Selesai Tugas" 
                  type="date" 
                  value={formatDateForInput(formData.tglAkhir)} 
                  onChange={e => handleChange('tglAkhir', e.target.value)} 
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 dark:from-indigo-800 dark:to-blue-900 border border-transparent dark:border-indigo-700/50 p-6 rounded-[2rem] text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40">
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <BookOpen className="w-6 h-6" /> Rekognisi Matkul
              </h2>
              <p className="text-indigo-100 dark:text-indigo-200/90 text-sm leading-relaxed">
                Tambahkan matakuliah dari KRS yang akan direkognisi. Sistem menggunakan standar <b className="text-white dark:text-indigo-50">1 SKS = 45 Jam</b> aktivitas.
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 uppercase tracking-wide">Form Tambah Baru</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-1"><Input label="Kode" placeholder="MK01" value={newMk.kode} onChange={e => setNewMk({...newMk, kode: e.target.value})} /></div>
                <div className="col-span-1"><Input label="SKS" type="number" placeholder="3" value={newMk.sks} onChange={e => setNewMk({...newMk, sks: e.target.value})} /></div>
                <div className="col-span-3 -mt-3"><Input label="Nama Matakuliah" placeholder="Pemrograman Web" value={newMk.nama} onChange={e => setNewMk({...newMk, nama: e.target.value})} /></div>
              </div>
              <button onClick={addMataKuliah} className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors shadow-md">
                <Plus className="w-5 h-5" /> Simpan Matakuliah
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide ml-2">Daftar Tersimpan ({formData.mataKuliah.length})</h3>
              {formData.mataKuliah.map((mk) => (
                <div key={mk.id} className="group flex justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center font-bold text-indigo-600">
                      {mk.sks}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100">{mk.nama}</p>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide">{mk.kode} • {mk.sks * 45} Jam Target</p>
                    </div>
                  </div>
                  <button onClick={() => removeMataKuliah(mk.id)} className="text-rose-400 p-2 hover:bg-rose-50 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
                </div>
              ))}
              {formData.mataKuliah.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-[2rem] bg-slate-50/50">
                  <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada matakuliah yang ditambahkan.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-[2rem] border border-amber-100 dark:border-amber-800/50 flex gap-4 items-start shadow-sm">
              <Info className="w-6 h-6 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-200 font-medium leading-relaxed">
                Data ini akan digunakan untuk mengirimkan <b className="text-amber-900 dark:text-amber-100">Link Review</b> ke Mentor/DPL via WhatsApp. Pastikan data yang dimasukkan sudah benar dan sesuai termasuk nomor WhatsApp dan email aktif.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-500" /> Data Mentor (Mitra)
              </h2>
              <Input label="Nama Lengkap" placeholder="Bpk. Budi Santoso" value={formData.mentorNama} onChange={e => handleChange('mentorNama', e.target.value)} />
              <Input label="Jabatan di Mitra" value={formData.mentorJabatan} onChange={e => handleChange('mentorJabatan', e.target.value)} />
              <Input label="WhatsApp (Awali 62)" type="tel" placeholder="628..." value={formData.mentorWa} onChange={e => handleChange('mentorWa', e.target.value)} />
              <Input label="Email Aktif" type="email" value={formData.mentorEmail} onChange={e => handleChange('mentorEmail', e.target.value)} />
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-500" /> Data DPL (Kampus)
              </h2>
              <SearchableSelect 
                label="Nama Lengkap & Gelar" 
                options={dosenOptions} 
                value={formData.dplNama} 
                onChange={handleDplNamaChange} 
                placeholder="Cari nama dosen..." 
              />
              <Input 
                label="NUPTK (Otomatis)" 
                type="text" 
                placeholder="Pilih nama dosen terlebih dahulu" 
                value={formData.dplNuptk} 
                disabled
                error={formData.dplNama && !formData.dplNuptk ? "Dosen tidak ditemukan di data, hubungi admin" : ""}
              />
              <Input label="WhatsApp (Awali 62)" type="tel" placeholder="628..." value={formData.dplWa} onChange={e => handleChange('dplWa', e.target.value)} />
              <Input label="Email Kampus" type="email" value={formData.dplEmail} onChange={e => handleChange('dplEmail', e.target.value)} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-[2rem] border border-emerald-100 dark:border-emerald-800/50 flex gap-4 items-start shadow-sm">
              <FileText className="w-6 h-6 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700 dark:text-emerald-200 font-medium leading-relaxed">
                Unggah berkas pendukung administrasi Anda (Opsional). Pastikan semua berkas berformat <b className="text-emerald-900 dark:text-emerald-100">PDF</b> (Maks 5MB per file).
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 space-y-5">
              
              {/* Surat Tugas Mahasiswa */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-2">Surat Tugas Mahasiswa</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleDocUpload('suratTugas', e)} />
                    <div className={`p-4 border border-slate-200 dark:border-slate-600 rounded-2xl flex items-center justify-between transition-colors ${formData.dokumen?.suratTugas ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700'}`}>
                      <div className="flex items-center gap-3 truncate">
                        <FileText className={`w-5 h-5 shrink-0 ${formData.dokumen?.suratTugas ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className={`text-sm truncate font-medium ${formData.dokumen?.suratTugas ? 'text-indigo-800' : 'text-slate-500 dark:text-slate-400'}`}>
                          {getDocLabel('suratTugas')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SK Pengangkatan DPL */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-2">SK Pengangkatan DPL</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleDocUpload('skDpl', e)} />
                    <div className={`p-4 border border-slate-200 dark:border-slate-600 rounded-2xl flex items-center justify-between transition-colors ${formData.dokumen?.skDpl ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700'}`}>
                      <div className="flex items-center gap-3 truncate">
                        <FileText className={`w-5 h-5 shrink-0 ${formData.dokumen?.skDpl ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className={`text-sm truncate font-medium ${formData.dokumen?.skDpl ? 'text-indigo-800' : 'text-slate-500 dark:text-slate-400'}`}>
                          {getDocLabel('skDpl')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kerjasama */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-2">Kerjasama Mitra - Prodi</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleDocUpload('kerjasama', e)} />
                    <div className={`p-4 border border-slate-200 dark:border-slate-600 rounded-2xl flex items-center justify-between transition-colors ${formData.dokumen?.kerjasama ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700'}`}>
                      <div className="flex items-center gap-3 truncate">
                        <FileText className={`w-5 h-5 shrink-0 ${formData.dokumen?.kerjasama ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className={`text-sm truncate font-medium ${formData.dokumen?.kerjasama ? 'text-indigo-800' : 'text-slate-500 dark:text-slate-400'}`}>
                          {getDocLabel('kerjasama')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RPS */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-2">Rencana Pembelajaran (RPS)</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleDocUpload('rps', e)} />
                    <div className={`p-4 border border-slate-200 dark:border-slate-600 rounded-2xl flex items-center justify-between transition-colors ${formData.dokumen?.rps ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700'}`}>
                      <div className="flex items-center gap-3 truncate">
                        <FileText className={`w-5 h-5 shrink-0 ${formData.dokumen?.rps ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className={`text-sm truncate font-medium ${formData.dokumen?.rps ? 'text-indigo-800' : 'text-slate-500 dark:text-slate-400'}`}>
                          {getDocLabel('rps')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* KRS */}
              <div>
                <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-2">KRS SIGA-8</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => handleDocUpload('krs', e)} />
                    <div className={`p-4 border border-slate-200 dark:border-slate-600 rounded-2xl flex items-center justify-between transition-colors ${formData.dokumen?.krs ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700'}`}>
                      <div className="flex items-center gap-3 truncate">
                        <FileText className={`w-5 h-5 shrink-0 ${formData.dokumen?.krs ? 'text-indigo-500' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className={`text-sm truncate font-medium ${formData.dokumen?.krs ? 'text-indigo-800' : 'text-slate-500 dark:text-slate-400'}`}>
                          {getDocLabel('krs')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] relative z-20">
        {step > 1 && (
          <button onClick={() => setStep(step - 1)} disabled={isSaving} className="px-6 py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl hover:bg-slate-200 dark:bg-slate-600 transition-colors disabled:opacity-50">
            Kembali
          </button>
        )}
        {step < 4 ? (
          <button 
            onClick={() => {
              if (step === 1 && !validateStep1()) { 
                showToast('Lengkapi data wajib (Nama, WA, Email, Prodi, & Lokasi)', 'error'); 
                return; 
              }
              if (step === 3 && !validateStep3()) {
                showToast('Cek kembali format WA dan NUPTK DPL', 'error');
                return;
              }
              setStep(step + 1);
            }} 
            className={`flex-1 py-4 font-bold rounded-2xl text-white shadow-lg transition-all flex justify-center items-center gap-2
              ${(step === 1 && !validateStep1()) ? 'bg-slate-300 shadow-none' : 'bg-slate-900 shadow-slate-900/20 hover:bg-slate-800 active:scale-95'}`}
          >
            Lanjut Langkah {step + 1} <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={handleFinalSave} 
            disabled={isSaving}
            className="flex-1 py-4 font-bold rounded-2xl text-white shadow-lg transition-all flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400 shadow-emerald-500/30 dark:shadow-emerald-400/20 hover:shadow-emerald-500/50 dark:hover:shadow-emerald-400/40 active:scale-95 disabled:opacity-70"
          >
            {isSaving ? <><ButtonSpinner /> Menyimpan...</> : <><CheckCircle className="w-5 h-5" /> Simpan Profil</>}
          </button>
        )}
      </div>

      {/* MODAL MAP PICKER (REACT-LEAFLET) */}
      {showMapPicker && (
        <div className="absolute inset-0 z-50 flex flex-col bg-white dark:bg-slate-800 animate-in slide-in-from-bottom-full duration-300">
          <div className="bg-slate-900 text-white px-4 py-4 flex items-center justify-between shadow-md relative z-20">
            <h3 className="font-bold text-sm tracking-wide">Tandai Titik Lokasi Peta</h3>
            <button onClick={() => setShowMapPicker(false)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
          </div>
          
          <div className="flex-1 relative bg-slate-100 dark:bg-slate-700 z-10">
            <MapContainer 
              center={mapPinPos || [-0.8917, 119.8707]} 
              zoom={13} 
              style={{ height: '100%', width: '100%', zIndex: 0 }} 
              zoomControl={false}
            >
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationPicker 
                position={mapPinPos} 
                setPosition={setMapPinPos} 
                setTempLokasi={setTempLokasi} 
              />
            </MapContainer>
             
            {!tempLokasi && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-slate-200 dark:border-slate-600 z-[1000] pointer-events-none animate-bounce">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">Ketuk area pada peta</span>
              </div>
            )}
          </div>
          
          <div className="p-5 bg-white dark:bg-slate-800 shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.1)] relative z-30">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">Koordinat Terpilih:</p>
            <div className="font-mono text-sm text-slate-700 dark:text-slate-200 font-bold mb-4 bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 flex items-center justify-between shadow-inner">
              {tempLokasi || <span className="text-slate-400 dark:text-slate-500 italic font-sans font-medium">Menunggu titik lokasi...</span>}
              {tempLokasi && <CheckCircle className="w-4 h-4 text-emerald-500" />}
            </div>
            <button 
              disabled={!tempLokasi}
              onClick={() => {
                handleChange('lokasi', tempLokasi);
                setShowMapPicker(false);
                showToast('Titik lokasi berhasil digunakan.');
              }} 
              className={`w-full py-3.5 font-bold rounded-xl flex items-center justify-center gap-2 transition-all
                ${tempLokasi ? 'bg-slate-900 text-white shadow-lg hover:bg-slate-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'}`}
            >
              <MapPin className="w-4 h-4"/> Konfirmasi Titik
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
// 4. Dashboard View
const DashboardView = ({ profile, logbooks, isLogbooksLoading, isLaporanLoading, localDraftsList: localDraftsProp, onNewLogbook, onEditProfile, onLogout, showToast, onEditLogbook, onDeleteLogbook, onEditLocalDraft, onDiscardLocalDraft, onViewLaporan, onViewAllLogs, themeMode, onToggleTheme }) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [isReminding, setIsReminding] = useState(false);

  // Menghitung semua jam asalkan statusnya BUKAN 'Draf'
  const mkProgress = useMemo(() => {
    if (!profile?.mataKuliah) return [];
    return profile.mataKuliah.map(mk => {
      const targetHours = parseInt(mk.sks) * 45;
      const currentHours = logbooks.reduce((total, lb) => {
        const mapped = lb.pemetaanMk?.find(m => m.mkId === mk.id);
        return total + (mapped && lb.status !== 'Draf' ? Number(mapped.jam) : 0);
      }, 0);
      const percentage = Math.min(100, Math.round((currentHours / targetHours) * 100)) || 0;
      return { ...mk, targetHours, currentHours, percentage };
    });
  }, [profile, logbooks]);

  // Ringkasan keseluruhan: Target Total (Σ SKS semua matkul rekognisi × 45
  // jam) vs Jam Tercapai (Σ currentHours semua matkul), DIBANDINGKAN dengan
  // progres WAKTU penugasan (berapa hari sudah berjalan dari tglAwal ke
  // tglAkhir). Ini beda dari progress bar per-matakuliah di atas -- yang
  // itu soal rekognisi akademik per-matkul, ini soal apakah kecepatan
  // mengisi logbook sejalan dengan durasi waktu penugasan yang tersisa.
  const overallProgress = useMemo(() => {
    const totalTargetHours = mkProgress.reduce((acc, mk) => acc + mk.targetHours, 0);
    const totalCurrentHours = mkProgress.reduce((acc, mk) => acc + mk.currentHours, 0);
    const hoursPercentage = totalTargetHours > 0
      ? Math.min(100, Math.round((totalCurrentHours / totalTargetHours) * 100))
      : 0;

    let timePercentage = null;
    let daysElapsed = null;
    let daysTotal = null;
    let daysRemaining = null;

    if (profile?.tglAwal && profile?.tglAkhir) {
      const start = parseSafeDate(profile.tglAwal);
      const end = parseSafeDate(profile.tglAkhir);
      const today = new Date();
      // Normalisasi ke tengah malam supaya perhitungan hari bulat & konsisten.
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const msPerDay = 24 * 60 * 60 * 1000;
      const totalSpan = Math.round((end - start) / msPerDay);
      if (totalSpan > 0) {
        daysTotal = totalSpan;
        const elapsed = Math.round((today - start) / msPerDay);
        daysElapsed = Math.max(0, Math.min(totalSpan, elapsed));
        daysRemaining = Math.max(0, totalSpan - daysElapsed);
        timePercentage = Math.min(100, Math.max(0, Math.round((daysElapsed / totalSpan) * 100)));
      }
    }

    return {
      totalTargetHours, totalCurrentHours, hoursPercentage,
      timePercentage, daysElapsed, daysTotal, daysRemaining,
    };
  }, [mkProgress, profile]);

  // Reminder WhatsApp ke Mentor & DPL -- server (handleSendReminder_ di
  // Api.gs) yang menentukan target, menyusun pesan + magic link, MENGIRIM
  // sungguhan lewat gateway WA, dan mengecek cooldown 12 jam. Frontend
  // di sini hanya menampilkan hasilnya -- tidak ada lagi simulasi
  // setTimeout/sessionStorage seperti versi sebelumnya (yang TIDAK
  // benar-benar mengirim apa pun).
  const handleSendReminder = async () => {
    setIsReminding(true);
    try {
      const result = await api.sendReminder(profile.nim);
      showToast(result.message || 'Reminder terkirim.', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal mengirim reminder. Cek koneksi internet Anda.', 'error');
    } finally {
      setIsReminding(false);
    }
  };

  const handleConfirmDelete = async (id) => {
    setDeletingId(id);
    try {
      await onDeleteLogbook(id);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const totalJam = mkProgress.reduce((acc, curr) => acc + curr.currentHours, 0);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 pb-20 relative">
      <div className="bg-gradient-to-b from-slate-900 via-indigo-950 to-indigo-900 text-white rounded-b-[2.5rem] px-6 pt-10 pb-24 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl mix-blend-screen"></div>
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <p className="text-indigo-200 font-medium text-sm tracking-wide uppercase mb-1">Dashboard Mahasiswa</p>
            <h1 className="text-2xl font-extrabold tracking-tight">{profile.nama || 'Mahasiswa'}</h1>
            <p className="text-sm text-indigo-300 mt-1 flex items-center gap-1 font-medium">
              <MapPin className="w-4 h-4"/> {profile.mitra || 'Belum ada Mitra'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle 
              mode={themeMode} 
              onToggle={onToggleTheme} 
              className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/20"
            />
            <button onClick={onEditProfile} className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all cursor-pointer">
              <User className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-16 relative z-20 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 shadow-xl shadow-indigo-900/5 border border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <div className="text-center flex-1">
            <div className="w-10 h-10 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-2">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{logbooks.filter(lb => lb.status === 'Disetujui').length}</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Disetujui</p>
          </div>
          <div className="w-px h-16 bg-slate-100 dark:bg-slate-700 mx-2"></div>
          <div className="text-center flex-1">
            <div className="w-10 h-10 mx-auto bg-emerald-50 rounded-full flex items-center justify-center mb-2">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalJam}</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Tercatat</p>
          </div>
          <div className="w-px h-16 bg-slate-100 dark:bg-slate-700 mx-2"></div>
          <div className="text-center flex-1">
            <div className="w-10 h-10 mx-auto bg-amber-50 rounded-full flex items-center justify-center mb-2">
              <Activity className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-xl font-black text-slate-800 dark:text-slate-100">
              {logbooks.length}
            </p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Total Log</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="flex justify-between items-center mb-4 mt-2">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Progres Rekognisi</h2>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg uppercase tracking-wide">1 SKS = 45 Jam</span>
        </div>

        {overallProgress.totalTargetHours > 0 && (
          <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 mb-5">
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Target Total Penugasan</p>
              <p className="text-xs font-bold text-indigo-600">{overallProgress.hoursPercentage}%</p>
            </div>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{overallProgress.totalCurrentHours}</span>
              <span className="text-sm font-bold text-slate-400 dark:text-slate-500">/ {overallProgress.totalTargetHours} Jam</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${overallProgress.hoursPercentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${overallProgress.hoursPercentage}%` }}
              ></div>
            </div>

            {overallProgress.timePercentage !== null && (
              <>
                <div className="border-t border-slate-100 dark:border-slate-700 mt-4 pt-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Progres Waktu Penugasan
                    </p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{overallProgress.timePercentage}%</p>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-1000 ease-out"
                      style={{ width: `${overallProgress.timePercentage}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    Hari ke-{overallProgress.daysElapsed} dari {overallProgress.daysTotal} hari
                    {overallProgress.daysRemaining > 0 ? ` • ${overallProgress.daysRemaining} hari tersisa` : ' • Periode selesai'}
                  </p>
                </div>

                {overallProgress.hoursPercentage < overallProgress.timePercentage && (
                  <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300 leading-relaxed">
                      Progres jam ({overallProgress.hoursPercentage}%) masih di bawah progres waktu ({overallProgress.timePercentage}%). Pertimbangkan menambah intensitas pengisian logbook.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {mkProgress.map(mk => (
            <div key={mk.id} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="relative w-20 h-20 mb-3">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F1F5F9" strokeWidth="3" />
                  <path 
                    strokeDasharray={`${mk.percentage}, 100`} 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                    fill="none" 
                    stroke={mk.percentage === 100 ? "#10B981" : "#6366F1"} 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-black text-slate-800 dark:text-slate-100">{mk.percentage}%</span>
                </div>
              </div>
              <p className="text-xs font-bold text-center text-slate-700 dark:text-slate-200 line-clamp-2 h-8 leading-tight">{mk.nama}</p>
              <div className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-full w-full text-center">
                {mk.currentHours}/{mk.targetHours} Jam
              </div>
            </div>
          ))}
          {mkProgress.length === 0 && (
             <div className="col-span-2 text-center p-6 bg-slate-100 dark:bg-slate-700 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-600">
                <BookOpen className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada matkul direkognisi.</p>
                <button onClick={onEditProfile} className="mt-3 text-xs font-bold text-indigo-600 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm">Tambah Matkul</button>
             </div>
          )}
        </div>

        {localDraftsProp && localDraftsProp.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Draf Tersimpan
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">{localDraftsProp.length}</span>
              </h2>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Belum dikirim</span>
            </div>
            <div className="space-y-3">
              {localDraftsProp.map(draft => (
                <div key={draft.localDraftId} className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                  <div className="bg-white dark:bg-slate-800 w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-100">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {draft.kegiatan?.length ? draft.kegiatan.join(', ') : 'Logbook belum diberi judul'}
                    </p>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mt-0.5">
                      {formatDateIndoShort(draft.tanggal)} • Tersimpan di perangkat ini saja
                    </p>
                  </div>
                  <button 
                    onClick={() => onEditLocalDraft(draft)} 
                    className="px-3 py-2 bg-white dark:bg-slate-800 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors shrink-0"
                  >
                    Lanjutkan
                  </button>
                  <button 
                    onClick={() => onDiscardLocalDraft(draft.localDraftId)} 
                    className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                    title="Hapus draf"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Logbook Terbaru</h2>
          <div className="flex gap-2">
            <button 
              onClick={onViewAllLogs} 
              className="text-[10px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl transition-colors bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:bg-slate-600"
            >
              Lihat Semua
            </button>
            <button 
              onClick={handleSendReminder} 
              disabled={isReminding}
              className={`text-[10px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors
                ${isReminding ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
            >
              <Bell className={`w-3.5 h-3.5 ${isReminding ? 'animate-bounce' : ''}`} /> 
              {isReminding ? 'Proses...' : 'Reminder'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {isLogbooksLoading && logbooks.length === 0 && (
            <>
              {[0, 1, 2].map(i => (
                <div key={`skeleton-${i}`} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-700 animate-pulse">
                  <div className="flex gap-4">
                    <div className="bg-slate-100 dark:bg-slate-700 w-14 h-14 rounded-2xl flex-shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                      <div className="h-3.5 bg-slate-100 dark:bg-slate-700 rounded-full w-2/3" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full w-full" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full w-1/4 mt-1" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {logbooks.slice(0, 5).map(lb => (
            <div key={lb.id} className={`relative bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border transition-colors group overflow-hidden
              ${lb.status.includes('Revisi') ? 'border-rose-200 shadow-rose-100/50' : 'border-slate-100 dark:border-slate-700 hover:border-indigo-100'}`}>
              
              {lb.status.includes('Revisi') && lb.catatanRevisi && (
                <div className="mb-4 bg-rose-50 p-3.5 rounded-xl border border-rose-100 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Catatan Reviewer:</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">{lb.catatanRevisi}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 group-hover:bg-indigo-50 w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 transition-colors border border-slate-100 dark:border-slate-700 group-hover:border-indigo-100">
                  <span className="text-base font-black text-slate-700 dark:text-slate-200 group-hover:text-indigo-600">{parseSafeDate(lb.tanggal).getDate()}</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">{parseSafeDate(lb.tanggal).toLocaleString('id-ID', { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate mb-1">{lb.kegiatan.join(', ')}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2 font-medium">{lb.deskripsi}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(lb.status)}`}>
                      {lb.status}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded-md">
                      <Clock className="w-3 h-3" /> {lb.durasi} Jam
                    </span>
                  </div>
                </div>
              </div>


              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                  <button onClick={() => onEditLogbook(lb)} className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => setConfirmDeleteId(lb.id)} className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                  </button>
              </div>


              {confirmDeleteId === lb.id && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 animate-in fade-in zoom-in-95 duration-200 rounded-[2rem]">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Yakin hapus logbook ini?</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleConfirmDelete(lb.id)} 
                      disabled={deletingId === lb.id}
                      className="px-5 py-2.5 bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-rose-600 transition-colors flex items-center gap-2 disabled:opacity-70"
                    >
                      {deletingId === lb.id ? <ButtonSpinner className="w-4 h-4" /> : null} Ya, Hapus
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} disabled={deletingId === lb.id} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-200 dark:bg-slate-600 transition-colors disabled:opacity-50">Batal</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!isLogbooksLoading && logbooks.length === 0 && (
            <div className="text-center p-10 bg-white dark:bg-slate-800 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-600">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Belum ada aktivitas.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Tap tombol + untuk mengisi logbook.</p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 dark:border-slate-700 px-8 md:px-16 lg:px-24 py-3 flex justify-between items-center z-10 safe-area-bottom shadow-[0_-15px_30px_-15px_rgba(0,0,0,0.05)] print:hidden">
        <button onClick={onLogout} className="flex flex-col items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Keluar</span>
        </button>

        <div className="relative -top-8">
            <button 
              onClick={onNewLogbook}
              className="w-16 h-16 bg-slate-900 text-white rounded-[2rem] shadow-xl shadow-slate-900/30 flex items-center justify-center hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all ring-4 ring-slate-50"
            >
              <Plus className="w-8 h-8" />
            </button>
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Logbook</span>
        </div>

        <button onClick={onViewLaporan} className="flex flex-col items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 transition-colors">
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Laporan</span>
        </button>
      </div>
    </div>
  );
};
// 4.5. Logbook Table View (Datatable)
const LogbookTableView = ({ logbooks, onBack, profile, onEditLogbook, onDeleteLogbook, showToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'tanggal', direction: 'desc' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const handleConfirmDelete = async (id) => {
    setDeletingId(id);
    try {
      await onDeleteLogbook(id);
      showToast && showToast('Logbook berhasil dihapus.', 'success');
    } catch (err) {
      showToast && showToast(err.message || 'Gagal menghapus logbook.', 'error');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const formatPemetaan = (pemetaanMk) => {
    if (!pemetaanMk || pemetaanMk.length === 0) return '-';
    return pemetaanMk.map(pem => {
      const mk = profile?.mataKuliah?.find(m => m.id === pem.mkId);
      return mk ? `${mk.nama} (${pem.jam} Jam)` : `Unknown (${pem.jam} Jam)`;
    }).join(', ');
  };

  const mkProgress = useMemo(() => {
    if (!profile?.mataKuliah) return [];
    return profile.mataKuliah.map(mk => {
      const targetHours = parseInt(mk.sks) * 45;
      const logbooksTerkait = logbooks.filter(lb => lb.status !== 'Draf' && lb.pemetaanMk?.some(m => m.mkId === mk.id));
      
      const currentHours = logbooksTerkait.reduce((total, lb) => {
        const mapped = lb.pemetaanMk?.find(m => m.mkId === mk.id);
        return total + (mapped ? Number(mapped.jam) : 0);
      }, 0);
      
      const percentage = Math.min(100, Math.round((currentHours / targetHours) * 100)) || 0;
      return { 
        ...mk, 
        targetHours, 
        currentHours, 
        percentage, 
        jumlahLogbook: logbooksTerkait.length 
      };
    });
  }, [profile, logbooks]);

  const sortedData = useMemo(() => {
    let sortableItems = [...logbooks];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (sortConfig.key === 'kegiatan') {
          aValue = a.kegiatan.join(', ');
          bValue = b.kegiatan.join(', ');
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [logbooks, sortConfig]);

  const filteredData = useMemo(() => {
    return sortedData.filter(log => 
      log.deskripsi.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.kegiatan.join(', ').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedData, searchTerm]);

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = entriesPerPage === 'all' ? filteredData : filteredData.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = entriesPerPage === 'all' ? 1 : Math.ceil(filteredData.length / entriesPerPage);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const exportToCSV = () => {
    const profileInfo = [
      `"Nama Mahasiswa","${profile.nama || '-'}"`,
      `"NIM","${profile.nim || '-'}"`,
      `"Prodi","${profile.prodi || '-'}"`,
      `"Nama Mentor","${profile.mentorNama || '-'}"`,
      `"Nama DPL","${profile.dplNama || '-'}"`,
      `"Mitra Penugasan","${profile.mitra || '-'}"`,
      ""
    ];

    const headers = ['Tanggal', 'Kegiatan', 'Durasi (Jam)', 'Deskripsi', 'Dokumentasi', 'Pemetaan Matkul', 'Status', 'Paraf Mentor'];
    const rows = filteredData.map(lb => [
      formatDateIndoShort(lb.tanggal),
      `"${lb.kegiatan.join(', ')}"`,
      lb.durasi,
      `"${lb.deskripsi.replace(/"/g, '""')}"`,
      `"${lb.foto?.length ? lb.foto.length + ' Foto' : '-'}"`, 
      `"${formatPemetaan(lb.pemetaanMk)}"`,
      lb.status,
      '""' 
    ]);
    
    const rekapHeader = ["", "", "", "", "", "", "", ""];
    const rekapTitle = ['"REKAPITULASI PROGRES REKOGNISI SKS"', "", "", "", "", "", "", ""];
    const rekapCols = ['"Kode MK"', '"Nama MK"', '"SKS"', '"Jumlah Logbook"', '"Capaian Jam"', '"Persentase (%)"', "", ""];
    const rekapRows = mkProgress.map(mk => [
      `"${mk.kode}"`,
      `"${mk.nama}"`,
      `"${mk.sks}"`,
      `"${mk.jumlahLogbook}"`,
      `"${mk.currentHours}/${mk.targetHours} Jam"`,
      `"${mk.percentage}%"`,
      "", ""
    ]);

    const footerInfo = [
      "",
      `"","","","","","","Mengetahui DPL,"`,
      `""`,
      `""`,
      `""`,
      `"","","","","","","${profile.dplNama || '-'}"`,
      `"","","","","","","NUPTK. ${profile.dplNuptk || '-'}"`
    ];

    const csvContent = "data:text/csv;charset=utf-8," + 
      profileInfo.join("\n") + "\n" +
      headers.join(',') + "\n" + 
      rows.map(e => e.join(',')).join("\n") + "\n" +
      rekapHeader.join(',') + "\n" +
      rekapTitle.join(',') + "\n" +
      rekapCols.join(',') + "\n" +
      rekapRows.map(e => e.join(',')).join("\n") + "\n" +
      footerInfo.join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Data_Logbook_${profile.nama}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '', 'height=800,width=1200');
    printWindow.document.write('<html><head><title>Export PDF Logbook</title>');
    
    printWindow.document.write(`
      <style>
        @page { size: landscape; margin: 15mm; }
        body { font-family: Arial, sans-serif; padding: 0; font-size: 11px; color: #000; } 
        h2 { text-align: center; margin-bottom: 20px; font-size: 16px; text-transform: uppercase; } 
        
        .header-table { width: 100%; margin-bottom: 20px; border: none; }
        .header-table td { padding: 3px 10px 3px 0; border: none; vertical-align: top; font-size: 12px; }
        
        .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; } 
        .data-table th, .data-table td { border: 1px solid #000; padding: 8px; text-align: left; vertical-align: top; } 
        .data-table th { background-color: #f2f2f2; font-weight: bold; text-align: center; } 
        
        .doc-images { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
        .doc-images img { width: 60px; height: 60px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px; }
        
        .footer-signature { width: 100%; margin-top: 40px; }
        .signature-box { float: right; text-align: left; width: 250px; font-size: 12px; }
        .signature-space { height: 70px; }
        
        .page-break { page-break-before: always; margin-top: 20px; }
        .clearfix::after { content: ""; clear: both; display: table; }
      </style>
    `);
    printWindow.document.write('</head><body>');
    
    printWindow.document.write(`<h2>Logbook Pelaksanaan Kampus Berdampak</h2>`);
    
    printWindow.document.write(`
      <table class="header-table">
        <tr><td width="130"><strong>Nama Mahasiswa</strong></td><td width="10">:</td><td>${profile.nama || '-'}</td></tr>
        <tr><td><strong>NIM</strong></td><td>:</td><td>${profile.nim || '-'}</td></tr>
        <tr><td><strong>Prodi</strong></td><td>:</td><td>${profile.prodi || '-'}</td></tr>
        <tr><td><strong>Nama Mentor</strong></td><td>:</td><td>${profile.mentorNama || '-'}</td></tr>
        <tr><td><strong>Nama DPL</strong></td><td>:</td><td>${profile.dplNama || '-'}</td></tr>
        <tr><td><strong>Mitra Penugasan</strong></td><td>:</td><td>${profile.mitra || '-'}</td></tr>
      </table>
    `);

    let tableHtml = '<table class="data-table"><thead><tr><th width="70">Tanggal</th><th width="120">Kegiatan</th><th width="50">Durasi</th><th>Deskripsi</th><th width="100">Dokumentasi</th><th width="120">Pemetaan Matkul</th><th width="80">Status</th><th width="80">Paraf Mentor</th></tr></thead><tbody>';
    
    filteredData.forEach(lb => {
       let imagesHtml = '-';
       if (lb.foto && lb.foto.length > 0) {
        
         imagesHtml = `<div class="doc-images">${lb.foto.map(img => `<img src="${getSafeImageUrl(img)}" />`).join('')}</div>`;
       }

       tableHtml += `
       <tr>
          <td style="text-align: center;">${formatDateIndoShort(lb.tanggal)}</td>
          <td>${lb.kegiatan.join(', ')}</td>
          <td style="text-align: center;">${lb.durasi} Jam</td>
          <td>${lb.deskripsi}</td>
          <td style="text-align: center;">${imagesHtml}</td>
          <td>${formatPemetaan(lb.pemetaanMk)}</td>
          <td style="text-align: center;">${lb.status}</td>
          <td></td> 
       </tr>`;
    });
    
    tableHtml += '</tbody></table>';
    printWindow.document.write(tableHtml);
    
    printWindow.document.write('<div class="page-break"></div>');
    
    printWindow.document.write(`<h2>Rekapitulasi Progres Rekognisi SKS</h2>`);
    printWindow.document.write(`
      <p style="font-size: 12px; margin-bottom: 10px;">
        <strong>Nama:</strong> ${profile.nama || '-'}   |   
        <strong>NIM:</strong> ${profile.nim || '-'}
      </p>
    `);

    let rekapHtml = `
      <table class="data-table">
        <thead>
          <tr>
            <th width="80">Kode MK</th>
            <th>Nama MK</th>
            <th width="60">SKS</th>
            <th width="120">Jumlah Logbook</th>
            <th width="200">Persentase Capaian (1 SKS = 45 Jam)</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (mkProgress.length > 0) {
      mkProgress.forEach(mk => {
        rekapHtml += `
          <tr>
            <td style="text-align: center;">${mk.kode}</td>
            <td>${mk.nama}</td>
            <td style="text-align: center;">${mk.sks}</td>
            <td style="text-align: center;">${mk.jumlahLogbook} Aktivitas</td>
            <td style="text-align: center;">
              <strong>${mk.percentage}%</strong> <br/>
              <span style="font-size:10px; color:#555;">(${mk.currentHours} dari ${mk.targetHours} Jam)</span>
            </td>
          </tr>
        `;
      });
    } else {
      rekapHtml += `<tr><td colspan="5" style="text-align:center;">Belum ada matakuliah yang ditambahkan.</td></tr>`;
    }

    rekapHtml += `</tbody></table>`;
    printWindow.document.write(rekapHtml);

    printWindow.document.write(`
      <div class="footer-signature clearfix">
        <div class="signature-box">
          <p style="margin: 0;">Mengetahui DPL,</p>
          <div class="signature-space"></div>
          <p style="margin: 0; font-weight: bold; text-decoration: underline;">${profile.dplNama || '________________________'}</p>
          <p style="margin: 0;">NUPTK. ${profile.dplNuptk || '-'}</p>
        </div>
      </div>
    `);

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();

    const imgs = printWindow.document.images;
    const imgPromises = Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    });

    Promise.all(imgPromises).then(() => {
      printWindow.print();
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="bg-white/90 dark:bg-white/20 backdrop-blur-md px-6 pt-8 pb-4 shadow-sm border-b border-slate-100 dark:border-slate-700 sticky top-0 z-20 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700 rounded-2xl transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
          </button>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Semua Logbook</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-10 space-y-4 print:p-0 print:overflow-visible">
        
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-4 print:hidden">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input 
                type="text" 
                placeholder="Cari kegiatan atau deskripsi..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Show:</label>
              <select 
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-2 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                value={entriesPerPage}
                onChange={e => {
                  setEntriesPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value="all">Semua</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={exportToCSV} className="flex-1 flex justify-center items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-xl text-xs font-bold transition-colors">
              <Download className="w-4 h-4"/> Excel (CSV)
            </button>
            <button onClick={exportToPDF} className="flex-1 flex justify-center items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 py-2 rounded-xl text-xs font-bold transition-colors">
              <Printer className="w-4 h-4"/> PDF
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-600">
                  <th className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide cursor-pointer hover:bg-slate-100 dark:bg-slate-700" onClick={() => requestSort('tanggal')}>
                    <div className="flex items-center gap-1">Tanggal <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" /></div>
                  </th>
                  <th className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide cursor-pointer hover:bg-slate-100 dark:bg-slate-700" onClick={() => requestSort('kegiatan')}>
                    <div className="flex items-center gap-1">Kegiatan <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" /></div>
                  </th>
                  <th className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide cursor-pointer hover:bg-slate-100 dark:bg-slate-700" onClick={() => requestSort('durasi')}>
                    <div className="flex items-center gap-1">Durasi <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" /></div>
                  </th>
                  <th className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Deskripsi</th>
                  <th className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Dokumentasi</th>
                  <th className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Pemetaan Matkul</th>
                  <th className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide cursor-pointer hover:bg-slate-100 dark:bg-slate-700" onClick={() => requestSort('status')}>
                    <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-500" /></div>
                  </th>
                  <th className="p-3 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide text-center print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentEntries.length > 0 ? (
                  currentEntries.map(lb => (
                    <tr key={lb.id} className="hover:bg-slate-50 dark:bg-slate-900 transition-colors">
                      <td className="p-3 text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{formatDateIndoShort(lb.tanggal)}</td>
                      <td className="p-3 text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[120px]">{lb.kegiatan.join(', ')}</td>
                      <td className="p-3 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{lb.durasi} Jam</td>
                      <td className="p-3 text-xs text-slate-500 dark:text-slate-400 min-w-[200px]">{lb.deskripsi}</td>
                      
                      <td className="p-3 min-w-[100px]">
                        {lb.foto && lb.foto.length > 0 ? (
                          <div className="flex gap-1.5 flex-wrap">
                            {lb.foto.map((img, idx) => (
                              <img key={idx} src={getSafeImageUrl(img)} alt={`Doc ${idx}`} className="h-8 w-8 object-cover rounded shadow-sm border border-slate-200 dark:border-slate-600" />
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">-</span>
                        )}
                      </td>

                      <td className="p-3 text-xs font-semibold text-indigo-700 min-w-[140px]">
                        {formatPemetaan(lb.pemetaanMk)}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(lb.status)}`}>
                          {lb.status}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap print:hidden">
                        
                        <div className="flex gap-1.5 justify-center">
                            <button 
                              onClick={() => onEditLogbook && onEditLogbook(lb)} 
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => setConfirmDeleteId(lb.id)} 
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Tidak ada data ditemukan.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {entriesPerPage !== 'all' && totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 print:hidden">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Hal {currentPage} dari {totalPages}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Prev
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmDeleteId && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 print:hidden">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">Yakin hapus logbook ini?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)} 
                disabled={deletingId === confirmDeleteId}
                className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl hover:bg-slate-200 dark:bg-slate-600 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button 
                onClick={() => handleConfirmDelete(confirmDeleteId)} 
                disabled={deletingId === confirmDeleteId}
                className="flex-1 px-4 py-3 bg-rose-500 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {deletingId === confirmDeleteId ? <ButtonSpinner className="w-4 h-4" /> : null} Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
// 5. Logbook Form View (Langkah 2) - MULTIPLE IMAGES + SUBMIT ASYNC KE SERVER
// 5. Logbook Form View (Langkah 2) - MULTIPLE IMAGES + SUBMIT ASYNC KE SERVER
const LogbookFormView = ({ profile, onSave, onSaveLocalDraft, onDiscardLocalDraft, onBack, showToast, editingLogbook }) => {
  
  const initialFoto = editingLogbook 
    ? (Array.isArray(editingLogbook.foto) ? editingLogbook.foto : (editingLogbook.foto ? [editingLogbook.foto] : []))
    : [];

  const [formData, setFormData] = useState(editingLogbook ? { ...editingLogbook, foto: initialFoto } : {
    tanggal: getWitaDateString(),
    kegiatan: [],
    durasi: '',
    deskripsi: '',
    pemetaanMk: [], 
    foto: [],
    status: 'Menunggu Persetujuan Mentor'
  });
  
  const [kegiatanOptions, setKegiatanOptions] = useState(KEGIATAN_DEFAULT);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!editingLogbook;
  // Logbook yang sedang diedit dianggap "sudah ada di server" hanya kalau
  // ia punya id asli DAN bukan draf lokal (draf lokal ditandai isLocalDraft).
  // Logbook baru, atau draf lokal yang sedang dilanjutkan, keduanya BUKAN
  // logbook server -- "Simpan Draf" untuk keduanya cukup disimpan lokal.
  const isServerLogbook = isEditMode && !editingLogbook.isLocalDraft;
  const isBusy = isSavingDraft || isSubmitting;

  useEffect(() => {
    let targetStatus = formData.status === 'Draf' ? 'Menunggu Persetujuan Mentor' : formData.status;
    if (!profile.mentorNama && targetStatus === 'Menunggu Persetujuan Mentor') {
      targetStatus = 'Menunggu Persetujuan DPL';
    }
    if(formData.status !== targetStatus && formData.status !== 'Draf') {
       setFormData(prev => ({ ...prev, status: targetStatus }));
    }
  }, [profile]);

  const handleKegiatanSelect = (val) => {
    if (val && !formData.kegiatan.includes(val)) {
      setFormData(prev => ({ ...prev, kegiatan: [...prev.kegiatan, val] }));
    }
  };

  const removeKegiatan = (keg) => {
    setFormData(prev => ({ ...prev, kegiatan: prev.kegiatan.filter(k => k !== keg) }));
  };

  const handleDescChange = (e) => {
    const text = e.target.value;
    setFormData(prev => ({ ...prev, deskripsi: text }));
  };

  const handleMkMapChange = (mkId, jamStr) => {
    const jam = parseInt(jamStr) || 0;
    setFormData(prev => {
      const existing = prev.pemetaanMk.filter(m => m.mkId !== mkId);
      if (jam > 0) existing.push({ mkId, jam });
      return { ...prev, pemetaanMk: existing };
    });
  };

  // MULTIPLE IMAGES HANDLER — tetap base64 di state lokal untuk preview;
  // upload sebenarnya ke Drive terjadi di server saat onSave dipanggil.
  const handleImageCapture = (e) => {
    const files = Array.from(e.target.files);
    
    if (formData.foto.length + files.length > 4) {
      showToast('Maksimal 4 dokumentasi diperbolehkan!', 'error');
      return;
    }

    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(images => {
      setFormData(prev => ({ ...prev, foto: [...prev.foto, ...images].slice(0, 4) }));
    });
  };

  const removeFoto = (index) => {
    setFormData(prev => ({ ...prev, foto: prev.foto.filter((_, i) => i !== index) }));
  };

  const totalMapped = formData.pemetaanMk.reduce((acc, curr) => acc + curr.jam, 0);
  const isValidDuration = parseInt(formData.durasi) > 0 && parseInt(formData.durasi) <= 24;
  const isMappingValid = isValidDuration && totalMapped === parseInt(formData.durasi);
  const charCount = formData.deskripsi.length;
  const isValidDesc = charCount >= 100;
  const canSave = formData.kegiatan.length > 0 && isMappingValid && isValidDesc && formData.foto.length > 0 && formData.foto.length <= 4;

  const finalSubmitStatus = profile?.mentorNama ? 'Menunggu Persetujuan Mentor' : 'Menunggu Persetujuan DPL';

  const handleSaveDraft = async () => {
    // Logbook yang SUDAH ada di server (sedang diedit, mis. status
    // "Revisi Mentor") tetap memakai jalur lama: update langsung ke server.
    if (isServerLogbook) {
      setIsSavingDraft(true);
      try {
        await onSave({ ...formData, status: 'Draf', id: formData.id });
        showToast('Disimpan ke draf.', 'success');
      } catch (err) {
        showToast(err.message || 'Gagal menyimpan draf.', 'error');
      } finally {
        setIsSavingDraft(false);
      }
      return;
    }

    // Logbook baru (atau draf lokal yang sedang dilanjutkan) -- simpan
    // HANYA ke localStorage, tidak ada panggilan API/upload Drive sama
    // sekali. Foto dikompresi otomatis di dalam onSaveLocalDraft sebelum
    // disimpan. di-`await` supaya toast sukses HANYA muncul setelah
    // penyimpanan benar-benar tuntas (sebelumnya ini tidak di-await,
    // sehingga toast "berhasil" bisa muncul walau penyimpanan gagal/belum
    // selesai -- itulah sumber bug "kadang cuma 1 foto yang tersimpan").
    setIsSavingDraft(true);
    try {
      await onSaveLocalDraft({
        ...formData,
        status: 'Draf',
        localDraftId: editingLogbook?.localDraftId, // ada kalau melanjutkan draf lokal yang sudah ada
      });
      showToast('Disimpan sebagai draf di perangkat ini.', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan draf ke perangkat ini.', 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSave) return;
    setIsSubmitting(true);
    try {
      // id final logbook: pakai id server kalau sudah ada (edit logbook
      // server), atau generate baru kalau ini logbook baru/berasal dari
      // draf lokal (draf lokal tidak punya id server, hanya localDraftId).
      const finalId = isServerLogbook ? formData.id : generateId();
      await onSave({ ...formData, status: finalSubmitStatus, id: finalId, catatanRevisi: '' });

      // Submit berhasil -> kalau ini berasal dari draf lokal, hapus draf
      // lokalnya supaya tidak muncul dobel (sekali sudah di server, sekali
      // di daftar draf lokal).
      if (editingLogbook?.isLocalDraft && editingLogbook?.localDraftId) {
        onDiscardLocalDraft(editingLogbook.localDraftId);
      }

      showToast(isServerLogbook ? 'Perubahan disimpan!' : 'Logbook berhasil dikirim!', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal mengirim logbook.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="bg-white/90 dark:bg-white/20 backdrop-blur-md px-6 pt-8 pb-4 shadow-sm border-b border-slate-100 dark:border-slate-700 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} disabled={isBusy} className="p-2 -ml-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700 rounded-2xl transition-colors disabled:opacity-50">
            <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
          </button>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{isEditMode ? 'Edit Logbook' : 'Tulis Logbook'}</h1>
        </div>
        <div className={`text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider ${formData.status === 'Draf' ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200' : 'bg-indigo-50 text-indigo-600'}`}>
          {isEditMode ? formData.status : 'Baru'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {isEditMode && formData.status.includes('Revisi') && formData.catatanRevisi && (
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Perbaiki Menurut Catatan Ini:</p>
              <p className="text-sm font-semibold text-rose-900">{formData.catatanRevisi}</p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
          <Input label="Tanggal Aktivitas" type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} icon={Calendar} disabled={isBusy} />
          
          <div className="mt-4">
            <SearchableSelect 
              label="Kategori Kegiatan" 
              options={kegiatanOptions} 
              value="" 
              clearOnSelect={true}
              onChange={handleKegiatanSelect} 
              placeholder="Ketik lalu tekan Enter..." 
              onAddCustom={(newVal) => setKegiatanOptions([...kegiatanOptions, newVal])}
            />
            {formData.kegiatan.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                {formData.kegiatan.map((k, i) => (
                  <span key={i} className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-2 border border-slate-200 dark:border-slate-600">
                    {k} 
                    <button onClick={() => removeKegiatan(k)} className="bg-rose-50 text-rose-500 rounded-full p-0.5 hover:bg-rose-100"><X className="w-3 h-3"/></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
          <Input 
            label="Durasi Total (Maks 24 Jam)" 
            type="number" 
            max="24"
            placeholder="Cth: 8"
            value={formData.durasi} 
            onChange={e => setFormData({...formData, durasi: e.target.value})} 
            error={!isValidDuration && formData.durasi !== '' ? "Durasi tidak valid" : ""}
            icon={Clock}
            disabled={isBusy}
          />

          {isValidDuration && profile.mataKuliah && profile.mataKuliah.length > 0 && (
            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 mt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Pemetaan Jam ke Matkul</h3>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isMappingValid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {totalMapped} / {formData.durasi} Jam
                </span>
              </div>
              
              <div className="space-y-3 mt-4">
                {profile.mataKuliah.map(mk => {
                  const mappedVal = formData.pemetaanMk.find(m => m.mkId === mk.id)?.jam || '';
                  return (
                    <div key={mk.id} className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-50 shadow-sm">
                      <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{mk.nama}</span>
                      <input 
                        type="number" 
                        disabled={isBusy}
                        className="w-16 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-center font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" 
                        placeholder="0" 
                        value={mappedVal}
                        onChange={(e) => handleMkMapChange(mk.id, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
          <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-2 flex justify-between items-center">
            Cerita Logbook (5W+1H) 
            <span className={`px-2 py-1 rounded-lg ${isValidDesc ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{charCount}/100 Karakter</span>
          </label>
          <textarea 
            disabled={isBusy}
            className={`w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl h-40 resize-none font-medium text-slate-700 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all disabled:opacity-50
              ${!isValidDesc && charCount > 0 ? 'border-2 border-rose-300 focus:ring-rose-500' : 'border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'}`}
            placeholder="Jelaskan secara detail: Apa kegiatan hari ini? Siapa saja yang terlibat? Di mana lokasinya? Mengapa ini penting? Bagaimana prosesnya berjalan? (Min. 100 Karakter)"
            value={formData.deskripsi}
            onChange={handleDescChange}
          />
        </div>

        {/* BUKTI DOKUMENTASI (GRID UNTUK MAKSIMAL 4 FOTO) */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
          <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-2 flex justify-between">
            Bukti Dokumentasi 
            <span className={`px-2 py-0.5 rounded text-[10px] ${formData.foto.length > 0 && formData.foto.length <= 4 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>{formData.foto.length}/4</span>
          </label>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-3">
            {formData.foto.map((imgSrc, index) => (
              <div key={index} className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-600 aspect-square">
                <img src={getSafeImageUrl(imgSrc)} alt={`Bukti ${index + 1}`} className="w-full h-full object-cover" />
                <button 
                  onClick={() => removeFoto(index)}
                  disabled={isBusy}
                  className="absolute top-2 right-2 bg-rose-500/80 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-rose-600 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {formData.foto.length < 4 && (
              <div className="relative border-2 border-dashed border-slate-300 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700 rounded-2xl aspect-square flex flex-col items-center justify-center transition-all cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  disabled={isBusy}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                  onChange={handleImageCapture}
                />
                <Camera className="w-8 h-8 text-indigo-400 mb-2" />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tambah Foto</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-3 text-center">Format: JPG/PNG. Maksimal 4 Foto.</p>
        </div>

      </div>

      <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] relative z-20">
        <button 
          onClick={handleSaveDraft}
          disabled={isBusy}
          className="px-4 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:bg-slate-600 transition-colors shrink-0 flex items-center gap-2 disabled:opacity-70"
        >
          {isSavingDraft ? <ButtonSpinner className="w-4 h-4" /> : null} Simpan Draf
        </button>
        <button 
          disabled={!canSave || isBusy}
          onClick={handleSubmit}
          className={`flex-1 py-4 font-bold rounded-2xl text-white shadow-lg transition-all flex items-center justify-center gap-2
            ${canSave && !isBusy ? 'bg-slate-900 shadow-slate-900/20 hover:bg-slate-800 active:scale-95' : 'bg-slate-300 shadow-none text-slate-500 dark:text-slate-400'}`}
        >
          {isSubmitting ? <><ButtonSpinner /> Mengirim...</> : <><Send className="w-5 h-5" /> Submit</>}
        </button>
      </div>
    </div>
  );
};
// 6. Laporan Akhir View
const LaporanAkhirView = ({ laporanData, onSave, onBack, showToast, onDelete }) => {
  const [formData, setFormData] = useState(laporanData || {
    tanggal: getWitaDateString(),
    fileName: '',
    fileData: null,
    status: 'Belum Disubmit'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showToast('File harus berformat PDF', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file maksimal 5MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, fileName: file.name, fileData: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const isSubmitted = formData.status !== 'Belum Disubmit';
  const isApproved = formData.status === 'Disetujui';
  const canSave = formData.tanggal && formData.fileName;

  const handleSubmitLaporan = async () => {
    setIsSubmitting(true);
    try {
      await onSave({ ...formData, status: 'Menunggu Persetujuan Mentor' });
    } catch (err) {
      showToast(err.message || 'Gagal mengirim laporan.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLaporan = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      onBack();
    } catch (err) {
      showToast(err.message || 'Gagal menghapus laporan.', 'error');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="bg-white/90 dark:bg-white/20 backdrop-blur-md px-6 pt-8 pb-4 shadow-sm border-b border-slate-100 dark:border-slate-700 sticky top-0 z-20 flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700 rounded-2xl transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
        </button>
        <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Laporan Akhir</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isSubmitted ? (
          <div className="animate-in fade-in zoom-in duration-500">
            <div className={`${isApproved ? 'bg-emerald-500' : 'bg-amber-500'} p-6 rounded-[2rem] text-white shadow-lg mb-6 text-center`}>
              <CheckCircle className="w-16 h-16 mx-auto mb-3 text-white" />
              <h2 className="text-lg font-bold">{isApproved ? 'Laporan Disetujui' : 'Laporan Disubmit'}</h2>
              <p className="text-white/80 text-sm">{isApproved ? 'Laporan Anda sudah resmi.' : 'Menunggu verifikasi dari DPL/Mentor.'}</p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">File Laporan</span>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isApproved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {formData.status}
                </span>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                <FileText className="w-8 h-8 text-indigo-500" />
                <div className="flex-1 min-w-0">
                  {formData.fileLink ? (
                    <a href={formData.fileLink} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-700 truncate hover:underline block">{formData.fileName}</a>
                  ) : (
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{formData.fileName}</p>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">{formatDateIndo(formData.tanggal)}</p>
                </div>
              </div>

              {!isApproved && (
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setFormData({...formData, status: 'Belum Disubmit'})} className="flex-1 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-xs hover:bg-indigo-100 transition-colors">Edit Laporan</button>
                  <button 
                    onClick={handleDeleteLaporan} 
                    disabled={isDeleting}
                    className="flex-1 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl text-xs hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isDeleting ? <ButtonSpinner className="w-4 h-4" /> : null} Hapus Laporan
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 p-5 rounded-[2rem] flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 bg-white dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-3 shadow-sm text-indigo-600 dark:text-indigo-400">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-indigo-900 dark:text-indigo-100 mb-1">Template Laporan</h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-4">Gunakan format resmi Kampus Berdampak.</p>
              <a href="https://s.id/AKHIR-MBKM" target="_blank" rel="noreferrer" className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
                Unduh Template PDF
              </a>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
              <Input label="Tanggal Pembuatan" type="date" value={formData.tanggal} onChange={e => setFormData({...formData, tanggal: e.target.value})} icon={Calendar} disabled={isSubmitting} />

              <div className="mt-4">
                <label className="block text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400 uppercase mb-2">Upload Laporan (PDF)</label>
                <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative overflow-hidden
                  ${formData.fileName ? 'border-emerald-300 dark:border-emerald-700/50 bg-emerald-50/30 dark:bg-emerald-900/20' : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <input 
                    type="file" 
                    accept=".pdf,application/pdf"
                    disabled={isSubmitting}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleFileUpload}
                  />
                  {formData.fileName ? (
                    <div className="flex flex-col items-center">
                      <FileText className="w-10 h-10 text-emerald-500 dark:text-emerald-400 mb-2" />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{formData.fileName}</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm mt-3 border border-slate-100 dark:border-slate-700">Ganti File</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4">
                      <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Pilih File PDF Laporan</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">Maksimal 5MB</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isSubmitted && (
        <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] relative z-20">
          <button 
            disabled={!canSave || isSubmitting}
            onClick={handleSubmitLaporan} 
            className={`w-full py-4 font-bold rounded-2xl text-white shadow-lg transition-all flex items-center justify-center gap-2
              ${canSave && !isSubmitting ? 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95' : 'bg-slate-300 shadow-none text-slate-500 dark:text-slate-400'}`}
          >
            {isSubmitting ? <><ButtonSpinner /> Mengirim...</> : <><Send className="w-5 h-5" /> Submit Laporan Akhir</>}
          </button>
        </div>
      )}
    </div>
  );
};
// 7. Reviewer View (Mentor/DPL Magic Link) — data dari server, bukan dbSim
const ReviewerView = ({ reviewerToken, showToast }) => {
  const [activeTab, setActiveTab] = useState('antrean');
  const [selectedMhsId, setSelectedMhsId] = useState(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [mhsList, setMhsList] = useState([]);
  const [pendingLogs, setPendingLogs] = useState([]);
  const [pendingLaporan, setPendingLaporan] = useState([]);
  // Identitas pemilik token ini (role: 'mentor'|'dpl', nama, dst) --
  // dikembalikan server di handleGetReviewerQueue_ supaya halaman bisa
  // menyapa "Halo, Bapak/Ibu [nama]" dan reviewer tahu link ini memang
  // untuknya (lihat buildReviewerIdentity_ di Api.gs).
  const [reviewerInfo, setReviewerInfo] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null); // { mahasiswa, mataKuliah, logbooks, laporan }

  const [actionLoadingId, setActionLoadingId] = useState(null); // id item yg sedang di-approve/revisi
  const [revisiModal, setRevisiModal] = useState({ isOpen: false, itemId: null, type: '', text: '' });
  const [isSubmittingRevisi, setIsSubmittingRevisi] = useState(false);

  // Tanpa token sama sekali, jangan coba request apa pun ke server --
  // tampilkan pesan akses ditolak langsung (lihat render di bawah).
  const hasToken = !!reviewerToken;

  const loadQueue = useCallback(async () => {
    if (!hasToken) { setIsLoadingQueue(false); return; }
    let gotCacheHit = false;
    setLoadError('');

    const fetchPromise = api.getReviewerQueue(reviewerToken, {
      onCacheHit: (cached) => {
        if (!cached) return;
        gotCacheHit = true;
        setMhsList(cached.mahasiswa || []);
        setPendingLogs(cached.pendingLogs || []);
        setPendingLaporan(cached.pendingLaporan || []);
        setReviewerInfo(cached.reviewer || null);
        setIsLoadingQueue(false); // sudah ada sesuatu untuk ditampilkan
      },
    });

    await Promise.resolve();
    if (!gotCacheHit) setIsLoadingQueue(true);

    try {
      const data = await fetchPromise;
      setMhsList(data.mahasiswa || []);
      setPendingLogs(data.pendingLogs || []);
      setPendingLaporan(data.pendingLaporan || []);
      setReviewerInfo(data.reviewer || null);
    } catch (err) {
      if (!gotCacheHit) setLoadError(err.message || 'Gagal memuat antrean.');
      // Kalau sudah ada cache yang tampil, kegagalan refresh di belakang
      // tidak perlu mengganggu tampilan -- antrean cache tetap valid untuk dilihat.
    } finally {
      setIsLoadingQueue(false);
    }
  }, [hasToken, reviewerToken]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const loadMahasiswaDetail = useCallback(async (nim) => {
    let gotCacheHit = false;

    const fetchPromise = api.getMahasiswaDetailForReviewer(nim, reviewerToken, {
      onCacheHit: (cached) => {
        if (!cached) return;
        gotCacheHit = true;
        setDetailData(cached);
        setDetailLoading(false);
      },
    });

    await Promise.resolve();
    if (!gotCacheHit) {
      setDetailData(null);
      setDetailLoading(true);
    }

    try {
      const data = await fetchPromise;
      setDetailData(data);
    } catch (err) {
      if (!gotCacheHit) {
        showToast(err.message || 'Gagal memuat data mahasiswa.', 'error');
        setSelectedMhsId(null);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [showToast, reviewerToken]);

  useEffect(() => {
    if (selectedMhsId) loadMahasiswaDetail(selectedMhsId);
  }, [selectedMhsId, loadMahasiswaDetail]);

  const handleApprove = async (id, type) => {
    setActionLoadingId(id);
    try {
      await api.reviewApprove(type, id, reviewerToken);
      showToast(`${type === 'laporan' ? 'Laporan' : 'Logbook'} disetujui!`, 'success');
      // Refresh antrean & detail (kalau sedang melihat detail mahasiswa)
      await loadQueue();
      if (selectedMhsId) await loadMahasiswaDetail(selectedMhsId);
    } catch (err) {
      showToast(err.message || 'Gagal menyetujui.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSubmitRevisi = async () => {
    if (!revisiModal.text.trim()) {
      showToast('Catatan revisi tidak boleh kosong', 'error');
      return;
    }
    setIsSubmittingRevisi(true);
    try {
      await api.reviewRevisi(revisiModal.type, revisiModal.itemId, revisiModal.text, reviewerToken);
      showToast(`${revisiModal.type === 'laporan' ? 'Laporan' : 'Logbook'} dikembalikan untuk revisi.`, 'success');
      setRevisiModal({ isOpen: false, itemId: null, type: '', text: '' });
      await loadQueue();
      if (selectedMhsId) await loadMahasiswaDetail(selectedMhsId);
    } catch (err) {
      showToast(err.message || 'Gagal mengirim revisi.', 'error');
    } finally {
      setIsSubmittingRevisi(false);
    }
  };

  const getLogMkNames = (log, mataKuliahList) => {
    if (!log.pemetaanMk || !mataKuliahList) return '';
    return log.pemetaanMk.map(pem => {
      const mk = mataKuliahList.find(m => m.id === pem.mkId);
      return mk ? mk.nama : 'Unknown MK';
    }).join(', ');
  };

  const selectedMhsMkProgress = useMemo(() => {
    if (!detailData) return [];
    const { mataKuliah, logbooks } = detailData;
    return (mataKuliah || []).map(mk => {
      const targetHours = parseInt(mk.sks) * 45;
      const currentHours = (logbooks || []).reduce((total, lb) => {
        const mapped = lb.pemetaanMk?.find(m => m.mkId === mk.id);
        return total + (mapped && lb.status !== 'Draf' ? Number(mapped.jam) : 0);
      }, 0);
      const percentage = Math.min(100, Math.round((currentHours / targetHours) * 100)) || 0;
      return { ...mk, targetHours, currentHours, percentage };
    });
  }, [detailData]);

  if (!hasToken) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 h-full p-8 text-center">
        <Lock className="w-10 h-10 text-rose-500 mb-3" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Akses Ditolak</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Halaman ini hanya bisa diakses lewat tautan aman (magic link) yang dikirim ke WhatsApp Mentor/DPL. Tidak ada token akses pada tautan ini.
        </p>
      </div>
    );
  }

  if (isLoadingQueue) {
    return <PageLoader label="Memuat antrean review..." />;
  }

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 h-full p-8 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Gagal memuat data</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{loadError}</p>
        <button onClick={loadQueue} className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl">Coba Lagi</button>
      </div>
    );
  }

  if (selectedMhsId) {
    const mhs = mhsList.find(m => m.id === selectedMhsId);

    if (detailLoading || !detailData) {
      return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
          <div className="bg-white/90 backdrop-blur-md px-6 pt-8 pb-4 shadow-sm border-b border-slate-100 dark:border-slate-700 sticky top-0 z-20 flex items-center gap-4">
            <button onClick={() => setSelectedMhsId(null)} className="p-2 -ml-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700 rounded-2xl transition-colors">
              <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
            </button>
            <h1 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tracking-tight truncate">{mhs?.nama || 'Memuat...'}</h1>
          </div>
          <PageLoader label="Memuat data mahasiswa..." />
        </div>
      );
    }

    const mhsLogs = [...(detailData.logbooks || [])].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
    const mhsLaporans = [...(detailData.laporan || [])].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
    
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
        <div className="bg-white/90 backdrop-blur-md px-6 pt-8 pb-4 shadow-sm border-b border-slate-100 dark:border-slate-700 sticky top-0 z-20 flex items-center gap-4">
          <button onClick={() => setSelectedMhsId(null)} className="p-2 -ml-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:bg-slate-700 rounded-2xl transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
          </button>
          <div className="flex-1 truncate">
            <h1 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 tracking-tight truncate">{detailData.mahasiswa?.nama}</h1>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{detailData.mahasiswa?.nim} • {detailData.mahasiswa?.prodi}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-3 uppercase tracking-wider">Capaian SKS</h2>
            <div className="grid grid-cols-2 gap-3">
              {selectedMhsMkProgress.map(mk => (
                <div key={mk.id} className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3 hover:border-indigo-100 transition-colors">
                  <div className="relative w-12 h-12 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                      <path strokeDasharray={`${mk.percentage}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={mk.percentage === 100 ? "#10B981" : "#6366F1"} strokeWidth="4" strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">{mk.percentage}%</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{mk.nama}</p>
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{mk.currentHours}/{mk.targetHours} Jam</p>
                  </div>
                </div>
              ))}
              {selectedMhsMkProgress.length === 0 && (
                <div className="col-span-2 text-center p-4 bg-slate-100 dark:bg-slate-700 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-600">
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Belum ada matakuliah direkognisi.</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-500" /> Laporan Akhir
            </h2>
            <div className="space-y-3">
              {mhsLaporans.map(lap => (
                <div key={lap.id} className="bg-emerald-50/50 p-4 rounded-2xl shadow-sm border border-emerald-100">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider
                      ${lap.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 
                        lap.status.includes('Revisi') ? 'bg-rose-100 text-rose-700' : 
                        'bg-amber-100 text-amber-700'}`}>
                      {lap.status}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{formatDateIndoShort(lap.tanggal)}</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-50 mb-3">
                    <FileText className="w-6 h-6 text-emerald-500 shrink-0" />
                    {lap.fileLink ? (
                      <a href={lap.fileLink} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-700 truncate hover:underline">{lap.fileName}</a>
                    ) : (
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{lap.fileName}</p>
                    )}
                  </div>
                  
                  {lap.status.includes('Menunggu') && (
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={() => handleApprove(lap.id, 'laporan')} 
                        disabled={actionLoadingId === lap.id}
                        className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        {actionLoadingId === lap.id ? <ButtonSpinner className="w-3.5 h-3.5" /> : null} Approve
                      </button>
                      <button onClick={() => setRevisiModal({ isOpen: true, itemId: lap.id, type: 'laporan', text: '' })} className="flex-1 bg-rose-50 text-rose-600 py-2 rounded-xl text-xs font-bold">Revisi</button>
                    </div>
                  )}
                </div>
              ))}
              {mhsLaporans.length === 0 && <p className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">Mahasiswa belum mengunggah Laporan Akhir.</p>}
            </div>
          </div>

          <div>
             <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-3 uppercase tracking-wider flex items-center gap-2">
               <BookOpen className="w-4 h-4 text-indigo-500" /> Riwayat Logbook
             </h2>
             <div className="space-y-4">
              {mhsLogs.map(log => (
                <div key={log.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-indigo-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(log.status)}`}>
                      {log.status}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{formatDateIndoShort(log.tanggal)} • {log.durasi} Jam</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{log.kegiatan.join(', ')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">{log.deskripsi}</p>
                  
                  {log.foto && log.foto.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                      {log.foto.map((img, i) => (
                        <a key={i} href={getSafeImageUrl(img)} target="_blank" rel="noreferrer">
                          <img src={getSafeImageUrl(img)} alt={`Doc ${i}`} className="h-16 w-16 object-cover rounded-lg border border-slate-200 dark:border-slate-600" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl text-[10px] font-medium text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> <span className="truncate">{getLogMkNames(log, detailData.mataKuliah)}</span>
                  </div>
                  
                  {log.status.includes('Menunggu') && (
                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <button 
                        onClick={() => handleApprove(log.id, 'logbook')} 
                        disabled={actionLoadingId === log.id}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        {actionLoadingId === log.id ? <ButtonSpinner className="w-3.5 h-3.5" /> : null} Approve
                      </button>
                      <button onClick={() => setRevisiModal({ isOpen: true, itemId: log.id, type: 'logbook', text: '' })} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2 rounded-xl text-xs font-bold transition-colors">Revisi</button>
                    </div>
                  )}
                </div>
              ))}
              {mhsLogs.length === 0 && <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4 border border-dashed border-slate-200 dark:border-slate-600 rounded-2xl">Belum ada riwayat.</p>}
            </div>
          </div>
        </div>
        
        {revisiModal.isOpen && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex flex-col justify-end">
            <div className="bg-white dark:bg-slate-800 rounded-t-[2rem] p-6 animate-in slide-in-from-bottom-full duration-300">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Catatan Revisi {revisiModal.type === 'logbook' ? 'Logbook' : 'Laporan'}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Beritahu mahasiswa apa yang perlu diperbaiki.</p>
              <textarea 
                autoFocus
                disabled={isSubmittingRevisi}
                className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-2xl h-32 resize-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-4 disabled:opacity-60"
                placeholder="Contoh: Tolong lengkapi dengan format yang benar..."
                value={revisiModal.text}
                onChange={(e) => setRevisiModal({...revisiModal, text: e.target.value})}
              />
              <div className="flex gap-3">
                <button onClick={() => setRevisiModal({ isOpen: false, itemId: null, type: '', text: '' })} disabled={isSubmittingRevisi} className="px-6 py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:bg-slate-600 disabled:opacity-50">Batal</button>
                <button onClick={handleSubmitRevisi} disabled={isSubmittingRevisi} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-70">
                  {isSubmittingRevisi ? <ButtonSpinner className="w-4 h-4" /> : <Send className="w-4 h-4"/>} Kirim Revisi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative">
      <div className="bg-slate-900 text-white px-6 pt-10 pb-20 rounded-b-[2.5rem] shadow-xl relative overflow-hidden shrink-0">
         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <p className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase mb-1 flex items-center gap-2">
          <Lock className="w-3 h-3"/> Akses Aman (Token)
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight">Portal Reviewer</h1>
        {reviewerInfo?.nama && (
          <p className="text-sm text-slate-300 mt-1">
            Halo, {reviewerInfo.role === 'dpl' ? 'Bapak/Ibu Dosen' : 'Bapak/Ibu'} <span className="font-bold text-white">{reviewerInfo.nama}</span>
          </p>
        )}
        
        <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-6 md:px-10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-5 border border-white/10 flex flex-col items-center justify-center">
            <p className="text-xl font-black text-white">{mhsList.length}</p>
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wider mt-1">Mhs</p>
          </div>
          <div className="bg-indigo-500/20 backdrop-blur-md rounded-2xl p-3 sm:p-5 border border-indigo-500/30 flex flex-col items-center justify-center relative">
            {pendingLogs.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>}
            {pendingLogs.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full"></span>}
            <p className="text-xl font-black text-indigo-300">{pendingLogs.length}</p>
            <p className="text-[8px] font-bold text-indigo-300/70 uppercase tracking-wider mt-1">Logbook</p>
          </div>
          <div className="bg-emerald-500/20 backdrop-blur-md rounded-2xl p-3 sm:p-5 border border-emerald-500/30 flex flex-col items-center justify-center relative">
             {pendingLaporan.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping"></span>}
             {pendingLaporan.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full"></span>}
            <p className="text-xl font-black text-emerald-300">{pendingLaporan.length}</p>
            <p className="text-[8px] font-bold text-emerald-300/70 uppercase tracking-wider mt-1">Laporan</p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-10 mb-4 shrink-0">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg shadow-slate-900/5 p-1 flex gap-1 border border-slate-100 dark:border-slate-700">
          <button 
            onClick={() => setActiveTab('antrean')} 
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'antrean' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900'}`}
          >
            Antrean Review
          </button>
          <button 
            onClick={() => setActiveTab('mahasiswa')} 
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'mahasiswa' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900'}`}
          >
            Mahasiswa
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-2 pb-24 relative">
        {activeTab === 'antrean' && (
          (pendingLogs.length === 0 && pendingLaporan.length === 0) ? (
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2rem] text-center border border-slate-100 dark:border-slate-700 shadow-sm mt-4">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Semua Selesai!</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tidak ada antrean logbook maupun laporan.</p>
            </div>
          ) : (
            <div className="space-y-5">
              
              {pendingLaporan.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2"><Download className="w-3.5 h-3.5"/> Antrean Laporan Akhir</h3>
                  <div className="space-y-4">
                    {pendingLaporan.map(lap => {
                      const mhs = lap.mahasiswa || mhsList.find(m => m.id === lap.nim) || {};
                      return (
                      <div key={lap.id} className="bg-emerald-50/50 p-5 rounded-[2rem] shadow-sm border border-emerald-100">
                        <div className="flex justify-between items-start mb-4 border-b border-emerald-100/50 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center font-bold text-emerald-700">
                              {mhs.nama?.charAt(0) || '?'}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 dark:text-slate-100">{mhs.nama}</h3>
                              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{mhs.nim}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatDateIndoShort(lap.tanggal)}</p>
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md mt-1 inline-block">Pending</span>
                          </div>
                        </div>
                        
                        <div className="mb-4 bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-50 flex items-center gap-3">
                          <FileText className="w-6 h-6 text-emerald-500 shrink-0" />
                          {lap.fileLink ? (
                            <a href={lap.fileLink} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-700 truncate hover:underline">{lap.fileName}</a>
                          ) : (
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{lap.fileName}</p>
                          )}
                        </div>
                        
                        <div className="flex gap-3 mt-4 pt-3 border-t border-emerald-100/50">
                          <button 
                            onClick={() => handleApprove(lap.id, 'laporan')} 
                            disabled={actionLoadingId === lap.id}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70"
                          >
                            {actionLoadingId === lap.id ? <ButtonSpinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4"/>} Setujui
                          </button>
                          <button onClick={() => setRevisiModal({ isOpen: true, itemId: lap.id, type: 'laporan', text: '' })} className="flex-1 bg-white dark:bg-slate-800 hover:bg-rose-50 text-rose-600 border border-rose-100 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex justify-center items-center gap-2">
                            <AlertCircle className="w-4 h-4"/> Revisi
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              )}

              {pendingLogs.length > 0 && (
                <div>
                   <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5"/> Antrean Logbook Harian</h3>
                   <div className="space-y-4">
                    {pendingLogs.map(log => {
                      const mhs = log.mahasiswa || {};
                      return (
                      <div key={log.id} className="bg-white dark:bg-slate-800 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-4 border-b border-slate-50 dark:border-slate-800 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-600">
                              {mhs.nama?.charAt(0) || '?'}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 dark:text-slate-100">{mhs.nama}</h3>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{mhs.nim}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{formatDateIndoShort(log.tanggal)}</p>
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{log.durasi} Jam</p>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">{log.kegiatan.join(', ')}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700 leading-relaxed mb-3">
                            {log.deskripsi}
                          </p>
                        </div>
                        
                        <div className="flex gap-3 mt-4 pt-3 border-t border-slate-50 dark:border-slate-800">
                          <button 
                            onClick={() => handleApprove(log.id, 'logbook')} 
                            disabled={actionLoadingId === log.id}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70"
                          >
                            {actionLoadingId === log.id ? <ButtonSpinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4"/>} Setujui
                          </button>
                          <button onClick={() => setRevisiModal({ isOpen: true, itemId: log.id, type: 'logbook', text: '' })} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex justify-center items-center gap-2">
                            <AlertCircle className="w-4 h-4"/> Revisi
                          </button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'mahasiswa' && (
          <div className="space-y-3">
            {mhsList.map(mhs => {
              const pendingCount = pendingLogs.filter(l => l.nim === mhs.nim).length;
              const pendingLapCount = pendingLaporan.filter(l => l.nim === mhs.nim).length;
              const totalPending = pendingCount + pendingLapCount;
              
              return (
                <div 
                  key={mhs.id} 
                  onClick={() => setSelectedMhsId(mhs.id)}
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 cursor-pointer hover:border-indigo-200 transition-all group"
                >
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-100 rounded-full flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 transition-colors">
                    {mhs.nama.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{mhs.nama}</h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">{mhs.nim} • {mhs.prodi}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    {totalPending > 0 && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-md">{totalPending} Antrean</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {revisiModal.isOpen && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white dark:bg-slate-800 rounded-t-[2rem] p-6 animate-in slide-in-from-bottom-full duration-300 shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.2)]">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500"/> Catatan Revisi {revisiModal.type === 'logbook' ? 'Logbook' : 'Laporan'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Beritahu mahasiswa apa yang perlu diperbaiki.</p>
            <textarea 
              autoFocus
              disabled={isSubmittingRevisi}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-2xl h-32 resize-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-4 font-medium text-slate-700 dark:text-slate-200 disabled:opacity-60"
              placeholder="Contoh: Tolong lengkapi deskripsi dengan hasil dari rapat..."
              value={revisiModal.text}
              onChange={(e) => setRevisiModal({...revisiModal, text: e.target.value})}
            />
            <div className="flex gap-3">
              <button onClick={() => setRevisiModal({ isOpen: false, itemId: null, type: '', text: '' })} disabled={isSubmittingRevisi} className="px-6 py-3.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleSubmitRevisi} disabled={isSubmittingRevisi} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-70">
                {isSubmittingRevisi ? <ButtonSpinner className="w-4 h-4" /> : <Send className="w-4 h-4"/>} Kirim Revisi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-0 pointer-events-none">
        <span className="bg-slate-200/50 backdrop-blur-sm text-slate-500 dark:text-slate-400 text-[9px] font-bold px-3 py-1.5 rounded-full">
          Portal aman, tidak memerlukan sesi login.
        </span>
      </div>
    </div>
  );
}

// --- MAIN APP CONTAINER ---
export default function App() {
  const [view, setView] = useState('loading'); 
  const [user, setUser] = useState(null);  // { nim, nama }
  const [profile, setProfile] = useState(null);
  const [logbooks, setLogbooks] = useState([]);
  const [editingLogbook, setEditingLogbook] = useState(null);
  const [localDraftsList, setLocalDraftsList] = useState([]); // draf logbook baru, tersimpan di localStorage saja
  const [laporanAkhir, setLaporanAkhir] = useState(null);
  const [reviewerToken, setReviewerToken] = useState(null);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [masterData, setMasterData] = useState(null);
  const [programSuggestions, setProgramSuggestions] = useState(null);
  const [isLoadingDashboardData, setIsLoadingDashboardData] = useState(false);
  // Loading per-section: profil tidak lagi menunggu logbook/laporan untuk
  // tampil. Masing-masing punya status loading sendiri supaya DashboardView
  // bisa menampilkan skeleton kecil di section terkait, bukan blocking
  // seluruh halaman menunggu request yang paling lambat.
  const [isLogbooksLoading, setIsLogbooksLoading] = useState(false);
  const [isLaporanLoading, setIsLaporanLoading] = useState(false);
  // Tema: 'light' | 'dark'. Diinisialisasi dari preferensi tersimpan, atau
  // ikut preferensi sistem/OS kalau pengguna belum pernah memilih secara
  // eksplisit (lihat theme.getInitial() di api.js).
  const [themeMode, setThemeMode] = useState(() => theme.getInitial());

  const showToast = (message, type = 'success') => setToast({ message, type });

  // Setiap kali themeMode berubah: toggle class "dark" di elemen <html>
  // (supaya Tailwind dark: variant aktif di SELURUH halaman, bukan hanya
  // di dalam wrapper aplikasi) DAN simpan pilihannya secara permanen.
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    theme.save(themeMode);
  }, [themeMode]);

  const toggleTheme = () => setThemeMode(prev => (prev === 'dark' ? 'light' : 'dark'));

  // Master data (Fakultas/Prodi/JenisProgram) jarang berubah -> cache 24
  // jam. onCacheHit membuatnya tampil instan kalau pernah dimuat sebelumnya;
  // fetch fresh tetap jalan di belakang untuk menjaga akurasi jangka panjang.
  useEffect(() => {
    api.getMasterData({ onCacheHit: setMasterData })
      .then(setMasterData)
      .catch(() => {}); // gagal refresh tidak fatal -- fallback hardcode tetap ada di component
  }, []);

  // Saran Nama Program & Nama Mitra (datalist) untuk ProfileSetupView --
  // gagal diam-diam tidak fatal, field tetap berfungsi sebagai input
  // teks bebas tanpa saran kalau request ini gagal.
  useEffect(() => {
    api.getProgramSuggestions({ onCacheHit: setProgramSuggestions })
      .then(setProgramSuggestions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      setReviewerToken(token);
      setView('reviewer');
      return;
    }

    // Cek cache sesi login (valid 7 hari). Kalau ada & masih berlaku,
    // langsung muat data dashboard tanpa minta login ulang.
    const cached = session.getValid();
    if (cached) {
      setUser({ nim: cached.nim, nama: cached.nama });
      setLocalDraftsList(localDrafts.list(cached.nim));
      loadUserData(cached.nim);
    } else {
      session.clear();
      setView('login');
    }
  }, []);

  // ---------------------------------------------------------------------
  // Memuat Profil, Logbook, dan Laporan secara INDEPENDEN -- masing-masing
  // tidak menunggu yang lain. Strategi "tampil instan, perbarui di
  // belakang":
  //   1. Profil menentukan kapan dashboard boleh dirender. Begitu profil
  //      siap (dari cache ATAU server, mana pun lebih dulu), dashboard
  //      langsung tampil -- TANPA menunggu logbook/laporan selesai.
  //   2. Logbook & laporan punya status loading sendiri-sendiri
  //      (isLogbooksLoading/isLaporanLoading) supaya section masing-masing
  //      bisa menampilkan skeleton kecil sambil data masih dimuat,
  //      sementara sisa dashboard sudah interaktif.
  // Kalau profil TIDAK ada cache (login pertama kali di perangkat ini),
  // baru tampilkan PageLoader sambil menunggu profil dari server -- karena
  // memang belum ada apa pun yang bisa ditampilkan.
  // ---------------------------------------------------------------------
  const loadUserData = async (nim) => {
    let gotProfileCacheHit = false;

    // ---------------------------------------------------------------
    // PROFIL -- ini satu-satunya yang menentukan kapan dashboard boleh
    // dirender (karena DashboardView butuh `profile`). Begitu profil siap
    // (dari cache ATAU dari server, mana pun lebih dulu), langsung pindah
    // ke 'dashboard'. TIDAK menunggu logbook/laporan sama sekali.
    // ---------------------------------------------------------------
    const profilePromise = api.getProfile(nim, {
      onCacheHit: (cached) => {
        if (!cached) return;
        gotProfileCacheHit = true;
        setProfile(cached);
        setView('dashboard'); // langsung tampil, tidak menunggu network
      },
    });

    // ---------------------------------------------------------------
    // LOGBOOK & LAPORAN -- berjalan independen dari profil. Masing-masing
    // punya status loading sendiri (isLogbooksLoading/isLaporanLoading)
    // supaya DashboardView bisa menampilkan skeleton kecil khusus di
    // section itu saja, tanpa menahan tampilan profil/dashboard secara
    // keseluruhan. Cache hit langsung tampil; fetch fresh tetap jalan di
    // belakang dan menimpa begitu selesai.
    // ---------------------------------------------------------------
    let gotLogbookCacheHit = false;
    setIsLogbooksLoading(true);
    const logbookPromise = api.getLogbooks(nim, {
      onCacheHit: (cached) => {
        gotLogbookCacheHit = true;
        setLogbooks(cached || []);
      },
    });
    logbookPromise
      .then((data) => setLogbooks(data || []))
      .catch(() => {
        if (gotLogbookCacheHit) {
          showToast('Gagal memperbarui logbook terbaru. Menampilkan data tersimpan.', 'error');
        }
        // Cache miss + gagal: biarkan logbooks tetap [] (state awal),
        // dashboard tetap tampil normal tanpa blocking.
      })
      .finally(() => setIsLogbooksLoading(false));

    let gotLaporanCacheHit = false;
    setIsLaporanLoading(true);
    const laporanPromise = api.getLaporan(nim, {
      onCacheHit: (cached) => {
        gotLaporanCacheHit = true;
        setLaporanAkhir(cached || null);
      },
    });
    laporanPromise
      .then((data) => setLaporanAkhir(data || null))
      .catch(() => {
        if (gotLaporanCacheHit) {
          showToast('Gagal memperbarui laporan terbaru. Menampilkan data tersimpan.', 'error');
        }
      })
      .finally(() => setIsLaporanLoading(false));

    // Beri microtask sekejap untuk onCacheHit profil sempat berjalan
    // sebelum kita putuskan apakah perlu menampilkan spinner full-page.
    // Spinner ini HANYA untuk kasus belum ada apa pun untuk ditampilkan
    // (login pertama kali di perangkat ini, profil belum pernah di-cache).
    await Promise.resolve();
    if (!gotProfileCacheHit) {
      setIsLoadingDashboardData(true);
      setView('loadingDashboard');
    }

    try {
      const profileData = await profilePromise;

      if (!profileData) {
        // Belum pernah isi profil -> arahkan ke setup
        setProfile(null);
        setLogbooks([]);
        setLaporanAkhir(null);
        setView('setup');
        return;
      }

      // Update final dengan profil fresh -- menimpa apa pun yang sempat
      // tampil dari cache, memastikan kebenaran selalu menang. Logbook &
      // laporan TIDAK ditunggu di sini -- mereka menyusul sendiri lewat
      // promise terpisah di atas begitu masing-masing selesai.
      setProfile(profileData);
      setView('dashboard');
    } catch (err) {
      if (gotProfileCacheHit) {
        // Sudah terlanjur menampilkan profil dari cache -- biarkan
        // pengguna tetap melihatnya, cukup beri tahu lewat toast bahwa
        // pembaruan terbaru gagal dimuat, tanpa melempar balik ke login.
        showToast('Gagal memperbarui profil terbaru. Menampilkan data tersimpan.', 'error');
      } else {
        showToast(err.message || 'Gagal memuat data dari server.', 'error');
        session.clear();
        setUser(null);
        setView('login');
      }
    } finally {
      setIsLoadingDashboardData(false);
    }
  };

  const handleLogin = (nim, nama) => {
    session.save(nim, nama);
    setUser({ nim, nama });
    showToast('Login berhasil!');
    setLocalDraftsList(localDrafts.list(nim));
    loadUserData(nim);
  };

  const handleLogout = () => {
    session.clear();
    setUser(null);
    setProfile(null);
    setLogbooks([]);
    setLaporanAkhir(null);
    setLocalDraftsList([]);
    setView('login');
  };

  // Draf logbook BARU (belum pernah ada di server) -- simpan ke
  // localStorage saja, tidak ada panggilan API/upload Drive ke server.
  // Foto dikompresi otomatis di dalam localDrafts.save sebelum disimpan
  // (lihat catatan kompresi di api.js) supaya semua foto (1-4) konsisten
  // tersimpan tanpa melebihi kuota localStorage. Melempar error ke
  // pemanggil kalau tetap gagal -- TIDAK pernah gagal diam-diam.
  const handleSaveLocalDraft = async (draftData) => {
    await localDrafts.save(user.nim, draftData);
    setLocalDraftsList(localDrafts.list(user.nim));
    setEditingLogbook(null);
    setView('dashboard');
  };

  // Dipanggil setelah draf lokal berhasil disubmit ke server (sudah jadi
  // logbook server yang sesungguhnya), atau saat pengguna menghapusnya
  // manual dari Dashboard.
  const handleDiscardLocalDraft = (localDraftId) => {
    localDrafts.remove(user.nim, localDraftId);
    setLocalDraftsList(localDrafts.list(user.nim));
  };

  // saveProfile mengirim seluruh formData (termasuk dokumen base64 baru &
  // mataKuliah) ke server. Server menangani upload Drive & upsert semua
  // tabel terkait (Mahasiswa, Program, MkRekognisi, DokumenPendukung,
  // Mentor, Dosen, Pembimbing), LALU langsung mengembalikan profil
  // lengkap terbaru (termasuk link Drive hasil upload) di response yang
  // sama -- TIDAK perlu memanggil getProfile lagi sesudahnya. Ini
  // menghapus satu round-trip penuh ke GAS, yang sebelumnya jadi sumber
  // utama "simpan profil" terasa lama.
  const handleSaveProfile = async (data) => {
    try {
      const freshProfile = await api.saveProfile({ ...data, nim: user.nim, namaMahasiswa: data.nama });
      setProfile(freshProfile);
      setView('dashboard');
      showToast('Profil berhasil disimpan!');
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan profil.', 'error');
      throw err; // supaya ProfileSetupView tahu submit gagal & berhenti loading
    }
  };

  // saveLogbook mengirim foto sebagai data URL base64 (file baru) atau URL
  // Drive lama (tidak diubah). Server menentukan mana yang perlu diupload,
  // LALU langsung mengembalikan SELURUH DAFTAR logbook terbaru (link foto
  // final dari Drive) di response yang sama -- TIDAK perlu memanggil
  // getLogbooks lagi sesudahnya. Menghapus satu round-trip GAS penuh.
  const handleSaveLogbook = async (logData) => {
    try {
      const payload = {
        ...logData,
        nim: user.nim,
        namaMahasiswa: profile?.nama,
        tahunAjaran: profile?.tahunAjaranId,
      };
      const freshLogbooks = await api.saveLogbook(payload);
      setLogbooks(freshLogbooks || []);
      setEditingLogbook(null);
      setView('dashboard');

      if (!editingLogbook && logData.status !== 'Draf' && "Notification" in window && Notification.permission === "granted") {
        new Notification("Logbook Terkirim", {
          body: "Data berhasil disimpan dan diteruskan ke DPL/Mentor."
        });
      }
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan logbook.', 'error');
      throw err;
    }
  };

  // saveLaporan -- server langsung mengembalikan object laporan lengkap
  // terbaru (termasuk fileLink final dari Drive) di response yang sama,
  // TIDAK perlu memanggil getLaporan lagi sesudahnya.
  const handleSaveLaporan = async (data) => {
    try {
      const payload = {
        ...data,
        nim: user.nim,
        namaMahasiswa: profile?.nama,
        tahunAjaran: profile?.tahunAjaranId,
      };
      const freshLaporan = await api.saveLaporan(payload);
      setLaporanAkhir(freshLaporan);
      setView('dashboard');
      showToast('Laporan Akhir berhasil disubmit!', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan laporan.', 'error');
      throw err;
    }
  };

  const handleDeleteLogbook = async (id) => {
    try {
      await api.deleteLogbook({ id, nim: user.nim, namaMahasiswa: profile?.nama, tahunAjaran: profile?.tahunAjaranId });
      setLogbooks(prev => prev.filter(lb => lb.id !== id));
      showToast('Logbook berhasil dihapus', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal menghapus logbook.', 'error');
      throw err;
    }
  };

  const handleDeleteLaporan = async () => {
    try {
      await api.deleteLaporan({ nim: user.nim });
      setLaporanAkhir(null);
      showToast('Laporan berhasil dihapus', 'success');
    } catch (err) {
      showToast(err.message || 'Gagal menghapus laporan.', 'error');
      throw err;
    }
  };

  useEffect(() => {
    if (view === 'dashboard' && "Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, [view]);

  return (
    <div className="bg-slate-100 dark:bg-slate-950 min-h-screen font-sans flex justify-center">
      <div className="w-full max-w-7xl bg-white dark:bg-slate-800 min-h-screen shadow-2xl overflow-hidden relative flex flex-col">
        
        <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

        {view === 'loading' && <PageLoader label="Memuat Sistem..." />}
        {view === 'loadingDashboard' && <PageLoader label="Mengambil data profil..." />}
        {view === 'login' && <LoginView onLogin={handleLogin} themeMode={themeMode} onToggleTheme={toggleTheme} />}
        
        {view === 'setup' && (
          <ProfileSetupView 
            userProfile={profile} 
            currentNim={user?.nim} 
            masterData={masterData}
            programSuggestions={programSuggestions}
            dosenList={dosenData}
            onSave={handleSaveProfile} 
            onBack={profile ? () => setView('dashboard') : null} 
            showToast={showToast} 
          />
        )}
        
        {view === 'dashboard' && profile && (
          <DashboardView 
            profile={profile} 
            logbooks={logbooks} 
            isLogbooksLoading={isLogbooksLoading}
            isLaporanLoading={isLaporanLoading}
            localDraftsList={localDraftsList}
            onNewLogbook={() => { setEditingLogbook(null); setView('logbookForm'); }} 
            onEditLogbook={(lb) => { setEditingLogbook(lb); setView('logbookForm'); }} 
            onEditLocalDraft={(draft) => { setEditingLogbook(draft); setView('logbookForm'); }}
            onDeleteLogbook={handleDeleteLogbook} 
            onDiscardLocalDraft={handleDiscardLocalDraft}
            onEditProfile={() => setView('setup')} 
            onLogout={handleLogout} 
            showToast={showToast} 
            onViewLaporan={() => setView('laporanAkhir')} 
            onViewAllLogs={() => setView('logbookTable')} 
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
          />
        )}
        {view === 'logbookTable' && (
          <LogbookTableView 
            logbooks={logbooks} 
            onBack={() => setView('dashboard')} 
            profile={profile} 
            onEditLogbook={(lb) => { setEditingLogbook(lb); setView('logbookForm'); }}
            onDeleteLogbook={handleDeleteLogbook}
            showToast={showToast}
          />
        )}
        {view === 'logbookForm' && (
          <LogbookFormView 
            key={editingLogbook ? (editingLogbook.id || editingLogbook.localDraftId) : 'new'} 
            profile={profile} 
            editingLogbook={editingLogbook} 
            onSave={handleSaveLogbook} 
            onSaveLocalDraft={handleSaveLocalDraft}
            onDiscardLocalDraft={handleDiscardLocalDraft}
            onBack={() => { setEditingLogbook(null); setView('dashboard'); }} 
            showToast={showToast} 
          />
        )}
        {view === 'laporanAkhir' && (
          <LaporanAkhirView 
            laporanData={laporanAkhir} 
            onSave={handleSaveLaporan} 
            onDelete={handleDeleteLaporan} 
            onBack={() => setView('dashboard')} 
            showToast={showToast} 
          />
          )}
        {view === 'reviewer' && <ReviewerView reviewerToken={reviewerToken} showToast={showToast} />}
      </div>
    </div>
  );
}