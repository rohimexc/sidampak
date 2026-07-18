import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock, Users, FileText, CheckCircle, AlertCircle, Download, Search,
  Loader2, Filter, ChevronDown, ChevronLeft, ChevronRight, TrendingUp,
  MapPin, GraduationCap, X, FileWarning, LogOut, LayoutDashboard,
  Building2, BookOpen, KeyRound, Plus, Trash2, Pencil, Copy, Check,
  Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import * as XLSX from 'xlsx';

import { api } from './api'; // lihat catatan kontrak backend di bagian bawah file ini

// =====================================================================
// UTIL LOKAL -- file ini MANDIRI, sama seperti AdminFakultasView.jsx
// =====================================================================
const parseSafeDate = (dateString) => {
  if (!dateString) return new Date();
  const strDate = String(dateString);
  if (strDate.includes('T') && (strDate.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(strDate))) {
    const utcDate = new Date(strDate);
    if (!isNaN(utcDate.getTime())) {
      const wita = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
      return new Date(wita.getUTCFullYear(), wita.getUTCMonth(), wita.getUTCDate());
    }
  }
  const justDate = strDate.split('T')[0].split(' ')[0];
  if (justDate.includes('-')) {
    const [y, m, d] = justDate.split('-');
    return new Date(y, m - 1, parseInt(d, 10));
  }
  const fb = new Date(strDate);
  return isNaN(fb.getTime()) ? new Date() : fb;
};
const formatDateIndoShort = (raw) => {
  if (!raw) return '-';
  const d = parseSafeDate(raw);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
const getStatusBadgeClass = (status) => {
  if (status === 'Disetujui') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Draf') return 'bg-slate-200 text-slate-700';
  if (status === 'Revisi Mentor') return 'bg-rose-100 text-rose-700';
  if (status === 'Revisi DPL') return 'bg-orange-100 text-orange-700';
  if (status === 'Menunggu Persetujuan Mentor') return 'bg-amber-100 text-amber-700';
  if (status === 'Menunggu Persetujuan DPL') return 'bg-indigo-100 text-indigo-700';
  return 'bg-slate-100 text-slate-500';
};
const waLink = (wa, text) => {
  if (!wa) return null;
  const number = String(wa).replace(/[^0-9]/g, '');
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
};

const PageLoader = ({ label = 'Memuat data...' }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen">
    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    <p className="mt-4 text-slate-500 font-bold text-sm tracking-widest uppercase text-center px-8">{label}</p>
  </div>
);

const ButtonSpinner = ({ className = '' }) => <Loader2 className={`w-4 h-4 animate-spin ${className}`} />;

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-11/12 max-w-sm pointer-events-none animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium flex items-center gap-3 border border-slate-700/50">
        {type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
        <span className="leading-tight">{message}</span>
      </div>
    </div>
  );
};

// =====================================================================
// SESSION (localStorage) -- BEDA dari admin token URL (koprodi/fakultas)
// karena ini benar-benar login: token 12 jam, dipegang browser, bukan
// dibagikan lewat link.
// =====================================================================
const SESSION_KEY = 'sidampak_superadmin_session';
const superAdminSession = {
  save(token, nama, email) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token, nama, email, savedAt: Date.now() }));
  },
  get() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },
  clear() { localStorage.removeItem(SESSION_KEY); },
};

