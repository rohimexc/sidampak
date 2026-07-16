import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock, Users, FileText, BookOpen, Clock, CheckCircle, AlertCircle,
  Download, Search, Loader2, Filter, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, MapPin, Mail, GraduationCap, X, FileWarning
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import * as XLSX from 'xlsx';

import { api } from './api'; // lihat catatan kontrak backend di bagian bawah file ini

// =====================================================================
// UTIL LOKAL — file ini MANDIRI (tidak import dari App.jsx) supaya bisa
// jadi entry point / halaman terpisah. Kalau sudah ada file utils
// bersama, ganti bagian ini dengan import dari sana.
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
const formatDateIndo = (raw) => {
  if (!raw) return '-';
  const d = parseSafeDate(raw);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
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

// Label pengirim yang dipakai sebagai tanda tangan pesan WA, mengikuti
// role pemilik token yang sedang login (Koprodi/Admin Fakultas).
const buildSenderLabel = (scopeInfo) => {
  if (!scopeInfo) return '';
  return scopeInfo.role === 'admin_fakultas'
    ? `Admin Fakultas ${scopeInfo.scopeName}`
    : `Koordinator Program Studi ${scopeInfo.scopeName}`;
};

// Pesan sapaan biasa untuk mahasiswa yang progresnya aman.
const buildGreetingMessage = (m, scopeInfo) =>
  `Halo ${m.nama} (${m.nim})\n\nSalam,\n${buildSenderLabel(scopeInfo)}`;

// Pesan pengingat untuk mahasiswa berstatus "Perlu Perhatian" -- progres
// jam logbook tertinggal dari progres waktu penugasan.
const buildReminderMessage = (m, scopeInfo) =>
  `Halo ${m.nama} (${m.nim}),\n\n` +
  `Kami memantau progres pengisian Logbook Kampus Berdampak Anda saat ini baru ${m.progressPercentage}% dari target jam, ` +
  `sementara waktu penugasan sudah berjalan ${m.timePercentage ?? '-'}%. Mohon segera melengkapi pengisian logbook agar tidak tertinggal dari jadwal penugasan.\n\n` +
  `Terima kasih atas perhatian dan kerja samanya.\n\n` +
  `Salam,\n${buildSenderLabel(scopeInfo)}`;

const PageLoader = ({ label = 'Memuat data...' }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen">
    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    <p className="mt-4 text-slate-500 font-bold text-sm tracking-widest uppercase text-center px-8">{label}</p>
  </div>
);

const DOKUMEN_LABELS = {
  suratTugas: 'Surat Tugas Mahasiswa',
  skDpl: 'SK Pengangkatan DPL',
  kerjasama: 'Kerjasama Mitra - Prodi',
  rps: 'Rencana Pembelajaran (RPS)',
  krs: 'KRS SIGA-8',
};

// =====================================================================
// KARTU RINGKASAN (dipakai di header)
// =====================================================================
const StatCard = ({ icon: Icon, value, label, tone }) => (
  <div className={`backdrop-blur-md rounded-2xl p-3 sm:p-4 border flex flex-col items-center justify-center ${tone}`}>
    <Icon className="w-4 h-4 mb-1 opacity-80" />
    <p className="text-lg sm:text-xl font-black">{value}</p>
    <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-80 text-center">{label}</p>
  </div>
);

// =====================================================================
// KARTU MAHASISWA (list utama) — SATU KOLOM DI HP, 2 KOLOM DI LAYAR LEBAR
// Dirancang supaya tidak perlu scroll horizontal sama sekali di mobile.
// =====================================================================
const MahasiswaCard = ({ m, onOpenDetail, scopeInfo }) => {
  const handleOpenDetail = () => onOpenDetail(m.nim);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenDetail(); }
  };

  const waMessage = m.isAtRisk ? buildReminderMessage(m, scopeInfo) : buildGreetingMessage(m, scopeInfo);
  const waHref = waLink(m.wa, waMessage);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenDetail}
      onKeyDown={handleKeyDown}
      className="text-left bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all w-full cursor-pointer"
    >
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-800 truncate">{m.nama}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{m.nim} • {m.prodi}</p>
        </div>
        {m.isAtRisk && (
          <span className="shrink-0 flex items-center gap-1 bg-rose-50 text-rose-600 text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wide">
            <AlertCircle className="w-3 h-3" /> Perhatian
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{m.mitra || 'Mitra belum diisi'}</span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Progres Rekognisi</span>
          <span className="text-xs font-black text-indigo-600">{m.progressPercentage}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${m.progressPercentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${m.progressPercentage}%` }}
          />
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

      {/* Tombol WA -- stopPropagation supaya tidak ikut membuka detail.
          Normal: sapaan singkat. Perlu Perhatian: pengingat isi logbook. */}
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
            m.isAtRisk ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          <FaWhatsapp className="w-3.5 h-3.5" />
          {m.isAtRisk ? 'Ingatkan Isi Logbook' : 'Kirim Pesan WA'}
        </a>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-400">
          <FaWhatsapp className="w-3.5 h-3.5" /> Nomor WA Belum Ada
        </div>
      )}
    </div>
  );
};

// =====================================================================
// KOMPONEN DETAIL 1 MAHASISWA (full screen overlay, dibuka dari kartu)
// =====================================================================
const MahasiswaDetailView = ({ nim, adminToken, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    api.getMahasiswaDetailForAdmin(nim, adminToken)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Gagal memuat detail mahasiswa.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [nim, adminToken]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-right-10 duration-300">
      <div className="bg-white px-4 sm:px-6 pt-6 pb-4 shadow-sm border-b border-slate-100 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-2 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
          <ChevronLeft className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-lg font-extrabold text-slate-800 tracking-tight truncate">
          {data?.profile?.nama || 'Detail Mahasiswa'}
        </h1>
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

          {/* IDENTITAS */}
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Identitas & Penugasan</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">NIM</p><p className="font-semibold text-slate-800">{data.profile.nim}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Prodi</p><p className="font-semibold text-slate-800">{data.profile.prodi}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Email</p><p className="font-semibold text-slate-800 truncate">{data.profile.email || '-'}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp</p>
                {data.profile.wa ? (
                  <a href={waLink(data.profile.wa)} target="_blank" rel="noreferrer" className="font-semibold text-emerald-600 flex items-center gap-1"><FaWhatsapp /> {data.profile.wa}</a>
                ) : <p className="font-semibold text-slate-400">-</p>}
              </div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Jenis Program</p><p className="font-semibold text-slate-800">{data.profile.jenisProgram || '-'}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Nama Program</p><p className="font-semibold text-slate-800">{data.profile.namaProgram || '-'}</p></div>
              <div className="col-span-2"><p className="text-[10px] font-bold text-slate-400 uppercase">Mitra & Lokasi</p><p className="font-semibold text-slate-800">{data.profile.mitra || '-'}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Mulai Tugas</p><p className="font-semibold text-slate-800">{formatDateIndoShort(data.profile.tglAwal)}</p></div>
              <div><p className="text-[10px] font-bold text-slate-400 uppercase">Selesai Tugas</p><p className="font-semibold text-slate-800">{formatDateIndoShort(data.profile.tglAkhir)}</p></div>
            </div>
          </div>

          {/* KONTAK MENTOR & DPL */}
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Mentor & DPL</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Mentor (Mitra)</p>
                  <p className="font-semibold text-slate-800 truncate">{data.profile.mentorNama || 'Belum diisi'}</p>
                </div>
                {data.profile.mentorWa && (
                  <a href={waLink(data.profile.mentorWa)} target="_blank" rel="noreferrer" className="shrink-0 p-2 bg-emerald-500 text-white rounded-xl"><FaWhatsapp /></a>
                )}
              </div>
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">DPL (Kampus)</p>
                  <p className="font-semibold text-slate-800 truncate">{data.profile.dplNama || 'Belum diisi'}</p>
                </div>
                {data.profile.dplWa && (
                  <a href={waLink(data.profile.dplWa)} target="_blank" rel="noreferrer" className="shrink-0 p-2 bg-emerald-500 text-white rounded-xl"><FaWhatsapp /></a>
                )}
              </div>
            </div>
          </div>

          {/* PROGRES PER MATAKULIAH */}
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Progres Rekognisi per Matakuliah</h2>
            {data.mkProgress.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Belum ada matakuliah direkognisi.</p>
            ) : (
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

          {/* DOKUMEN PENDUKUNG */}
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Dokumen Pendukung</h2>
            <div className="space-y-2">
              {Object.keys(DOKUMEN_LABELS).map(key => {
                const link = data.profile.dokumen ? data.profile.dokumen[key] : '';
                return (
                  <div key={key} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                    <span className="text-xs font-semibold text-slate-700">{DOKUMEN_LABELS[key]}</span>
                    {link ? (
                      <a href={link} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">Lihat</a>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-lg">Belum ada</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* LAPORAN AKHIR */}
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Laporan Akhir</h2>
            {data.laporan ? (
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                <div className="min-w-0">
                  <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(data.laporan.status)}`}>{data.laporan.status}</span>
                  <p className="text-xs font-semibold text-slate-700 mt-1 truncate">{data.laporan.fileName}</p>
                </div>
                {data.laporan.fileLink && (
                  <a href={data.laporan.fileLink} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">Buka</a>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">Belum disubmit.</p>
            )}
          </div>

          {/* RIWAYAT LOGBOOK */}
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Riwayat Logbook ({data.logbooks.length})</h2>
            {data.logbooks.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Belum ada aktivitas.</p>
            ) : (
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
// KOMPONEN UTAMA
// =====================================================================
export default function AdminFakultasView({ adminToken }) {
  const hasToken = !!adminToken;

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [scopeInfo, setScopeInfo] = useState(null);
  const [tahunAjaranList, setTahunAjaranList] = useState([]);
  const [selectedTahun, setSelectedTahun] = useState('');
  const [prodiOptions, setProdiOptions] = useState([]);
  const [mahasiswaList, setMahasiswaList] = useState([]);

  const [selectedProdi, setSelectedProdi] = useState('semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [entriesPerPage, setEntriesPerPage] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedNim, setSelectedNim] = useState(null);

  const loadData = useCallback(async (tahunAjaranId) => {
    if (!hasToken) { setIsLoading(false); return; }
    let gotCacheHit = false;
    setLoadError('');

    const fetchPromise = api.getAdminFakultasData(adminToken, tahunAjaranId, {
      onCacheHit: (cached) => {
        if (!cached) return;
        gotCacheHit = true;
        setScopeInfo(cached.scope || null);
        setTahunAjaranList(cached.tahunAjaranList || []);
        setProdiOptions(cached.prodiOptions || []);
        setMahasiswaList(cached.mahasiswa || []);
        setIsLoading(false);
      },
    });

    await Promise.resolve();
    if (!gotCacheHit) setIsLoading(true);

    try {
      const data = await fetchPromise;
      setScopeInfo(data.scope || null);
      setTahunAjaranList(data.tahunAjaranList || []);
      setProdiOptions(data.prodiOptions || []);
      setMahasiswaList(data.mahasiswa || []);
      if (!tahunAjaranId && data.tahunAjaranAktifId) {
        setSelectedTahun(data.tahunAjaranAktifId);
      }
    } catch (err) {
      if (!gotCacheHit) setLoadError(err.message || 'Gagal memuat data. Cek kembali tautan akses Anda.');
    } finally {
      setIsLoading(false);
    }
  }, [hasToken, adminToken]);

  useEffect(() => { loadData(selectedTahun); }, [selectedTahun, loadData]);

  const isAdminFakultas = scopeInfo?.role === 'admin_fakultas';

  const summary = useMemo(() => {
    const total = mahasiswaList.length;
    const laporanDisetujui = mahasiswaList.filter(m => m.statusLaporan === 'Disetujui').length;
    const logbookPending = mahasiswaList.reduce((acc, m) => acc + (m.logbookCount?.pending || 0), 0);
    const perluPerhatian = mahasiswaList.filter(m => m.isAtRisk).length;
    return { total, laporanDisetujui, logbookPending, perluPerhatian };
  }, [mahasiswaList]);

  const filteredData = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    let rows = mahasiswaList.filter(m =>
      (m.nama || '').toLowerCase().includes(term) ||
      (m.nim || '').toLowerCase().includes(term) ||
      (m.mitra || '').toLowerCase().includes(term)
    );
    if (isAdminFakultas && selectedProdi !== 'semua') {
      rows = rows.filter(m => m.prodi === selectedProdi);
    }
    if (statusFilter !== 'semua') {
      rows = rows.filter(m => m.statusLaporan === statusFilter);
    }
    if (onlyAtRisk) {
      rows = rows.filter(m => m.isAtRisk);
    }
    rows.sort((a, b) => (a.nama || '').localeCompare(b.nama || '', 'id'));
    return rows;
  }, [mahasiswaList, searchTerm, statusFilter, onlyAtRisk, selectedProdi, isAdminFakultas]);

  const totalPages = entriesPerPage === 'all' ? 1 : Math.ceil(filteredData.length / entriesPerPage);
  const currentEntries = entriesPerPage === 'all'
    ? filteredData
    : filteredData.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

  // -------------------------------------------------------------
  // EXPORT EXCEL — 3 sheet: Data Mahasiswa (semua field), Detail
  // Mata Kuliah (breakdown per-matkul), Rekap Prodi.
  // -------------------------------------------------------------
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const tahunLabel = tahunAjaranList.find(t => t.id === selectedTahun)?.label || 'Semua';

      const sheetMahasiswa = filteredData.map(m => ({
        NIM: m.nim,
        Nama: m.nama,
        WhatsApp: m.wa,
        Email: m.email,
        Prodi: m.prodi,
        Fakultas: m.fakultas,
        'Jenis Program': m.jenisProgram,
        'Nama Program': m.namaProgram,
        Mitra: m.mitra,
        Lokasi: m.lokasi,
        'Tgl Mulai': formatDateIndoShort(m.tglAwal),
        'Tgl Selesai': formatDateIndoShort(m.tglAkhir),
        'Nama Mentor': m.mentorNama,
        'WA Mentor': m.mentorWa,
        'Email Mentor': m.mentorEmail,
        'Nama DPL': m.dplNama,
        'NUPTK DPL': m.dplNuptk,
        'WA DPL': m.dplWa,
        'Email DPL': m.dplEmail,
        'Jam Tercapai': m.currentHours,
        'Target Jam': m.targetHours,
        'Progres (%)': m.progressPercentage,
        'Progres Waktu (%)': m.timePercentage ?? '-',
        'Perlu Perhatian': m.isAtRisk ? 'Ya' : 'Tidak',
        'Logbook Total': m.logbookCount.total,
        'Logbook Disetujui': m.logbookCount.disetujui,
        'Logbook Pending': m.logbookCount.pending,
        'Logbook Revisi': m.logbookCount.revisi,
        'Logbook Draf': m.logbookCount.draft,
        'Aktivitas Terakhir': formatDateIndoShort(m.lastLogbookDate),
        'Status Laporan': m.statusLaporan,
        'Link Laporan': m.laporanFileLink || '-',
        'Kelengkapan Dokumen': `${m.dokumenLengkap}/5`,
        'Link Surat Tugas': m.dokumen.suratTugas || '-',
        'Link SK DPL': m.dokumen.skDpl || '-',
        'Link Kerjasama': m.dokumen.kerjasama || '-',
        'Link RPS': m.dokumen.rps || '-',
        'Link KRS': m.dokumen.krs || '-',
      }));
      const wsMahasiswa = XLSX.utils.json_to_sheet(sheetMahasiswa);
      wsMahasiswa['!cols'] = Object.keys(sheetMahasiswa[0] || {}).map(() => ({ wch: 20 }));

      const sheetMk = [];
      filteredData.forEach(m => {
        (m.mataKuliah || []).forEach(mk => {
          sheetMk.push({
            NIM: m.nim,
            Nama: m.nama,
            Prodi: m.prodi,
            'Kode MK': mk.kode,
            'Nama Matakuliah': mk.nama,
            SKS: mk.sks,
            'Target Jam': mk.targetHours,
            'Jam Tercapai': mk.currentHours,
            'Progres (%)': mk.percentage,
          });
        });
      });
      const wsMk = XLSX.utils.json_to_sheet(sheetMk);
      wsMk['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];

      const rekapByProdi = {};
      filteredData.forEach(m => {
        const key = m.prodi || 'Tanpa Prodi';
        if (!rekapByProdi[key]) rekapByProdi[key] = { prodi: key, jumlah: 0, laporanDisetujui: 0, perluPerhatian: 0, totalProgress: 0 };
        rekapByProdi[key].jumlah += 1;
        if (m.statusLaporan === 'Disetujui') rekapByProdi[key].laporanDisetujui += 1;
        if (m.isAtRisk) rekapByProdi[key].perluPerhatian += 1;
        rekapByProdi[key].totalProgress += (m.progressPercentage || 0);
      });
      const rekapRows = Object.values(rekapByProdi).map(r => ({
        'Program Studi': r.prodi,
        'Jumlah Mahasiswa': r.jumlah,
        'Laporan Disetujui': r.laporanDisetujui,
        'Perlu Perhatian': r.perluPerhatian,
        'Rata-rata Progres (%)': r.jumlah > 0 ? Math.round(r.totalProgress / r.jumlah) : 0,
      }));
      const wsRekap = XLSX.utils.json_to_sheet(rekapRows);
      wsRekap['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 20 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsMahasiswa, 'Data Mahasiswa');
      XLSX.utils.book_append_sheet(wb, wsMk, 'Detail Mata Kuliah');
      XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Prodi');

      const scopeName = scopeInfo?.scopeName || 'Export';
      XLSX.writeFile(wb, `SIDAMPAK_${scopeName}_${tahunLabel}_${Date.now()}.xlsx`.replace(/\s+/g, '_'));
    } finally {
      setIsExporting(false);
    }
  };

  if (!hasToken) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen p-8 text-center">
        <Lock className="w-10 h-10 text-rose-500 mb-3" />
        <p className="text-sm font-bold text-slate-700 mb-1">Akses Ditolak</p>
        <p className="text-xs text-slate-500">Halaman ini hanya bisa diakses lewat tautan resmi yang diberikan admin PMM.</p>
      </div>
    );
  }

  if (isLoading && mahasiswaList.length === 0) return <PageLoader label="Memuat data..." />;

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen p-8 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
        <p className="text-sm font-bold text-slate-700 mb-1">Gagal memuat data</p>
        <p className="text-xs text-slate-500 mb-4">{loadError}</p>
        <button onClick={() => loadData(selectedTahun)} className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl">Coba Lagi</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center">
      <div className="w-full max-w-5xl">

        {/* HEADER */}
        <div className="bg-slate-900 text-white px-4 sm:px-8 pt-8 sm:pt-10 pb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <p className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase mb-1 flex items-center gap-2">
            <Lock className="w-3 h-3" /> Akses Aman (Token)
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {isAdminFakultas ? 'Portal Admin Fakultas' : 'Portal Koordinator Program Studi'}
          </h1>
          {scopeInfo?.nama && (
            // <p className="text-sm text-slate-300 mt-1">
            //   Halo, <span className="font-bold text-white">{scopeInfo.nama}</span> — <span className="font-bold text-white">{scopeInfo.scopeName}</span>
            // </p>
            <p className="text-sm text-slate-300 mt-1">
              Halo, <span className="font-bold text-white">{scopeInfo.scopeName}</span>
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <StatCard icon={Users} value={summary.total} label="Mahasiswa" tone="bg-white/10 border-white/10 text-white" />
            <StatCard icon={CheckCircle} value={summary.laporanDisetujui} label="Laporan OK" tone="bg-emerald-500/20 border-emerald-500/30 text-emerald-300" />
            <StatCard icon={Clock} value={summary.logbookPending} label="Logbook Pending" tone="bg-amber-500/20 border-amber-500/30 text-amber-300" />
            <StatCard icon={AlertCircle} value={summary.perluPerhatian} label="Perlu Perhatian" tone="bg-rose-500/20 border-rose-500/30 text-rose-300" />
          </div>
        </div>

        {/* BANNER PERLU PERHATIAN */}
        {summary.perluPerhatian > 0 && !onlyAtRisk && (
          <div className="px-4 sm:px-6 pt-4">
            <button
              onClick={() => { setOnlyAtRisk(true); setCurrentPage(1); }}
              className="w-full bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-rose-100 transition-colors"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-xs font-semibold flex-1">
                {summary.perluPerhatian} mahasiswa progres jamnya tertinggal dari progres waktu penugasan.
              </span>
              <span className="text-[10px] font-bold uppercase bg-rose-600 text-white px-3 py-1.5 rounded-lg shrink-0">Lihat</span>
            </button>
          </div>
        )}

        {/* FILTER BAR */}
        <div className="p-4 sm:p-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, NIM, atau mitra..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <select
                  className="appearance-none pl-3 pr-8 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold outline-none cursor-pointer"
                  value={selectedTahun}
                  onChange={e => { setSelectedTahun(e.target.value); setCurrentPage(1); }}
                >
                  {tahunAjaranList.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-white absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {isAdminFakultas && (
                <div className="relative">
                  <select
                    className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    value={selectedProdi}
                    onChange={e => { setSelectedProdi(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="semua">Semua Prodi</option>
                    {prodiOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}

              <div className="relative">
                <select
                  className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer"
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                >
                  <option value="semua">Semua Status Laporan</option>
                  <option value="Disetujui">Disetujui</option>
                  <option value="Menunggu Persetujuan Mentor">Menunggu Mentor</option>
                  <option value="Menunggu Persetujuan DPL">Menunggu DPL</option>
                  <option value="Belum Disubmit">Belum Disubmit</option>
                </select>
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={() => { setOnlyAtRisk(v => !v); setCurrentPage(1); }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${onlyAtRisk ? 'bg-rose-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-600'}`}
              >
                <AlertCircle className="w-3.5 h-3.5" /> Perlu Perhatian
                {onlyAtRisk && <X className="w-3 h-3" />}
              </button>

              <button
                onClick={handleExportExcel}
                disabled={isExporting || filteredData.length === 0}
                className="ml-auto flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-60"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export ({filteredData.length})
              </button>
            </div>
          </div>
        </div>

        {/* DAFTAR KARTU MAHASISWA */}
        <div className="px-4 sm:px-6 pb-10">
          {currentEntries.length === 0 ? (
            <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100 shadow-sm">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Tidak ada data ditemukan.</p>
              <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci atau filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {currentEntries.map(m => (
                <MahasiswaCard key={m.nim} m={m} onOpenDetail={setSelectedNim} scopeInfo={scopeInfo} />
              ))}
            </div>
          )}

          {entriesPerPage !== 'all' && totalPages > 1 && (
            <div className="flex justify-between items-center mt-5 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-xs font-medium text-slate-500 pl-2">Hal {currentPage}/{totalPages} • {filteredData.length} data</span>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 bg-slate-50 rounded-lg disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 bg-slate-50 rounded-lg disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedNim && (
        <MahasiswaDetailView nim={selectedNim} adminToken={adminToken} onClose={() => setSelectedNim(null)} />
      )}
    </div>
  );
}

// =====================================================================
// ENTRY POINT MANDIRI — untuk dijadikan halaman terpisah (admin.html)
// =====================================================================
export function AdminFakultasEntry() {
  const params = new URLSearchParams(window.location.search);
  const adminToken = params.get('token');
  return <AdminFakultasView adminToken={adminToken} />;
}

// =====================================================================
// TAMBAHAN DI api.js YANG DIBUTUHKAN KOMPONEN INI
// =====================================================================
//
//  getAdminFakultasData: (token, tahunAjaranId, opts = {}) =>
//    swr(`adminFakultas_${token}_${tahunAjaranId || 'all'}`, () =>
//      apiGet('getAdminFakultasData', { token, tahunAjaranId: tahunAjaranId || '' }), {
//      onCacheHit: opts.onCacheHit,
//      maxAgeMs: 5 * 60 * 1000,
//    }),
//
//  getMahasiswaDetailForAdmin: (nim, token) =>
//    apiGet('getMahasiswaDetailForAdmin', { nim, token }),
//    // TIDAK pakai cache SWR di sini -- detail dibuka sesekali per tap,
//    // dan datanya (logbook/laporan) berubah cukup sering; lebih aman
//    // selalu fresh daripada berisiko menampilkan status basi ke admin.
//
// Dan di Api.gs, tambahkan 2 case baru di doGet():
//   case 'getAdminFakultasData':
//     return handleGetAdminFakultasData_(e.parameter);
//   case 'getMahasiswaDetailForAdmin':
//     return handleGetMahasiswaDetailForAdmin_(e.parameter);