// =====================================================================
// LOGIN VIEW
// =====================================================================
const SuperAdminLoginView = ({ onLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Email dan kata sandi wajib diisi.'); return; }
    setError('');
    setIsSubmitting(true);
    try {
      const result = await api.adminUniversitasLogin(email.trim(), password);
      superAdminSession.save(result.token, result.nama, result.email);
      onLoggedIn(result.token, result.nama);
    } catch (err) {
      setError(err.message || 'Login gagal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[420px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-b-[3rem] shadow-lg transform -skew-y-3 -translate-y-20"></div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Universitas</h1>
          <p className="text-indigo-200 text-xs font-medium mt-1">SIDAMPAK &middot; Kampus Berdampak UNTAD</p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl p-7 border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold tracking-wide text-slate-500 uppercase mb-1.5 ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                placeholder="admin@untad.ac.id"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wide text-slate-500 uppercase mb-1.5 ml-1">Kata Sandi</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="••••••••"
                  className="w-full p-3.5 pr-11 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-60"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-3.5 text-slate-400">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-rose-500 text-xs font-medium flex items-center gap-1.5 bg-rose-50 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 text-white font-bold p-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 mt-2"
            >
              {isSubmitting ? <><ButtonSpinner /> Memeriksa...</> : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-8">
          © PMM UNTAD 2026 &middot; Akses Terbatas
        </p>
      </div>
    </div>
  );
};

// =====================================================================
// KARTU RINGKASAN
// =====================================================================
const StatCard = ({ icon: Icon, value, label, tone }) => (
  <div className={`rounded-2xl p-4 border flex flex-col items-center justify-center ${tone}`}>
    <Icon className="w-4 h-4 mb-1 opacity-80" />
    <p className="text-xl font-black">{value}</p>
    <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-80 text-center">{label}</p>
  </div>
);

// =====================================================================
// TAB: RINGKASAN
// =====================================================================
const RingkasanTab = ({ mahasiswaList, fakultasOptions, onRefresh, isLoading }) => {
  const summary = useMemo(() => {
    const total = mahasiswaList.length;
    const laporanDisetujui = mahasiswaList.filter(m => m.statusLaporan === 'Disetujui').length;
    const logbookPending = mahasiswaList.reduce((acc, m) => acc + (m.logbookCount?.pending || 0), 0);
    const perluPerhatian = mahasiswaList.filter(m => m.isAtRisk).length;
    // DPL unik (berdasarkan NUPTK) yang benar-benar sedang membimbing
    // -- mahasiswa tanpa DPL (dplNuptk kosong) tidak ikut dihitung.
    const dplSet = new Set(mahasiswaList.filter(m => m.dplNuptk).map(m => m.dplNuptk));
    return { total, laporanDisetujui, logbookPending, perluPerhatian, dplTerlibat: dplSet.size };
  }, [mahasiswaList]);

  const rekapFakultas = useMemo(() => {
    const map = {};
    mahasiswaList.forEach(m => {
      const key = m.fakultas || 'Tanpa Fakultas';
      if (!map[key]) map[key] = { fakultas: key, jumlah: 0, laporanDisetujui: 0, perluPerhatian: 0, totalProgress: 0 };
      map[key].jumlah += 1;
      if (m.statusLaporan === 'Disetujui') map[key].laporanDisetujui += 1;
      if (m.isAtRisk) map[key].perluPerhatian += 1;
      map[key].totalProgress += (m.progressPercentage || 0);
    });
    return Object.values(map)
      .map(r => ({ ...r, avgProgress: r.jumlah > 0 ? Math.round(r.totalProgress / r.jumlah) : 0 }))
      .sort((a, b) => b.jumlah - a.jumlah);
  }, [mahasiswaList]);

  const rekapJenisProgram = useMemo(() => {
    const map = {};
    mahasiswaList.forEach(m => {
      const key = m.jenisProgram || 'Belum Ditentukan';
      if (!map[key]) map[key] = { jenisProgram: key, jumlah: 0, laporanDisetujui: 0, perluPerhatian: 0, totalProgress: 0 };
      map[key].jumlah += 1;
      if (m.statusLaporan === 'Disetujui') map[key].laporanDisetujui += 1;
      if (m.isAtRisk) map[key].perluPerhatian += 1;
      map[key].totalProgress += (m.progressPercentage || 0);
    });
    return Object.values(map)
      .map(r => ({ ...r, avgProgress: r.jumlah > 0 ? Math.round(r.totalProgress / r.jumlah) : 0 }))
      .sort((a, b) => b.jumlah - a.jumlah);
  }, [mahasiswaList]);

  // Rekap per DPL -- dikelompokkan berdasarkan NUPTK (identitas asli),
  // ditampilkan pakai nama. Mahasiswa yang belum punya DPL masuk
  // kelompok "Belum Ditentukan" -- ini yang paling penting dipantau,
  // karena tanpa DPL logbook tidak akan pernah bisa disetujui.
  const rekapDpl = useMemo(() => {
    const map = {};
    mahasiswaList.forEach(m => {
      const key = m.dplNuptk || 'Belum Ditentukan';
      const nama = m.dplNuptk ? (m.dplNama || 'Tanpa Nama') : 'Belum Ditentukan';
      if (!map[key]) map[key] = { nuptk: key, nama, jumlah: 0, laporanDisetujui: 0, perluPerhatian: 0, totalProgress: 0 };
      map[key].jumlah += 1;
      if (m.statusLaporan === 'Disetujui') map[key].laporanDisetujui += 1;
      if (m.isAtRisk) map[key].perluPerhatian += 1;
      map[key].totalProgress += (m.progressPercentage || 0);
    });
    return Object.values(map)
      .map(r => ({ ...r, avgProgress: r.jumlah > 0 ? Math.round(r.totalProgress / r.jumlah) : 0 }))
      .sort((a, b) => b.jumlah - a.jumlah);
  }, [mahasiswaList]);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={onRefresh} disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg disabled:opacity-50">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Muat Ulang
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard icon={Users} value={summary.total} label="Total Mahasiswa" tone="bg-white border-slate-100" />
        <StatCard icon={CheckCircle} value={summary.laporanDisetujui} label="Laporan Disetujui" tone="bg-emerald-50 border-emerald-100 text-emerald-700" />
        <StatCard icon={FileText} value={summary.logbookPending} label="Logbook Pending" tone="bg-amber-50 border-amber-100 text-amber-700" />
        <StatCard icon={AlertCircle} value={summary.perluPerhatian} label="Perlu Perhatian" tone="bg-rose-50 border-rose-100 text-rose-700" />
        <StatCard icon={GraduationCap} value={summary.dplTerlibat} label="DPL Terlibat" tone="bg-indigo-50 border-indigo-100 text-indigo-700" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-500" /> Rekap per Fakultas
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase">Fakultas</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Mahasiswa</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Laporan OK</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Perlu Perhatian</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Rata Progres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rekapFakultas.map(r => (
                <tr key={r.fakultas} className="hover:bg-slate-50">
                  <td className="p-3 text-xs font-semibold text-slate-700">{r.fakultas}</td>
                  <td className="p-3 text-xs font-bold text-slate-800 text-center">{r.jumlah}</td>
                  <td className="p-3 text-xs font-bold text-emerald-600 text-center">{r.laporanDisetujui}</td>
                  <td className="p-3 text-xs font-bold text-rose-600 text-center">{r.perluPerhatian || '-'}</td>
                  <td className="p-3 text-xs font-bold text-indigo-600 text-center">{r.avgProgress}%</td>
                </tr>
              ))}
              {rekapFakultas.length === 0 && (
                <tr><td colSpan="5" className="p-6 text-center text-xs text-slate-400">Belum ada data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" /> Rekap per Jenis Program
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase">Jenis Program</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Mahasiswa</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Laporan OK</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Perlu Perhatian</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Rata Progres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rekapJenisProgram.map(r => (
                <tr key={r.jenisProgram} className="hover:bg-slate-50">
                  <td className="p-3 text-xs font-semibold text-slate-700">{r.jenisProgram}</td>
                  <td className="p-3 text-xs font-bold text-slate-800 text-center">{r.jumlah}</td>
                  <td className="p-3 text-xs font-bold text-emerald-600 text-center">{r.laporanDisetujui}</td>
                  <td className="p-3 text-xs font-bold text-rose-600 text-center">{r.perluPerhatian || '-'}</td>
                  <td className="p-3 text-xs font-bold text-indigo-600 text-center">{r.avgProgress}%</td>
                </tr>
              ))}
              {rekapJenisProgram.length === 0 && (
                <tr><td colSpan="5" className="p-6 text-center text-xs text-slate-400">Belum ada data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-500" /> Rekap per DPL
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase">Nama DPL</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Bimbingan</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Laporan OK</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Perlu Perhatian</th>
                <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">Rata Progres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rekapDpl.map(r => (
                <tr key={r.nuptk} className={`hover:bg-slate-50 ${r.nuptk === 'Belum Ditentukan' ? 'bg-rose-50/30' : ''}`}>
                  <td className={`p-3 text-xs font-semibold ${r.nuptk === 'Belum Ditentukan' ? 'text-rose-600' : 'text-slate-700'}`}>{r.nama}</td>
                  <td className="p-3 text-xs font-bold text-slate-800 text-center">{r.jumlah}</td>
                  <td className="p-3 text-xs font-bold text-emerald-600 text-center">{r.laporanDisetujui}</td>
                  <td className="p-3 text-xs font-bold text-rose-600 text-center">{r.perluPerhatian || '-'}</td>
                  <td className="p-3 text-xs font-bold text-indigo-600 text-center">{r.avgProgress}%</td>
                </tr>
              ))}
              {rekapDpl.length === 0 && (
                <tr><td colSpan="5" className="p-6 text-center text-xs text-slate-400">Belum ada data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// KARTU MAHASISWA (dipakai di tab Data Mahasiswa) -- pola sama dengan
// AdminFakultasView.jsx
// =====================================================================
const buildSenderLabel = () => 'Admin Universitas';
const buildGreetingMessage = (m) => `Halo ${m.nama} (${m.nim})\n\nSalam,\n${buildSenderLabel()}`;
const buildReminderMessage = (m) =>
  `Halo ${m.nama} (${m.nim}),\n\n` +
  `Kami memantau progres pengisian Logbook Kampus Berdampak Anda saat ini baru ${m.progressPercentage}% dari target jam, ` +
  `sementara waktu penugasan sudah berjalan ${m.timePercentage ?? '-'}%. Mohon segera melengkapi pengisian logbook agar tidak tertinggal dari jadwal penugasan.\n\n` +
  `Terima kasih atas perhatian dan kerja samanya.\n\nSalam,\n${buildSenderLabel()}`;
// Prioritas TERTINGGI -- kalau Mitra belum diisi, progres jam/waktu
// (isAtRisk) belum berarti apa-apa (biasanya tglAwal/tglAkhir juga
// belum terisi karena satu form yang sama). Ajak lengkapi profil dulu,
// bukan ditegur soal logbook yang memang belum bisa dipetakan tanpa
// penugasan yang jelas.
const buildCompleteProfileMessage = (m) =>
  `Halo ${m.nama} (${m.nim}),\n\n` +
  `Kami melihat data penugasan (Mitra & Lokasi) Anda pada program Kampus Berdampak belum diisi. ` +
  `Mohon segera melengkapi profil Anda di aplikasi SIDAMPAK agar proses rekognisi SKS dapat berjalan.\n\n` +
  `Terima kasih atas perhatian dan kerja samanya.\n\nSalam,\n${buildSenderLabel()}`;

const MahasiswaCard = ({ m, onOpenDetail }) => {
  const mitraKosong = !m.mitra;
  const waMessage = mitraKosong ? buildCompleteProfileMessage(m) : (m.isAtRisk ? buildReminderMessage(m) : buildGreetingMessage(m));
  const waHref = waLink(m.wa, waMessage);
  const waLabel = mitraKosong ? 'Ingatkan Lengkapi Profil' : (m.isAtRisk ? 'Ingatkan Isi Logbook' : 'Kirim Pesan WA');
  const waTone = mitraKosong ? 'bg-amber-500 text-white hover:bg-amber-600' : (m.isAtRisk ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100');
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(m.nim)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(m.nim); } }}
      className="text-left bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all w-full cursor-pointer"
    >
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-800 truncate">{m.nama}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{m.nim} • {m.prodi} • {m.fakultas}</p>
        </div>
        {mitraKosong ? (
          <span className="shrink-0 flex items-center gap-1 bg-amber-50 text-amber-700 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            <AlertCircle className="w-3 h-3" /> Profil Belum Lengkap
          </span>
        ) : m.isAtRisk && (
          <span className="shrink-0 flex items-center gap-1 bg-rose-50 text-rose-600 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            <AlertCircle className="w-3 h-3" /> Perhatian
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
        <span className={`truncate ${mitraKosong ? 'text-amber-600 font-semibold' : ''}`}>{m.mitra || 'Mitra belum diisi'}</span>
      </div>
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Progres Rekognisi</span>
          <span className="text-xs font-black text-indigo-600">{m.progressPercentage}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${m.progressPercentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${m.progressPercentage}%` }} />
        </div>
        <p className="text-[10px] font-bold text-slate-400 mt-1">{m.currentHours}/{m.targetHours} Jam</p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(m.statusLaporan)}`}>
          Laporan: {m.statusLaporan}
        </span>
        {m.logbookCount.pending > 0 && (
          <span className="text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
            {m.logbookCount.pending} Logbook Pending
          </span>
        )}
        {m.dokumenLengkap < 5 && (
          <span className="text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider bg-slate-100 text-slate-500 flex items-center gap-1">
            <FileWarning className="w-3 h-3" /> Dokumen {m.dokumenLengkap}/5
          </span>
        )}
      </div>
      {waHref ? (
        <a href={waHref} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${waTone}`}>
          <FaWhatsapp className="w-3.5 h-3.5" /> {waLabel}
        </a>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-400">
          <FaWhatsapp className="w-3.5 h-3.5" /> Nomor WA Belum Ada
        </div>
      )}
    </div>
  );
};

const DOKUMEN_LABELS = {
  suratTugas: 'Surat Tugas Mahasiswa', skDpl: 'SK Pengangkatan DPL', kerjasama: 'Kerjasama Mitra - Prodi',
  rps: 'Rencana Pembelajaran (RPS)', krs: 'KRS SIGA-8',
};

const EditField = ({ label, value, onChange, disabled }) => (
  <div>
    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{label}</label>
    <input value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400" />
  </div>
);

const MahasiswaDetailView = ({ nim, token, onClose, showToast }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [masterData, setMasterData] = useState({ fakultas: [], prodi: [] });

  const [editingIdentitas, setEditingIdentitas] = useState(false);
  const [identitasForm, setIdentitasForm] = useState(null);
  const [savingIdentitas, setSavingIdentitas] = useState(false);

  const [editingMentor, setEditingMentor] = useState(false);
  const [mentorForm, setMentorForm] = useState(null);
  const [savingMentor, setSavingMentor] = useState(false);

  const [editingDpl, setEditingDpl] = useState(false);
  const [dplForm, setDplForm] = useState(null);
  const [savingDpl, setSavingDpl] = useState(false);

  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [resetCopied, setResetCopied] = useState(false);

  const loadDetail = useCallback(() => {
    setIsLoading(true);
    setError('');
    return api.getMahasiswaDetailForAdmin(nim, token)
      .then((d) => {
        setData(d);
        setIdentitasForm({ nama: d.profile.nama, wa: d.profile.wa, email: d.profile.email, prodi: d.profile.prodi, fakultas: d.profile.fakultas });
        setMentorForm({ nama: d.profile.mentorNama, jabatan: d.profile.mentorJabatan, wa: d.profile.mentorWa, namaMitra: d.profile.mitra });
        setDplForm({ nama: d.profile.dplNama, jabatan: d.profile.dplJabatan, wa: d.profile.dplWa, email: d.profile.dplEmail });
      })
      .catch((err) => setError(err.message || 'Gagal memuat detail mahasiswa.'))
      .finally(() => setIsLoading(false));
  }, [nim, token]);

  useEffect(() => {
    let cancelled = false;
    loadDetail();
    api.getMasterData().then((m) => { if (!cancelled) setMasterData({ fakultas: m.fakultas || [], prodi: m.prodi || [] }); }).catch(() => {});
    return () => { cancelled = true; };
  }, [loadDetail]);

  const handleSaveIdentitas = async () => {
    setSavingIdentitas(true);
    try {
      await api.superAdminUpdateMahasiswa(token, { nim, ...identitasForm });
      showToast('Data identitas berhasil disimpan.');
      setEditingIdentitas(false);
      await loadDetail();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan.', 'error');
    } finally {
      setSavingIdentitas(false);
    }
  };

  const handleSaveMentor = async () => {
    setSavingMentor(true);
    try {
      await api.superAdminUpdateMentor(token, { email: data.profile.mentorEmail, ...mentorForm });
      showToast('Data mentor berhasil disimpan.');
      setEditingMentor(false);
      await loadDetail();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan.', 'error');
    } finally {
      setSavingMentor(false);
    }
  };

  const handleSaveDpl = async () => {
    setSavingDpl(true);
    try {
      await api.superAdminUpdateDosen(token, { nuptk: data.profile.dplNuptk, ...dplForm });
      showToast('Data DPL berhasil disimpan.');
      setEditingDpl(false);
      await loadDetail();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan.', 'error');
    } finally {
      setSavingDpl(false);
    }
  };

  const handleResetPassword = async () => {
    if (!window.confirm(`Reset kata sandi ${data.profile.nama}? Kata sandi lama langsung tidak berlaku.`)) return;
    setIsResetting(true);
    setResetResult(null);
    try {
      const result = await api.superAdminResetMahasiswaPassword(token, nim);
      setResetResult(result.newPassword);
    } catch (err) {
      showToast(err.message || 'Gagal mereset kata sandi.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const copyResetPassword = () => {
    navigator.clipboard.writeText(resetResult);
    setResetCopied(true);
    setTimeout(() => setResetCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-right-10 duration-300">
      <div className="bg-white px-4 sm:px-6 pt-6 pb-4 shadow-sm border-b border-slate-100 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-2 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-lg font-extrabold text-slate-800 tracking-tight truncate">{data?.profile?.nama || 'Detail Mahasiswa'}</h1>
      </div>

      {isLoading && <PageLoader label="Memuat detail..." />}
      {!isLoading && error && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
          <p className="text-sm font-bold text-slate-700 mb-1">Gagal memuat data</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      )}

      {!isLoading && !error && data && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-10">
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Identitas & Penugasan</h2>
              {!editingIdentitas ? (
                <button onClick={() => setEditingIdentitas(true)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
              ) : (
                <button onClick={() => { setEditingIdentitas(false); setIdentitasForm({ nama: data.profile.nama, wa: data.profile.wa, email: data.profile.email, prodi: data.profile.prodi, fakultas: data.profile.fakultas }); }} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>

            {!editingIdentitas ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">NIM</p><p className="font-semibold text-slate-800">{data.profile.nim}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Fakultas</p><p className="font-semibold text-slate-800">{data.profile.fakultas}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Prodi</p><p className="font-semibold text-slate-800">{data.profile.prodi}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Email</p><p className="font-semibold text-slate-800 truncate">{data.profile.email || '-'}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp</p>
                  {data.profile.wa ? <a href={waLink(data.profile.wa)} target="_blank" rel="noreferrer" className="font-semibold text-emerald-600 flex items-center gap-1"><FaWhatsapp /> {data.profile.wa}</a> : <p className="font-semibold text-slate-400">-</p>}
                </div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Jenis Program</p><p className="font-semibold text-slate-800">{data.profile.jenisProgram || '-'}</p></div>
                <div className="col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase">Mitra</p><p className="font-semibold text-slate-800">{data.profile.mitra || '-'}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Mulai Tugas</p><p className="font-semibold text-slate-800">{formatDateIndoShort(data.profile.tglAwal)}</p></div>
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Selesai Tugas</p><p className="font-semibold text-slate-800">{formatDateIndoShort(data.profile.tglAkhir)}</p></div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-3 rounded-xl">
                <div className="grid grid-cols-1 gap-3">
                  <EditField label="NIM (tidak bisa diubah)" value={data.profile.nim} disabled />
                  <EditField label="Nama" value={identitasForm.nama} onChange={v => setIdentitasForm(f => ({ ...f, nama: v }))} />
                  <EditField label="WhatsApp" value={identitasForm.wa} onChange={v => setIdentitasForm(f => ({ ...f, wa: v }))} />
                  <EditField label="Email" value={identitasForm.email} onChange={v => setIdentitasForm(f => ({ ...f, email: v }))} />
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fakultas</label>
                    <select value={identitasForm.fakultas || ''} onChange={e => setIdentitasForm(f => ({ ...f, fakultas: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Pilih Fakultas...</option>
                      {masterData.fakultas.map((f, i) => {
                        const namaF = typeof f === 'string' ? f : f.NamaFakultas;
                        return <option key={i} value={namaF}>{namaF}</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Prodi</label>
                    <select value={identitasForm.prodi || ''} onChange={e => setIdentitasForm(f => ({ ...f, prodi: e.target.value }))}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Pilih Prodi...</option>
                      {masterData.prodi.map((p, i) => {
                        const namaP = p.nama || p.NamaProdi;
                        return <option key={i} value={namaP}>{namaP}</option>;
                      })}
                    </select>
                  </div>
                </div>
                <button onClick={handleSaveIdentitas} disabled={savingIdentitas}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                  {savingIdentitas ? <><ButtonSpinner /> Menyimpan...</> : 'Simpan Perubahan'}
                </button>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100">
              {!resetResult ? (
                <button onClick={handleResetPassword} disabled={isResetting}
                  className="w-full py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                  {isResetting ? <><ButtonSpinner /> Mereset...</> : <><KeyRound className="w-3.5 h-3.5" /> Reset Kata Sandi</>}
                </button>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1.5">Kata sandi baru (hanya tampil sekali):</p>
                  <p className="text-sm font-mono font-bold text-slate-800 mb-2">{resetResult}</p>
                  <div className="flex gap-2">
                    <button onClick={copyResetPassword} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                      {resetCopied ? <><Check className="w-3.5 h-3.5" /> Tersalin</> : <><Copy className="w-3.5 h-3.5" /> Salin</>}
                    </button>
                    {data.profile.wa && (
                      <a href={waLink(data.profile.wa, `Halo ${data.profile.nama}, kata sandi SIDAMPAK Anda telah direset. Kata sandi baru: ${resetResult}`)} target="_blank" rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-500 px-3 py-1.5 rounded-lg">
                        <FaWhatsapp className="w-3.5 h-3.5" /> Kirim WA
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Mentor & DPL</h2>
            </div>
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Mentor</p>
                  <div className="flex items-center gap-1.5">
                    {data.profile.mentorWa && !editingMentor && <a href={waLink(data.profile.mentorWa)} target="_blank" rel="noreferrer" className="p-1.5 bg-emerald-500 text-white rounded-lg"><FaWhatsapp className="w-3 h-3" /></a>}
                    {data.profile.mentorEmail && (
                      editingMentor
                        ? <button onClick={() => setEditingMentor(false)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg"><X className="w-3 h-3" /></button>
                        : <button onClick={() => setEditingMentor(true)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Pencil className="w-3 h-3" /></button>
                    )}
                  </div>
                </div>
                {!editingMentor ? (
                  <p className="font-semibold text-slate-800 text-sm truncate">{data.profile.mentorNama || 'Belum diisi'}</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    <EditField label="Nama" value={mentorForm.nama} onChange={v => setMentorForm(f => ({ ...f, nama: v }))} />
                    <EditField label="Jabatan" value={mentorForm.jabatan} onChange={v => setMentorForm(f => ({ ...f, jabatan: v }))} />
                    <EditField label="WhatsApp" value={mentorForm.wa} onChange={v => setMentorForm(f => ({ ...f, wa: v }))} />
                    <EditField label="Nama Mitra" value={mentorForm.namaMitra} onChange={v => setMentorForm(f => ({ ...f, namaMitra: v }))} />
                    <button onClick={handleSaveMentor} disabled={savingMentor} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                      {savingMentor ? <ButtonSpinner /> : 'Simpan'}
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">DPL</p>
                  <div className="flex items-center gap-1.5">
                    {data.profile.dplWa && !editingDpl && <a href={waLink(data.profile.dplWa)} target="_blank" rel="noreferrer" className="p-1.5 bg-emerald-500 text-white rounded-lg"><FaWhatsapp className="w-3 h-3" /></a>}
                    {data.profile.dplNuptk && (
                      editingDpl
                        ? <button onClick={() => setEditingDpl(false)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg"><X className="w-3 h-3" /></button>
                        : <button onClick={() => setEditingDpl(true)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Pencil className="w-3 h-3" /></button>
                    )}
                  </div>
                </div>
                {!editingDpl ? (
                  <p className="font-semibold text-slate-800 text-sm truncate">{data.profile.dplNama || 'Belum diisi'}</p>
                ) : (
                  <div className="space-y-2 mt-2">
                    <EditField label="Nama & Gelar" value={dplForm.nama} onChange={v => setDplForm(f => ({ ...f, nama: v }))} />
                    <EditField label="Jabatan" value={dplForm.jabatan} onChange={v => setDplForm(f => ({ ...f, jabatan: v }))} />
                    <EditField label="WhatsApp" value={dplForm.wa} onChange={v => setDplForm(f => ({ ...f, wa: v }))} />
                    <EditField label="Email Kampus" value={dplForm.email} onChange={v => setDplForm(f => ({ ...f, email: v }))} />
                    <button onClick={handleSaveDpl} disabled={savingDpl} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-70">
                      {savingDpl ? <ButtonSpinner /> : 'Simpan'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Progres per Matakuliah</h2>
            {data.mkProgress.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Belum ada matakuliah direkognisi.</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.mkProgress.map(mk => (
                  <div key={mk.id} className="bg-slate-50 p-3 rounded-2xl flex flex-col items-center text-center">
                    <div className="relative w-14 h-14 mb-2">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path strokeDasharray="100,100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#E2E8F0" strokeWidth="3.5" />
                        <path strokeDasharray={`${mk.percentage},100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={mk.percentage === 100 ? '#10B981' : '#6366F1'} strokeWidth="3.5" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-700">{mk.percentage}%</div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-700 line-clamp-2 leading-tight">{mk.nama}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1">{mk.currentHours}/{mk.targetHours} Jam</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Dokumen Pendukung</h2>
            <div className="space-y-2">
              {Object.keys(DOKUMEN_LABELS).map(key => {
                const link = data.profile.dokumen ? data.profile.dokumen[key] : '';
                return (
                  <div key={key} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                    <span className="text-xs font-semibold text-slate-700">{DOKUMEN_LABELS[key]}</span>
                    {link ? <a href={link} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">Lihat</a> : <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-lg">Belum ada</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Laporan Akhir</h2>
            {data.laporan ? (
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                <div className="min-w-0">
                  <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(data.laporan.status)}`}>{data.laporan.status}</span>
                  <p className="text-xs font-semibold text-slate-700 mt-1 truncate">{data.laporan.fileName}</p>
                </div>
                {data.laporan.fileLink && <a href={data.laporan.fileLink} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">Buka</a>}
              </div>
            ) : <p className="text-sm text-slate-400 text-center py-4">Belum disubmit.</p>}
          </div>

          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Riwayat Logbook ({data.logbooks.length})</h2>
            {data.logbooks.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Belum ada aktivitas.</p> : (
              <div className="space-y-3">
                {data.logbooks.map(lb => (
                  <div key={lb.id} className="bg-slate-50 p-3 rounded-xl">
                    <div className="flex justify-between items-start mb-1.5">
                      <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(lb.status)}`}>{lb.status}</span>
                      <span className="text-[10px] font-bold text-slate-400">{formatDateIndoShort(lb.tanggal)} • {lb.durasi} Jam</span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">{lb.kegiatan.join(', ')}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{lb.deskripsi}</p>
                    {lb.status.includes('Revisi') && lb.catatanRevisi && (
                      <p className="text-[10px] text-rose-600 font-semibold mt-2 bg-rose-50 p-2 rounded-lg">Catatan: {lb.catatanRevisi}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// TAB: DATA MAHASISWA (lintas universitas, filter Fakultas -> Prodi)
// =====================================================================
const MahasiswaTab = ({ token, showToast }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [mahasiswaList, setMahasiswaList] = useState([]);
  const [tahunAjaranList, setTahunAjaranList] = useState([]);
  const [selectedTahun, setSelectedTahun] = useState('');
  const [fakultasOptions, setFakultasOptions] = useState([]);
  const [prodiOptions, setProdiOptions] = useState([]);
  const [selectedFakultas, setSelectedFakultas] = useState('semua');
  const [selectedProdi, setSelectedProdi] = useState('semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [onlyMitraKosong, setOnlyMitraKosong] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage] = useState(12);
  const [selectedNim, setSelectedNim] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    const applyData = (data) => {
      setMahasiswaList(data.mahasiswa || []);
      setTahunAjaranList(data.tahunAjaranList || []);
      setFakultasOptions(data.fakultasOptions || []);
      setProdiOptions(data.prodiOptions || []);
      if (!selectedTahun && data.tahunAjaranAktifId) setSelectedTahun(data.tahunAjaranAktifId);
    };
    try {
      const data = await api.getSuperAdminData(token, {
        tahunAjaranId: selectedTahun,
        fakultas: selectedFakultas === 'semua' ? '' : selectedFakultas,
      }, {
        // Filter yang sama pernah dibuka -> tampil instan dari cache,
        // sambil fetch fresh tetap jalan di belakang.
        onCacheHit: (cached) => { applyData(cached); setIsLoading(false); },
      });
      applyData(data);
    } catch (err) {
      setError(err.message || 'Gagal memuat data mahasiswa.');
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedTahun, selectedFakultas]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset prodi terpilih kalau fakultas berubah (prodi lama mungkin sudah tidak relevan)
  useEffect(() => { setSelectedProdi('semua'); }, [selectedFakultas]);

  const prodiOptionsForFakultas = useMemo(() => {
    if (selectedFakultas === 'semua') return prodiOptions;
    return [...new Set(mahasiswaList.filter(m => m.fakultas === selectedFakultas).map(m => m.prodi))].sort((a, b) => a.localeCompare(b, 'id'));
  }, [prodiOptions, mahasiswaList, selectedFakultas]);

  const filteredData = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    let rows = mahasiswaList.filter(m =>
      (m.nama || '').toLowerCase().includes(term) || (m.nim || '').toLowerCase().includes(term) || (m.mitra || '').toLowerCase().includes(term)
    );
    if (selectedProdi !== 'semua') rows = rows.filter(m => m.prodi === selectedProdi);
    if (statusFilter !== 'semua') rows = rows.filter(m => m.statusLaporan === statusFilter);
    if (onlyAtRisk) rows = rows.filter(m => m.isAtRisk);
    if (onlyMitraKosong) rows = rows.filter(m => !m.mitra);
    rows.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
    return rows;
  }, [mahasiswaList, searchTerm, selectedProdi, statusFilter, onlyAtRisk, onlyMitraKosong]);

  const totalPages = Math.ceil(filteredData.length / entriesPerPage) || 1;
  const currentEntries = filteredData.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const tahunLabel = tahunAjaranList.find(t => t.id === selectedTahun)?.label || 'Semua';
      const sheetMahasiswa = filteredData.map(m => ({
        NIM: m.nim, Nama: m.nama, WhatsApp: m.wa, Email: m.email, Prodi: m.prodi, Fakultas: m.fakultas,
        'Jenis Program': m.jenisProgram, 'Nama Program': m.namaProgram, Mitra: m.mitra, Lokasi: m.lokasi,
        'Tgl Mulai': formatDateIndoShort(m.tglAwal), 'Tgl Selesai': formatDateIndoShort(m.tglAkhir),
        'Nama Mentor': m.mentorNama, 'WA Mentor': m.mentorWa, 'Email Mentor': m.mentorEmail,
        'Nama DPL': m.dplNama, 'NUPTK DPL': m.dplNuptk, 'WA DPL': m.dplWa, 'Email DPL': m.dplEmail,
        'Jam Tercapai': m.currentHours, 'Target Jam': m.targetHours, 'Progres (%)': m.progressPercentage,
        'Progres Waktu (%)': m.timePercentage ?? '-', 'Perlu Perhatian': m.isAtRisk ? 'Ya' : 'Tidak',
        'Logbook Total': m.logbookCount.total, 'Logbook Disetujui': m.logbookCount.disetujui,
        'Logbook Pending': m.logbookCount.pending, 'Logbook Revisi': m.logbookCount.revisi, 'Logbook Draf': m.logbookCount.draft,
        'Aktivitas Terakhir': formatDateIndoShort(m.lastLogbookDate), 'Status Laporan': m.statusLaporan, 'Link Laporan': m.laporanFileLink || '-',
        'Kelengkapan Dokumen': `${m.dokumenLengkap}/5`, 'Link Surat Tugas': m.dokumen.suratTugas || '-', 'Link SK DPL': m.dokumen.skDpl || '-',
        'Link Kerjasama': m.dokumen.kerjasama || '-', 'Link RPS': m.dokumen.rps || '-', 'Link KRS': m.dokumen.krs || '-',
      }));
      const wsMahasiswa = XLSX.utils.json_to_sheet(sheetMahasiswa);
      wsMahasiswa['!cols'] = Object.keys(sheetMahasiswa[0] || {}).map(() => ({ wch: 20 }));

      const sheetMk = [];
      filteredData.forEach(m => (m.mataKuliah || []).forEach(mk => {
        sheetMk.push({ NIM: m.nim, Nama: m.nama, Fakultas: m.fakultas, Prodi: m.prodi, 'Kode MK': mk.kode, 'Nama Matakuliah': mk.nama, SKS: mk.sks, 'Target Jam': mk.targetHours, 'Jam Tercapai': mk.currentHours, 'Progres (%)': mk.percentage });
      }));
      const wsMk = XLSX.utils.json_to_sheet(sheetMk);

      const rekapByFakultas = {};
      filteredData.forEach(m => {
        const key = m.fakultas || 'Tanpa Fakultas';
        if (!rekapByFakultas[key]) rekapByFakultas[key] = { fakultas: key, jumlah: 0, laporanDisetujui: 0, perluPerhatian: 0, totalProgress: 0 };
        rekapByFakultas[key].jumlah += 1;
        if (m.statusLaporan === 'Disetujui') rekapByFakultas[key].laporanDisetujui += 1;
        if (m.isAtRisk) rekapByFakultas[key].perluPerhatian += 1;
        rekapByFakultas[key].totalProgress += (m.progressPercentage || 0);
      });
      const rekapRows = Object.values(rekapByFakultas).map(r => ({
        Fakultas: r.fakultas, 'Jumlah Mahasiswa': r.jumlah, 'Laporan Disetujui': r.laporanDisetujui, 'Perlu Perhatian': r.perluPerhatian,
        'Rata-rata Progres (%)': r.jumlah > 0 ? Math.round(r.totalProgress / r.jumlah) : 0,
      }));
      const wsRekap = XLSX.utils.json_to_sheet(rekapRows);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsMahasiswa, 'Data Mahasiswa');
      XLSX.utils.book_append_sheet(wb, wsMk, 'Detail Mata Kuliah');
      XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Fakultas');
      XLSX.writeFile(wb, `SIDAMPAK_Universitas_${tahunLabel}_${Date.now()}.xlsx`.replace(/\s+/g, '_'));
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && mahasiswaList.length === 0) return <div className="py-16"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" /></div>;
  if (error) return (
    <div className="bg-white p-8 rounded-2xl text-center border border-slate-100">
      <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
      <p className="text-sm font-bold text-slate-700 mb-3">{error}</p>
      <button onClick={loadData} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl">Coba Lagi</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Cari nama, NIM, atau mitra..." value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <select value={selectedTahun} onChange={e => { setSelectedTahun(e.target.value); setCurrentPage(1); }}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold outline-none cursor-pointer">
              <option value="">Semua Tahun Ajaran</option>
              {tahunAjaranList.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedFakultas} onChange={e => { setSelectedFakultas(e.target.value); setCurrentPage(1); }}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer max-w-[180px]">
              <option value="semua">Semua Fakultas</option>
              {fakultasOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedProdi} onChange={e => { setSelectedProdi(e.target.value); setCurrentPage(1); }}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer max-w-[180px]">
              <option value="semua">Semua Prodi</option>
              {prodiOptionsForFakultas.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <GraduationCap className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer">
              <option value="semua">Semua Status Laporan</option>
              <option value="Disetujui">Disetujui</option>
              <option value="Menunggu Persetujuan Mentor">Menunggu Mentor</option>
              <option value="Menunggu Persetujuan DPL">Menunggu DPL</option>
              <option value="Belum Disubmit">Belum Disubmit</option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button onClick={() => { setOnlyAtRisk(v => !v); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${onlyAtRisk ? 'bg-rose-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
            <AlertCircle className="w-3.5 h-3.5" /> Perlu Perhatian {onlyAtRisk && <X className="w-3 h-3" />}
          </button>
          <button onClick={() => { setOnlyMitraKosong(v => !v); setCurrentPage(1); }}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${onlyMitraKosong ? 'bg-amber-500 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}>
            <FileWarning className="w-3.5 h-3.5" /> Mitra Belum Diisi {onlyMitraKosong && <X className="w-3 h-3" />}
          </button>
          <button onClick={loadData} disabled={isLoading} title="Muat ulang data terbaru"
            className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl disabled:opacity-50">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleExportExcel} disabled={isExporting || filteredData.length === 0}
            className="ml-auto flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export ({filteredData.length})
          </button>
        </div>
      </div>

      {currentEntries.length === 0 ? (
        <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100 shadow-sm">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Tidak ada data ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {currentEntries.map(m => <MahasiswaCard key={m.nim} m={m} onOpenDetail={setSelectedNim} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-xs font-medium text-slate-500 pl-2">Hal {currentPage}/{totalPages} • {filteredData.length} data</span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-slate-50 rounded-lg disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-slate-50 rounded-lg disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {selectedNim && <MahasiswaDetailView nim={selectedNim} token={token} onClose={() => setSelectedNim(null)} showToast={showToast} />}
    </div>
  );
};

// =====================================================================
// TAB: MASTER DATA (Fakultas / Prodi / Tahun Ajaran)
// =====================================================================
const MasterDataTab = ({ token, showToast }) => {
  const [fakultasList, setFakultasList] = useState([]);
  const [prodiList, setProdiList] = useState([]);
  const [tahunAjaranList, setTahunAjaranList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subTab, setSubTab] = useState('fakultas');

  const [newFakultas, setNewFakultas] = useState('');
  const [newProdiNama, setNewProdiNama] = useState('');
  const [newProdiFakultas, setNewProdiFakultas] = useState('');
  const [newTahunAjaran, setNewTahunAjaran] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editingFakultas, setEditingFakultas] = useState(null);
  const [editingProdi, setEditingProdi] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const master = await api.getMasterData();
      setFakultasList(master.fakultas || []); // catatan: getMasterData lama hanya kembalikan nama string; lihat kontrak di bawah utk versi ID+nama
      setProdiList(master.prodi || []);
      // getSuperAdminMeta (BUKAN getSuperAdminData) -- cuma butuh daftar
      // Tahun Ajaran di sini, tidak perlu menarik seluruh mahasiswa
      // se-universitas hanya untuk itu. Di-cache 24 jam -- tampil instan
      // begitu tab ini pernah dibuka sebelumnya.
      const meta = await api.getSuperAdminMeta(token, {
        onCacheHit: (cached) => setTahunAjaranList(cached.tahunAjaranList || []),
      });
      setTahunAjaranList(meta.tahunAjaranList || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat master data.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleAddFakultas = async () => {
    if (!newFakultas.trim()) return;
    try {
      await api.superAdminAddFakultas(token, newFakultas.trim());
      setNewFakultas('');
      showToast('Fakultas ditambahkan.');
      load();
    } catch (err) { showToast(err.message || 'Gagal menambah fakultas.', 'error'); }
  };

  const handleDeleteFakultas = async (id) => {
    if (!window.confirm('Hapus fakultas ini? Tidak bisa dihapus kalau masih ada mahasiswa terdaftar.')) return;
    setBusyId(id);
    try {
      await api.superAdminDeleteFakultas(token, id);
      showToast('Fakultas dihapus.');
      load();
    } catch (err) { showToast(err.message || 'Gagal menghapus.', 'error'); } finally { setBusyId(null); }
  };

  const handleAddProdi = async () => {
    if (!newProdiNama.trim() || !newProdiFakultas) return;
    try {
      await api.superAdminAddProdi(token, newProdiNama.trim(), newProdiFakultas);
      setNewProdiNama(''); setNewProdiFakultas('');
      showToast('Program studi ditambahkan.');
      load();
    } catch (err) { showToast(err.message || 'Gagal menambah prodi.', 'error'); }
  };

  const handleDeleteProdi = async (id) => {
    if (!window.confirm('Hapus program studi ini?')) return;
    setBusyId(id);
    try {
      await api.superAdminDeleteProdi(token, id);
      showToast('Program studi dihapus.');
      load();
    } catch (err) { showToast(err.message || 'Gagal menghapus.', 'error'); } finally { setBusyId(null); }
  };

  const handleAddTahunAjaran = async () => {
    if (!newTahunAjaran.trim()) return;
    try {
      await api.superAdminAddTahunAjaran(token, newTahunAjaran.trim());
      setNewTahunAjaran('');
      showToast('Tahun ajaran ditambahkan.');
      load();
    } catch (err) { showToast(err.message || 'Gagal menambah tahun ajaran.', 'error'); }
  };

  const handleSetAktif = async (id) => {
    setBusyId(id);
    try {
      await api.superAdminSetTahunAjaranAktif(token, id);
      showToast('Tahun ajaran aktif diperbarui.');
      load();
    } catch (err) { showToast(err.message || 'Gagal mengubah status.', 'error'); } finally { setBusyId(null); }
  };

  const handleDeleteTahunAjaran = async (id) => {
    if (!window.confirm('Hapus tahun ajaran ini?')) return;
    setBusyId(id);
    try {
      await api.superAdminDeleteTahunAjaran(token, id);
      showToast('Tahun ajaran dihapus.');
      load();
    } catch (err) { showToast(err.message || 'Gagal menghapus.', 'error'); } finally { setBusyId(null); }
  };

  // Spinner PENUH cuma untuk load pertama kali (belum ada data sama
  // sekali) -- saat refresh manual (data lama masih ada), JANGAN
  // blank-kan seluruh tab, cukup ikon spinner kecil di tombol refresh
  // (lihat prop disabled/isLoading pada tombolnya di bawah).
  if (isLoading && fakultasList.length === 0 && prodiList.length === 0) {
    return <div className="py-16"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1 border border-slate-100 flex-1">
          {[['fakultas', 'Fakultas', Building2], ['prodi', 'Program Studi', GraduationCap], ['tahunajaran', 'Tahun Ajaran', BookOpen]].map(([key, label, Icon]) => (
            <button key={key} onClick={() => setSubTab(key)}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${subTab === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        <button onClick={load} disabled={isLoading} title="Muat ulang data terbaru"
          className="p-2 bg-white border border-slate-100 shadow-sm text-slate-600 rounded-2xl disabled:opacity-50 shrink-0">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {subTab === 'fakultas' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex gap-2 mb-4">
            <input value={newFakultas} onChange={e => setNewFakultas(e.target.value)} placeholder="Nama fakultas baru..."
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={handleAddFakultas} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Tambah</button>
          </div>
          <div className="space-y-2">
            {(Array.isArray(fakultasList) ? fakultasList : []).map((f, i) => {
              const nama = typeof f === 'string' ? f : f.NamaFakultas;
              const id = typeof f === 'string' ? null : f.ID;
              return (
                <div key={id || i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                  <span className="text-sm font-semibold text-slate-700">{nama}</span>
                  {id && (
                    <button onClick={() => handleDeleteFakultas(id)} disabled={busyId === id} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-50">
                      {busyId === id ? <ButtonSpinner /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">Catatan: daftar ini gabungan data lama (hardcode) dan yang ditambahkan lewat sini. Fakultas hasil tambahan baru punya tombol hapus; yang lama perlu dirapikan manual di tabel "Fakultas" kalau ingin seragam.</p>
        </div>
      )}

      {subTab === 'prodi' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input value={newProdiNama} onChange={e => setNewProdiNama(e.target.value)} placeholder="Nama prodi baru..."
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={newProdiFakultas} onChange={e => setNewProdiFakultas(e.target.value)}
              className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Pilih Fakultas Induk...</option>
              {(Array.isArray(fakultasList) ? fakultasList : []).map((f, i) => {
                const nama = typeof f === 'string' ? f : f.NamaFakultas;
                return <option key={i} value={nama}>{nama}</option>;
              })}
            </select>
            <button onClick={handleAddProdi} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"><Plus className="w-4 h-4" /> Tambah</button>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {(Array.isArray(prodiList) ? prodiList : []).map((p, i) => {
              const nama = p.nama || p.NamaProdi;
              const fakultas = p.fakultas || p.NamaFakultas;
              const id = p.ID;
              return (
                <div key={id || i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                  <div className="min-w-0"><p className="text-sm font-semibold text-slate-700 truncate">{nama}</p><p className="text-[10px] text-slate-400 truncate">{fakultas}</p></div>
                  {id && (
                    <button onClick={() => handleDeleteProdi(id)} disabled={busyId === id} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-50 shrink-0">
                      {busyId === id ? <ButtonSpinner /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'tahunajaran' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex gap-2 mb-4">
            <input value={newTahunAjaran} onChange={e => setNewTahunAjaran(e.target.value)} placeholder="Cth: TA 2026/2027 Ganjil"
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={handleAddTahunAjaran} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Tambah</button>
          </div>
          <div className="space-y-2">
            {tahunAjaranList.map(t => (
              <div key={t.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-slate-700 truncate">{t.label}</span>
                  {t.aktif && <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg shrink-0">Aktif</span>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {!t.aktif && (
                    <button onClick={() => handleSetAktif(t.id)} disabled={busyId === t.id} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg disabled:opacity-50">
                      {busyId === t.id ? <ButtonSpinner /> : 'Jadikan Aktif'}
                    </button>
                  )}
                  <button onClick={() => handleDeleteTahunAjaran(t.id)} disabled={busyId === t.id} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-50">
                    {busyId === t.id ? <ButtonSpinner /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// TAB: AKSES PORTAL (Koprodi / Admin Fakultas -- generate & cabut)
// =====================================================================
// Pesan WA saat membagikan/membagikan-ulang akses Koprodi/Admin Fakultas
// -- disamakan persis dengan pesan yang dikirim server (buildReminderMessage_-
// style di generateAdminAccessLink_ pada AdminFakultas.gs) supaya konsisten
// terlepas dari jalur mana yang dipakai (gateway otomatis ATAU wa.me manual).
const buildAksesWaMessage = (nama, role, scope, link) =>
  `Halo ${nama},\n\n` +
  `Anda diberi akses ke Portal ${role === 'koprodi' ? 'Koordinator Program Studi' : 'Admin Fakultas'} SIDAMPAK untuk ${scope}.\n\n` +
  `Silakan buka tautan berikut untuk memantau data mahasiswa (tanpa perlu login):\n${link}\n\n` +
  `Simpan tautan ini baik-baik, jangan dibagikan ke pihak lain.`;

// Baris "Akses Aktif" -- komponen terpisah supaya tiap baris punya state
// loading/link sendiri saat tombol "Kirim WA" ditekan (fetch link ulang
// dulu, baru tombol wa.me muncul -- lihat catatan handleSuperAdminGetAdminAksesLink_
// di backend soal kenapa link harus diambil ulang, bukan disimpan).
const AksesRow = ({ a, token, busyId, onRevoke, onReload, showToast }) => {
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [revealLink, setRevealLink] = useState('');
  const [isEditingWa, setIsEditingWa] = useState(false);
  const [waInput, setWaInput] = useState('');
  const [isSavingWa, setIsSavingWa] = useState(false);

  const handleFetchLink = async () => {
    setIsFetchingLink(true);
    try {
      const result = await api.superAdminGetAdminAksesLink(token, a.id);
      setRevealLink(result.link);
    } catch (err) {
      showToast(err.message || 'Gagal mengambil link.', 'error');
    } finally {
      setIsFetchingLink(false);
    }
  };

  const handleSaveWaAndSend = async () => {
    if (!waInput.trim()) { showToast('Nomor WhatsApp wajib diisi.', 'error'); return; }
    setIsSavingWa(true);
    try {
      const result = await api.superAdminUpdateAdminAksesWa(token, a.id, waInput.trim());
      a.wa = result.wa; // update lokal langsung supaya waLink() di bawah pakai nomor baru tanpa nunggu reload
      setRevealLink(result.link);
      setIsEditingWa(false);
      showToast('Nomor WhatsApp tersimpan.');
      onReload();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan nomor.', 'error');
    } finally {
      setIsSavingWa(false);
    }
  };

  const waHref = revealLink ? waLink(a.wa, buildAksesWaMessage(a.nama, a.role, a.scope, revealLink)) : null;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{a.nama}</p>
          <p className="text-[10px] text-slate-400 truncate">
            <span className={`font-bold uppercase ${a.role === 'koprodi' ? 'text-indigo-500' : 'text-emerald-500'}`}>{a.role === 'koprodi' ? 'Koprodi' : 'Admin Fakultas'}</span> • {a.scope}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {!a.wa && !isEditingWa && (
            <button onClick={() => setIsEditingWa(true)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
              <FaWhatsapp className="w-3 h-3" /> Kirim WA
            </button>
          )}
          {a.wa && !revealLink && (
            <button onClick={handleFetchLink} disabled={isFetchingLink}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg disabled:opacity-40 flex items-center gap-1">
              {isFetchingLink ? <ButtonSpinner /> : <><FaWhatsapp className="w-3 h-3" /> Kirim WA</>}
            </button>
          )}
          {revealLink && (
            <a href={waHref} target="_blank" rel="noreferrer" onClick={() => setTimeout(() => setRevealLink(''), 500)}
              className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg flex items-center gap-1">
              <FaWhatsapp className="w-3 h-3" /> Buka WhatsApp
            </a>
          )}
          <button onClick={() => onRevoke(a.id, a.nama)} disabled={busyId === a.id}
            className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg disabled:opacity-50 flex items-center gap-1">
            {busyId === a.id ? <ButtonSpinner /> : <><Trash2 className="w-3 h-3" /> Cabut</>}
          </button>
        </div>
      </div>

      {isEditingWa && (
        <div className="mt-3 flex gap-2">
          <input value={waInput} onChange={e => setWaInput(e.target.value)} placeholder="628... (nomor WhatsApp)" autoFocus
            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={handleSaveWaAndSend} disabled={isSavingWa}
            className="px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl disabled:opacity-70 flex items-center gap-1.5 shrink-0">
            {isSavingWa ? <ButtonSpinner /> : <><Check className="w-3.5 h-3.5" /> Simpan & Kirim</>}
          </button>
          <button onClick={() => { setIsEditingWa(false); setWaInput(''); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

const AksesTab = ({ token, showToast }) => {
  const [list, setList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formNama, setFormNama] = useState('');
  const [formRole, setFormRole] = useState('koprodi');
  const [formScope, setFormScope] = useState('');
  const [formWa, setFormWa] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await api.superAdminGetAdminAkses(token, {
        onCacheHit: (cached) => { setList(cached || []); setIsLoading(false); },
      });
      setList(rows || []);
    } catch (err) {
      showToast(err.message || 'Gagal memuat daftar akses.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [token, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!formNama.trim() || !formScope.trim()) { showToast('Nama dan scope wajib diisi.', 'error'); return; }
    setIsGenerating(true);
    setGeneratedLink('');
    try {
      const result = await api.superAdminGenerateAdminAkses(token, { nama: formNama.trim(), role: formRole, scope: formScope.trim(), wa: formWa.trim() });
      setGeneratedLink(result.link);
      showToast('Akses berhasil dibuat.');
      load();
    } catch (err) {
      showToast(err.message || 'Gagal membuat akses.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (id, nama) => {
    if (!window.confirm(`Cabut akses "${nama}"? Link yang sudah dibagikan ke orang ini akan langsung berhenti berfungsi.`)) return;
    setBusyId(id);
    try {
      await api.superAdminRevokeAdminAkses(token, id);
      showToast('Akses dicabut.');
      load();
    } catch (err) {
      showToast(err.message || 'Gagal mencabut akses.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const resetForm = () => {
    setShowForm(false); setFormNama(''); setFormScope(''); setFormWa(''); setGeneratedLink(''); setFormRole('koprodi');
  };

  const generatedWaHref = generatedLink && formWa ? waLink(formWa, buildAksesWaMessage(formNama, formRole, formScope, generatedLink)) : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Buat Akses Baru
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Buat Akses Baru</h3>
              <button onClick={resetForm} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setFormRole('koprodi')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${formRole === 'koprodi' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>Koprodi</button>
              <button onClick={() => setFormRole('admin_fakultas')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${formRole === 'admin_fakultas' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>Admin Fakultas</button>
            </div>

            <input value={formNama} onChange={e => setFormNama(e.target.value)} placeholder="Nama (mis. Bpk. Andi, S.Kom.)"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={formScope} onChange={e => setFormScope(e.target.value)}
              placeholder={formRole === 'koprodi' ? 'Nama Prodi (persis sama dengan master data)' : 'Nama Fakultas (persis sama dengan master data)'}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={formWa} onChange={e => setFormWa(e.target.value)} placeholder="No. WhatsApp (opsional, 628...)"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />

            <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70">
              {isGenerating ? <><ButtonSpinner /> Membuat...</> : 'Generate Link'}
            </button>

            {generatedLink && (
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1.5">Link berhasil dibuat:</p>
                <p className="text-xs text-slate-600 break-all mb-2">{generatedLink}</p>
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
                    {copied ? <><Check className="w-3.5 h-3.5" /> Tersalin</> : <><Copy className="w-3.5 h-3.5" /> Salin Link</>}
                  </button>
                  {generatedWaHref && (
                    <a href={generatedWaHref} target="_blank" rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-500 px-3 py-1.5 rounded-lg">
                      <FaWhatsapp className="w-3.5 h-3.5" /> Kirim WA
                    </a>
                  )}
                </div>
                {!formWa && (
                  <p className="text-[10px] text-emerald-700/70 mt-2">Isi nomor WhatsApp di atas untuk bisa kirim langsung dari sini.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Akses Aktif ({list.length})</h3>
          <button onClick={load} disabled={isLoading} title="Muat ulang data terbaru"
            className="p-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg disabled:opacity-50">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
        {isLoading && list.length === 0 ? (
          <div className="py-10"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" /></div>
        ) : list.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">Belum ada akses dibuat.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {list.map(a => <AksesRow key={a.id} a={a} token={token} busyId={busyId} onRevoke={handleRevoke} onReload={load} showToast={showToast} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================================
// TAB: LOGBOOK & LAPORAN -- ubah status massal, dipilih satu-satu ATAU
// seluruh hasil filter sekaligus. Admin Universitas SAJA.
// =====================================================================
const STATUS_OPTIONS_LOGBOOK = ['Draf', 'Menunggu Persetujuan Mentor', 'Menunggu Persetujuan DPL', 'Revisi Mentor', 'Revisi DPL', 'Disetujui'];
const STATUS_OPTIONS_LAPORAN = ['Menunggu Persetujuan Mentor', 'Menunggu Persetujuan DPL', 'Revisi Mentor', 'Revisi DPL', 'Disetujui'];

const LogbookLaporanTab = ({ token, showToast }) => {
  const [jenis, setJenis] = useState('logbook'); // 'logbook' | 'laporan'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const [tahunAjaranList, setTahunAjaranList] = useState([]);
  const [fakultasOptions, setFakultasOptions] = useState([]);
  const [selectedTahun, setSelectedTahun] = useState('');
  const [selectedFakultas, setSelectedFakultas] = useState('semua');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkCatatan, setBulkCatatan] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setSelectedIds([]);
    try {
      const params = { tahunAjaranId: selectedTahun, fakultas: selectedFakultas === 'semua' ? '' : selectedFakultas, status: statusFilter === 'semua' ? '' : statusFilter };
      // getSuperAdminMeta (BUKAN getSuperAdminData) untuk isi dropdown --
      // permintaan list logbook/laporan-nya sendiri sudah cukup, tidak
      // perlu ditambah query universitas penuh cuma untuk 2 dropdown.
      // Keduanya di-cache -- filter yang sama pernah dibuka tampil
      // instan sambil diperbarui di belakang layar.
      const listOpts = { onCacheHit: (cached) => setItems(cached || []) };
      const [rows, meta] = await Promise.all([
        jenis === 'logbook' ? api.getSuperAdminLogbookList(token, params, listOpts) : api.getSuperAdminLaporanList(token, params, listOpts),
        api.getSuperAdminMeta(token, {
          onCacheHit: (cached) => {
            setTahunAjaranList(cached.tahunAjaranList || []);
            setFakultasOptions(cached.fakultasOptions || []);
          },
        }),
      ]);
      setItems(rows || []);
      setTahunAjaranList(meta.tahunAjaranList || []);
      setFakultasOptions(meta.fakultasOptions || []);
      if (!selectedTahun && meta.tahunAjaranAktifId) setSelectedTahun(meta.tahunAjaranAktifId);
    } catch (err) {
      setError(err.message || 'Gagal memuat data.');
    } finally {
      setIsLoading(false);
    }
  }, [token, jenis, selectedTahun, selectedFakultas, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filteredItems = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    return items.filter(it => (it.mahasiswaNama || '').toLowerCase().includes(term) || (it.nim || '').toLowerCase().includes(term));
  }, [items, searchTerm]);

  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every(it => selectedIds.includes(it.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredItems.some(it => it.id === id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filteredItems.map(it => it.id)])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const statusOptions = jenis === 'logbook' ? STATUS_OPTIONS_LOGBOOK : STATUS_OPTIONS_LAPORAN;
  const isRevisiTarget = bulkStatus.indexOf('Revisi') === 0;

  const handleApply = async () => {
    if (!bulkStatus) { showToast('Pilih status tujuan dulu.', 'error'); return; }
    if (isRevisiTarget && !bulkCatatan.trim()) { showToast('Catatan revisi wajib diisi.', 'error'); return; }
    if (!window.confirm(`Ubah status ${selectedIds.length} ${jenis === 'logbook' ? 'logbook' : 'laporan'} menjadi "${bulkStatus}"?`)) return;

    setIsApplying(true);
    try {
      const result = await api.superAdminBulkUpdateStatus(token, { type: jenis, ids: selectedIds, status: bulkStatus, catatan: bulkCatatan.trim() });
      showToast(`${result.successCount} dari ${result.total} berhasil diubah.`);
      setBulkStatus(''); setBulkCatatan('');
      load();
    } catch (err) {
      showToast(err.message || 'Gagal mengubah status.', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1 border border-slate-100">
        <button onClick={() => setJenis('logbook')} className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${jenis === 'logbook' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Logbook</button>
        <button onClick={() => setJenis('laporan')} className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${jenis === 'laporan' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>Laporan Akhir</button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Cari nama atau NIM..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <select value={selectedTahun} onChange={e => setSelectedTahun(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold outline-none cursor-pointer">
              <option value="">Semua Tahun Ajaran</option>
              {tahunAjaranList.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedFakultas} onChange={e => setSelectedFakultas(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer max-w-[180px]">
              <option value="semua">Semua Fakultas</option>
              {fakultasOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <Building2 className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer">
              <option value="semua">Semua Status</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button onClick={load} disabled={isLoading} title="Muat ulang data terbaru"
            className="p-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl disabled:opacity-50">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="py-16"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" /></div>
      ) : error ? (
        <div className="bg-white p-8 rounded-2xl text-center border border-slate-100">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">{error}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <div className="w-5 h-5 border-2 rounded-md flex items-center justify-center transition-colors" style={{ borderColor: allFilteredSelected ? '#4F46E5' : '#CBD5E1', backgroundColor: allFilteredSelected ? '#4F46E5' : 'transparent' }}>
                {allFilteredSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
              Pilih Semua ({filteredItems.length} difilter)
            </button>
            {selectedIds.length > 0 && <span className="text-xs font-bold text-indigo-600">{selectedIds.length} dipilih</span>}
          </div>

          {filteredItems.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">Tidak ada data ditemukan.</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-[560px] overflow-y-auto">
              {filteredItems.map(it => {
                const isSelected = selectedIds.includes(it.id);
                return (
                  <div key={it.id} onClick={() => toggleSelectOne(it.id)} className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                    <div className="w-5 h-5 border-2 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ borderColor: isSelected ? '#4F46E5' : '#CBD5E1', backgroundColor: isSelected ? '#4F46E5' : 'transparent' }}>
                      {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{it.mahasiswaNama} <span className="text-[10px] text-slate-400 font-normal">({it.nim})</span></p>
                        <span className="text-[9px] text-slate-400 shrink-0">{formatDateIndoShort(it.tanggal)}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{jenis === 'logbook' ? (it.kegiatan || []).join(', ') : it.fileName}</p>
                      <span className={`inline-block mt-1.5 text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(it.status)}`}>{it.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-lg bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-40 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-[10px]">{selectedIds.length}</span>
              Item Dipilih
            </span>
            <button onClick={() => setSelectedIds([])} className="text-[10px] text-slate-400 hover:text-white">Batalkan</button>
          </div>
          <div className="flex gap-2">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="flex-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold outline-none">
              <option value="">Ubah status menjadi...</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {isRevisiTarget && (
            <textarea value={bulkCatatan} onChange={e => setBulkCatatan(e.target.value)} placeholder="Catatan revisi (wajib diisi)..."
              className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs outline-none resize-none h-20" />
          )}
          <button onClick={handleApply} disabled={isApplying || !bulkStatus} className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {isApplying ? <><ButtonSpinner /> Menerapkan...</> : 'Terapkan Perubahan'}
          </button>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// KOMPONEN UTAMA
// =====================================================================
export default function AdminUniversitasView() {
  const [session, setSession] = useState(() => superAdminSession.get());
  const [activeTab, setActiveTab] = useState('ringkasan');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [mahasiswaForRingkasan, setMahasiswaForRingkasan] = useState([]);
  const [fakultasOptions, setFakultasOptions] = useState([]);
  const [isLoadingRingkasan, setIsLoadingRingkasan] = useState(true);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const handleLoggedIn = (token, nama) => setSession({ token, nama });
  const handleLogout = () => { superAdminSession.clear(); setSession(null); };

  // PENTING: dependency array HANYA session?.token -- BUKAN activeTab.
  // Sebelumnya effect ini ikut menembak ulang setiap kali tab
  // diganti, artinya query TERBERAT (seluruh mahasiswa se-universitas
  // + agregasi 6 tabel per mahasiswa) tertembak berkali-kali cuma
  // karena pindah-pindah tab, padahal Ringkasan cuma perlu dimuat
  // SEKALI saat login. loadRingkasan diekspos lewat tombol refresh
  // manual di RingkasanTab kalau datanya perlu di-refresh (mis.
  // setelah bulk update status di tab lain).
  const loadRingkasan = useCallback(() => {
    if (!session?.token) return;
    setIsLoadingRingkasan(true);
    return api.getSuperAdminData(session.token, {}, {
      // Cache hit -> tampil INSTAN, spinner langsung berhenti, sambil
      // fetch fresh tetap jalan di belakang layar (lihat swr() di api.js).
      onCacheHit: (data) => {
        setMahasiswaForRingkasan(data.mahasiswa || []);
        setFakultasOptions(data.fakultasOptions || []);
        setIsLoadingRingkasan(false);
      },
    })
      .then((data) => {
        setMahasiswaForRingkasan(data.mahasiswa || []);
        setFakultasOptions(data.fakultasOptions || []);
      })
      .catch((err) => {
        if (String(err.message || '').toLowerCase().includes('sesi') || String(err.message || '').includes('INVALID_TOKEN')) {
          superAdminSession.clear();
          setSession(null);
        }
      })
      .finally(() => setIsLoadingRingkasan(false));
  }, [session?.token]);

  useEffect(() => { loadRingkasan(); }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <SuperAdminLoginView onLoggedIn={handleLoggedIn} />;

  const tabs = [
    ['ringkasan', 'Ringkasan', LayoutDashboard],
    ['mahasiswa', 'Data Mahasiswa', Users],
    ['masterdata', 'Master Data', Building2],
    ['logboklaporan', 'Logbook & Laporan', FileText],
    ['akses', 'Akses Portal', KeyRound],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

      <div className="bg-slate-900 text-white px-4 sm:px-8 pt-8 pb-6 shadow-xl">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase mb-1 flex items-center gap-2"><Lock className="w-3 h-3" /> Admin Universitas</p>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Halo, {session.nama}</h1>
          </div>
          <button onClick={handleLogout} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors" title="Keluar">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 mt-6 overflow-x-auto pb-1">
          {tabs.map(([key, label, Icon]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${activeTab === key ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {activeTab === 'ringkasan' && (
          isLoadingRingkasan
            ? <div className="py-16"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" /></div>
            : <RingkasanTab mahasiswaList={mahasiswaForRingkasan} fakultasOptions={fakultasOptions} onRefresh={loadRingkasan} isLoading={isLoadingRingkasan} />
        )}
        {activeTab === 'mahasiswa' && <MahasiswaTab token={session.token} showToast={showToast} />}
        {activeTab === 'masterdata' && <MasterDataTab token={session.token} showToast={showToast} />}
        {activeTab === 'logboklaporan' && <LogbookLaporanTab token={session.token} showToast={showToast} />}
        {activeTab === 'akses' && <AksesTab token={session.token} showToast={showToast} />}
      </div>
    </div>
  );
}

// =====================================================================
// KONTRAK api.js YANG DIBUTUHKAN KOMPONEN INI
// =====================================================================
// Semua fungsi (adminUniversitasLogin, getSuperAdminData, getSuperAdminMeta,
// superAdminAdd/Update/Delete Fakultas/Prodi/TahunAjaran, superAdminGetAdminAkses,
// superAdminGenerateAdminAkses, superAdminRevokeAdminAkses, superAdminGetAdminAksesLink,
// superAdminUpdateAdminAksesWa, superAdminUpdateMahasiswa, superAdminResetMahasiswaPassword,
// superAdminUpdateMentor, superAdminUpdateDosen, getSuperAdminLogbookList,
// getSuperAdminLaporanList, superAdminBulkUpdateStatus) SUDAH ADA di file
// api.js lengkap yang terpisah -- itu SUMBER KEBENARAN untuk kontraknya,
// termasuk strategi cache (mana yang di-cache berapa lama, dan aksi tulis
// mana yang membersihkan cache mana). Jangan duplikasi daftarnya di sini
// lagi -- kalau berubah, gampang jadi tidak sinkron. Cukup pastikan
// api.js yang dipakai project React Anda adalah versi terbaru.
//
// getMahasiswaDetailForAdmin SUDAH ADA (dipakai juga oleh AdminFakultasView.jsx) --
// tidak perlu ditambah lagi, backend-nya sudah menerima token admin_universitas juga.
//
// ===================================================================
// CATATAN PENTING soal getMasterData()
// ===================================================================
// MasterDataTab di atas memanggil api.getMasterData() yang SUDAH ADA
// (dipakai ProfileSetupView.jsx), tapi bentuknya HANYA nama string
// ({ fakultas: ['Fakultas A', ...], prodi: [{nama, fakultas}, ...] }),
// TANPA ID -- jadi entri LAMA (dari data hardcode/migrasi awal) tidak
// akan punya tombol hapus (component sudah menangani ini dengan aman,
// hanya render tombol hapus kalau ada field ID). Entri BARU yang
// ditambahkan lewat superAdminAddFakultas/superAdminAddProdi otomatis
// bisa dihapus karena tersimpan dengan ID. Ini keterbatasan yang
// disengaja untuk menghindari migrasi data besar-besaran secara diam-
// diam -- kalau Anda mau SEMUA entri (termasuk yang lama) bisa
// dihapus/diedit, backend getMasterData_() perlu diubah untuk selalu
// menyertakan ID, yang berarti mengecek dulu apakah tabel "Fakultas"/
// "Prodi" Anda memang sudah punya kolom ID terisi untuk baris lama.