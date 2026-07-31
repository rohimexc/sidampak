import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, FileText, BookOpen,
  Download, Send, Loader2, Search, MapPin, FileWarning, X
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import * as XLSX from 'xlsx';

import { api } from './api';

// =====================================================================
// UTIL LOKAL -- file ini MANDIRI (tidak import dari App.jsx), mengikuti
// pola yang sama dengan AdminFakultasView.jsx/AdminUniversitasView.jsx --
// supaya ReviewerView bisa jadi halaman/entry point sendiri (reviewer.html)
// tanpa harus me-load seluruh App.jsx (Mahasiswa) sekaligus.
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
  if (justDate.includes('/')) {
    const parts = justDate.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  const fb = new Date(strDate);
  return isNaN(fb.getTime()) ? new Date() : fb;
};
const formatDateIndoShort = (rawDate) => {
  if (!rawDate) return '-';
  const d = parseSafeDate(rawDate);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
// Drive seringkali memblokir tag <img> langsung (CORS/X-Frame-Options).
// Konversi ke endpoint lh3.googleusercontent.com yang lebih permisif.
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
const getStatusBadgeClass = (status) => {
  if (status === 'Disetujui') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Draf') return 'bg-slate-200 text-slate-700';
  if (status === 'Revisi Mentor') return 'bg-rose-100 text-rose-700';
  if (status === 'Revisi DPL') return 'bg-orange-100 text-orange-700';
  if (status === 'Menunggu Persetujuan Mentor') return 'bg-amber-100 text-amber-700';
  if (status === 'Menunggu Persetujuan DPL') return 'bg-indigo-100 text-indigo-700';
  return 'bg-slate-100 text-slate-500';
};

// Buka WhatsApp Web/App dengan nomor & pesan yang sudah terisi (redaksi
// siap kirim, mentor/DPL tinggal tekan kirim). Pola sama dengan
// AdminFakultasView.jsx supaya konsisten se-aplikasi.
const waLink = (wa, text) => {
  if (!wa) return null;
  const number = String(wa).replace(/[^0-9]/g, '');
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
};

// Tanda tangan pesan WA mengikuti role reviewer yang sedang login (Mentor
// atau DPL) -- reviewerInfo.role dikirim server lewat getReviewerQueue.
const buildSenderLabel = (reviewerInfo) => {
  if (!reviewerInfo?.nama) return '';
  return reviewerInfo.role === 'dpl' ? `DPL ${reviewerInfo.nama}` : `Mentor ${reviewerInfo.nama}`;
};

// Redaksi pengingat untuk mahasiswa yang logbook-nya masih kurang dari
// target. Kalau data progres jam/waktu tersedia dari server, disebutkan
// angka pastinya (lebih meyakinkan); kalau belum tersedia, tetap jatuh
// ke redaksi umum supaya tombol tetap bisa dipakai.
const buildReminderMessage = (m, reviewerInfo) => {
  const adaProgres = typeof m.progressPercentage === 'number';
  const adaWaktu = typeof m.timePercentage === 'number';
  const progresLine = adaProgres
    ? `progres pengisian Logbook Kampus Berdampak Anda saat ini baru ${m.progressPercentage}% dari target jam` +
      (adaWaktu ? `, sementara waktu penugasan sudah berjalan ${m.timePercentage}%` : '')
    : `progres pengisian Logbook Kampus Berdampak Anda tampak masih tertinggal dari target`;

  return `Halo ${m.nama} (${m.nim}),\n\n` +
    `Kami memantau ${progresLine}. Mohon segera dilengkapi agar tidak tertinggal dari jadwal penugasan.\n\n` +
    `Terima kasih atas perhatian dan kerja samanya.\n\n` +
    `Salam,\n${buildSenderLabel(reviewerInfo)}`;
};

// Fallback penentu "Perlu Perhatian" kalau server belum mengirim flag
// isAtRisk secara eksplisit di getReviewerQueue -- dihitung dari
// progressPercentage (jam) vs timePercentage (waktu penugasan), sama
// seperti logika overallProgress di App.jsx (Dashboard Mahasiswa).
const computeIsAtRisk = (m) => {
  if (typeof m.isAtRisk === 'boolean') return m.isAtRisk;
  if (typeof m.progressPercentage === 'number' && typeof m.timePercentage === 'number') {
    return m.progressPercentage < m.timePercentage;
  }
  return false;
};

const PageLoader = ({ label = 'Memuat data...' }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-full">
    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    <p className="mt-4 text-slate-500 font-bold text-sm tracking-widest uppercase text-center px-8">{label}</p>
  </div>
);
const ButtonSpinner = ({ className = '' }) => (
  <Loader2 className={`w-5 h-5 animate-spin ${className}`} />
);

// =====================================================================
// REVIEWER VIEW (Magic Link Mentor/DPL) -- data dari server via api.js
// =====================================================================
const ReviewerView = ({ reviewerToken, showToast }) => {
  const [activeTab, setActiveTab] = useState('antrean');
  const [selectedMhsId, setSelectedMhsId] = useState(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [mhsList, setMhsList] = useState([]);
  const [pendingLogs, setPendingLogs] = useState([]);
  const [pendingLaporan, setPendingLaporan] = useState([]);
  const [reviewerInfo, setReviewerInfo] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [revisiModal, setRevisiModal] = useState({ isOpen: false, itemId: null, type: '', text: '' });
  const [isSubmittingRevisi, setIsSubmittingRevisi] = useState(false);

  const [selectedLogs, setSelectedLogs] = useState([]);
  const [selectedLaporans, setSelectedLaporans] = useState([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // --- Search, filter "Perlu Perhatian", & export Excel di tab Mahasiswa ---
  const [mhsSearchTerm, setMhsSearchTerm] = useState('');
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
        setIsLoadingQueue(false);
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

  const toggleLogSelection = (id) => {
    setSelectedLogs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleLaporanSelection = (id) => {
    setSelectedLaporans(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const isAllSelected = selectedLogs.length === pendingLogs.length && selectedLaporans.length === pendingLaporan.length;
    if (isAllSelected) {
      setSelectedLogs([]);
      setSelectedLaporans([]);
    } else {
      setSelectedLogs(pendingLogs.map(log => log.id));
      setSelectedLaporans(pendingLaporan.map(lap => lap.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedLogs.length === 0 && selectedLaporans.length === 0) return;
    setIsBulkApproving(true);

    let successCount = 0;
    try {
      // Loop berurutan (sequential) untuk mencegah limitasi GAS saat request paralel
      for (const id of selectedLaporans) {
        await api.reviewApprove('laporan', id, reviewerToken);
        successCount++;
      }
      for (const id of selectedLogs) {
        await api.reviewApprove('logbook', id, reviewerToken);
        successCount++;
      }

      showToast(`${successCount} dokumen berhasil disetujui sekaligus!`, 'success');
      setSelectedLogs([]);
      setSelectedLaporans([]);
      await loadQueue();
    } catch (err) {
      showToast(`Sebagian gagal. ${successCount} berhasil. Error: ${err.message}`, 'error');
      await loadQueue();
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Dicocokkan pakai kodeMk (Kode MK, stabil) -- BUKAN mkId (ID baris
  // MkRekognisi, berubah tiap Bagian 2 disimpan ulang lewat
  // save_profil_step2). pemetaanMk sekarang menyimpan { kodeMk, jam },
  // BUKAN lagi { mkId, jam } -- lihat catatan yang sama di
  // App.jsx (DashboardView.mkProgress & LogbookFormView.handleMkMapChange).
  // Tanpa perbaikan ini, reviewer selalu melihat "Unknown MK" untuk
  // setiap logbook walau datanya valid.
  const getLogMkNames = (log, mataKuliahList) => {
    if (!log.pemetaanMk || !mataKuliahList) return '';
    return log.pemetaanMk.map(pem => {
      const mk = mataKuliahList.find(m => m.kode === pem.kodeMk);
      return mk ? mk.nama : 'Unknown MK';
    }).join(', ');
  };

  const selectedMhsMkProgress = useMemo(() => {
    if (!detailData) return [];
    const { mataKuliah, logbooks } = detailData;
    return (mataKuliah || []).map(mk => {
      const targetHours = parseInt(mk.sks) * 45;
      const currentHours = (logbooks || []).reduce((total, lb) => {
        // Sama seperti getLogMkNames di atas -- cocokkan pakai kodeMk,
        // bukan mkId, supaya capaian SKS di sisi reviewer sinkron dengan
        // apa yang dilihat mahasiswa di Dashboard-nya sendiri.
        const mapped = lb.pemetaanMk?.find(m => m.kodeMk === mk.kode);
        return total + (mapped && lb.status !== 'Draf' ? Number(mapped.jam) : 0);
      }, 0);
      const percentage = Math.min(100, Math.round((currentHours / targetHours) * 100)) || 0;
      return { ...mk, targetHours, currentHours, percentage };
    });
  }, [detailData]);

  // Mahasiswa Bimbingan + flag "Perlu Perhatian" (dari server kalau ada,
  // fallback dihitung sendiri dari progressPercentage vs timePercentage
  // kalau server belum kirim field isAtRisk -- lihat computeIsAtRisk).
  // Jumlah logbook/laporan pending dihitung dari antrean yang sudah kita
  // punya di state (pendingLogs/pendingLaporan), jadi tetap akurat walau
  // field progres jam dari server belum tersedia.
  const mhsListEnriched = useMemo(() => {
    return mhsList.map(m => ({
      ...m,
      _isAtRisk: computeIsAtRisk(m),
      _pendingLogCount: pendingLogs.filter(l => l.nim === m.nim).length,
      _pendingLaporanCount: pendingLaporan.filter(l => l.nim === m.nim).length,
    }));
  }, [mhsList, pendingLogs, pendingLaporan]);

  const atRiskCount = useMemo(() => mhsListEnriched.filter(m => m._isAtRisk).length, [mhsListEnriched]);

  const filteredMhsList = useMemo(() => {
    const term = (mhsSearchTerm || '').toLowerCase();
    let rows = mhsListEnriched.filter(m =>
      (m.nama || '').toLowerCase().includes(term) ||
      (m.nim || '').toLowerCase().includes(term) ||
      (m.prodi || '').toLowerCase().includes(term) ||
      (m.mitra || '').toLowerCase().includes(term)
    );
    if (onlyAtRisk) rows = rows.filter(m => m._isAtRisk);
    // Urutkan yang perlu perhatian ke atas dulu supaya gampang ke-notice
    // oleh Mentor/DPL tanpa perlu scroll, baru alfabetis di dalam grup.
    rows.sort((a, b) => {
      if (a._isAtRisk !== b._isAtRisk) return a._isAtRisk ? -1 : 1;
      return (a.nama || '').localeCompare(b.nama || '', 'id');
    });
    return rows;
  }, [mhsListEnriched, mhsSearchTerm, onlyAtRisk]);

  // Export Excel daftar Mahasiswa Bimbingan (mengikuti hasil search/filter
  // yang sedang aktif) -- 1 sheet, kolom-kolom yang tersedia dari data
  // yang sudah dipunyai reviewer (tanpa perlu fetch tambahan per mahasiswa).
  // Export Excel daftar Mahasiswa Bimbingan (mengikuti hasil search/filter
  // yang sedang aktif) -- 2 sheet: (1) Data Mahasiswa lengkap, (2) Detail
  // MK Rekognisi per mahasiswa.
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const rows = filteredMhsList.map(m => ({
        NIM: m.nim,
        Nama: m.nama,
        Prodi: m.prodi || '-',
        WhatsApp: m.wa || '-',
        'Tanggal Awal Penugasan': formatDateIndoShort(m.tglAwal),
        'Tanggal Akhir Penugasan': formatDateIndoShort(m.tglAkhir),
        'Jumlah SKS Rekognisi': (m.mataKuliah || []).reduce((acc, mk) => acc + (Number(mk.sks) || 0), 0),
        'Jenis Program': m.jenisProgram || '-',
        Mitra: m.mitra || '-',
        'Jam Tercapai': m.currentHours ?? '-',
        'Target Jam': m.targetHours ?? '-',
        'Progres Jam (%)': m.progressPercentage ?? '-',
        'Progres Waktu (%)': m.timePercentage ?? '-',
        'Perlu Perhatian': m._isAtRisk ? 'Ya' : 'Tidak',
        'Logbook Pending': m._pendingLogCount,
        'Laporan Pending': m._pendingLaporanCount,
        'Link Laporan': m.laporanFileLink || '-',
        'Link SK DPL': m.dokumen?.skDpl || '-',
      }));

      if (rows.length === 0) {
        showToast('Tidak ada data untuk diexport.', 'error');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 18 }));

      // Sheet ke-2: detail MK Rekognisi per mahasiswa
      const sheetMk = [];
      filteredMhsList.forEach(m => {
        (m.mataKuliah || []).forEach(mk => {
          sheetMk.push({
            NIM: m.nim,
            'Nama Lengkap': m.nama,
            'MK Rekognisi': mk.nama,
            'Progress MK': mk.percentage,
          });
        });
      });
      const wsMk = XLSX.utils.json_to_sheet(sheetMk);
      wsMk['!cols'] = [{ wch: 16 }, { wch: 24 }, { wch: 28 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Mahasiswa Bimbingan');
      XLSX.utils.book_append_sheet(wb, wsMk, 'MK Rekognisi');

      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Mahasiswa_Bimbingan_${today}.xlsx`);
      showToast('Export Excel berhasil.', 'success');
    } catch (err) {
      showToast('Gagal export Excel.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (!hasToken) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen p-8 text-center">
        <Lock className="w-10 h-10 text-rose-500 mb-3" />
        <p className="text-sm font-bold text-slate-700 mb-1">Akses Ditolak</p>
        <p className="text-xs text-slate-500">
          Halaman ini hanya bisa diakses lewat tautan aman (magic link) yang dikirim ke WhatsApp Mentor/DPL.
        </p>
      </div>
    );
  }

  if (isLoadingQueue) return <PageLoader label="Memuat antrean review..." />;

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen p-8 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
        <p className="text-sm font-bold text-slate-700 mb-1">Gagal memuat data</p>
        <p className="text-xs text-slate-500 mb-4">{loadError}</p>
        <button onClick={loadQueue} className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl">Coba Lagi</button>
      </div>
    );
  }

  if (selectedMhsId) {
    const mhs = mhsList.find(m => m.id === selectedMhsId);
    if (detailLoading || !detailData) {
      return (
        <div className="flex flex-col h-full bg-slate-50">
          <div className="bg-white/90 backdrop-blur-md px-6 pt-8 pb-4 shadow-sm border-b border-slate-100 sticky top-0 z-20 flex items-center gap-4">
            <button onClick={() => setSelectedMhsId(null)} className="p-2 -ml-2 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
              <ChevronLeft className="w-6 h-6 text-slate-700" />
            </button>
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight truncate">{mhs?.nama || 'Memuat...'}</h1>
          </div>
          <PageLoader label="Memuat data mahasiswa..." />
        </div>
      );
    }
    const mhsLogs = [...(detailData.logbooks || [])].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    const mhsLaporans = [...(detailData.laporan || [])].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="bg-white/90 backdrop-blur-md px-6 pt-8 pb-4 shadow-sm border-b border-slate-100 sticky top-0 z-20 flex items-center gap-4">
          <button onClick={() => setSelectedMhsId(null)} className="p-2 -ml-2 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-700" />
          </button>
          <div className="flex-1 truncate">
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight truncate">{detailData.mahasiswa?.nama}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{detailData.mahasiswa?.nim} • {detailData.mahasiswa?.prodi}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wider">Capaian SKS</h2>
            <div className="grid grid-cols-2 gap-3">
              {selectedMhsMkProgress.map(mk => (
                <div key={mk.id} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 hover:border-indigo-100 transition-colors">
                  <div className="relative w-12 h-12 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                      <path strokeDasharray={`${mk.percentage}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={mk.percentage === 100 ? '#10B981' : '#6366F1'} strokeWidth="4" strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-black text-slate-700">{mk.percentage}%</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-800 truncate leading-tight">{mk.nama}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">{mk.currentHours}/{mk.targetHours} Jam</p>
                  </div>
                </div>
              ))}
              {selectedMhsMkProgress.length === 0 && (
                <div className="col-span-2 text-center p-4 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-xs font-medium text-slate-400">Belum ada matakuliah direkognisi.</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-2">
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
                    <span className="text-xs font-bold text-slate-500">{formatDateIndoShort(lap.tanggal)}</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-50 mb-3">
                    <FileText className="w-6 h-6 text-emerald-500 shrink-0" />
                    {lap.fileLink ? (
                      <a href={lap.fileLink} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-700 truncate hover:underline">{lap.fileName}</a>
                    ) : (
                      <p className="text-sm font-bold text-slate-700 truncate">{lap.fileName}</p>
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
              {mhsLaporans.length === 0 && <p className="text-xs font-medium text-slate-400 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">Mahasiswa belum mengunggah Laporan Akhir.</p>}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" /> Riwayat Logbook
            </h2>
            <div className="space-y-4">
              {mhsLogs.map(log => (
                <div key={log.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-100 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(log.status)}`}>
                      {log.status}
                    </span>
                    <span className="text-xs font-bold text-slate-500">{formatDateIndoShort(log.tanggal)} • {log.durasi} Jam</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 mb-1">{log.kegiatan.join(', ')}</p>
                  <p className="text-xs text-slate-500 mb-2 leading-relaxed">{log.deskripsi}</p>

                  {log.foto && log.foto.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                      {log.foto.map((img, i) => (
                        <a key={i} href={getSafeImageUrl(img)} target="_blank" rel="noreferrer">
                          <img src={getSafeImageUrl(img)} alt={`Doc ${i}`} className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-medium text-slate-600 border border-slate-100 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> <span className="truncate">{getLogMkNames(log, detailData.mataKuliah)}</span>
                  </div>

                  {log.status.includes('Menunggu') && (
                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
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
              {mhsLogs.length === 0 && <p className="text-center text-sm text-slate-400 py-4 border border-dashed border-slate-200 rounded-2xl">Belum ada riwayat.</p>}
            </div>
          </div>
        </div>

        {revisiModal.isOpen && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex flex-col justify-end">
            <div className="bg-white rounded-t-[2rem] p-6 animate-in slide-in-from-bottom-full duration-300">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Catatan Revisi {revisiModal.type === 'logbook' ? 'Logbook' : 'Laporan'}</h3>
              <p className="text-xs text-slate-500 mb-4">Beritahu mahasiswa apa yang perlu diperbaiki.</p>
              <textarea
                autoFocus
                disabled={isSubmittingRevisi}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-32 resize-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-4 disabled:opacity-60"
                placeholder="Contoh: Tolong lengkapi dengan format yang benar..."
                value={revisiModal.text}
                onChange={(e) => setRevisiModal({ ...revisiModal, text: e.target.value })}
              />
              <div className="flex gap-3">
                <button onClick={() => setRevisiModal({ isOpen: false, itemId: null, type: '', text: '' })} disabled={isSubmittingRevisi} className="px-6 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 disabled:opacity-50">Batal</button>
                <button onClick={handleSubmitRevisi} disabled={isSubmittingRevisi} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-70">
                  {isSubmittingRevisi ? <ButtonSpinner className="w-4 h-4" /> : <Send className="w-4 h-4" />} Kirim Revisi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const isAllSelected = (pendingLogs.length > 0 || pendingLaporan.length > 0) && (selectedLogs.length === pendingLogs.length && selectedLaporans.length === pendingLaporan.length);
  const totalSelectedCount = selectedLogs.length + selectedLaporans.length;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-slate-900 text-white px-6 pt-10 pb-20 rounded-b-[2.5rem] shadow-xl relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <p className="text-emerald-400 font-bold text-[10px] tracking-widest uppercase mb-1 flex items-center gap-2">
          <Lock className="w-3 h-3" /> Akses Aman (Token)
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
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-900/5 p-1 flex gap-1 border border-slate-100">
          <button
            onClick={() => setActiveTab('antrean')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'antrean' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Antrean Review
          </button>
          <button
            onClick={() => setActiveTab('mahasiswa')}
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all relative flex items-center justify-center gap-1.5 ${activeTab === 'mahasiswa' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Mahasiswa
            {atRiskCount > 0 && (
              <span className={`text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ${activeTab === 'mahasiswa' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
                {atRiskCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-2 pb-32 relative">
        {activeTab === 'antrean' && (
          (pendingLogs.length === 0 && pendingLaporan.length === 0) ? (
            <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100 shadow-sm mt-4">
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Semua Selesai!</h3>
              <p className="text-sm font-medium text-slate-500">Tidak ada antrean logbook maupun laporan.</p>
            </div>
          ) : (
            <div className="space-y-5">

              <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-0 z-20">
                <h3 className="font-bold text-slate-700 text-sm">Aksi Massal</h3>
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors"
                >
                  {isAllSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </button>
              </div>

              {pendingLaporan.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Antrean Laporan Akhir</h3>
                  <div className="space-y-4">
                    {pendingLaporan.map(lap => {
                      const mhs = lap.mahasiswa || mhsList.find(m => m.id === lap.nim) || {};
                      const isSelected = selectedLaporans.includes(lap.id);
                      return (
                        <div key={lap.id} className={`bg-emerald-50/50 p-5 rounded-[2rem] shadow-sm border transition-colors ${isSelected ? 'border-emerald-400 bg-emerald-100/50' : 'border-emerald-100'}`}>
                          <div className="flex justify-between items-start mb-4 border-b border-emerald-100/50 pb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-6 h-6 border-2 rounded-md flex items-center justify-center cursor-pointer transition-colors shrink-0"
                                onClick={(e) => { e.stopPropagation(); toggleLaporanSelection(lap.id); }}
                                style={{ borderColor: isSelected ? '#10B981' : '#CBD5E1', backgroundColor: isSelected ? '#10B981' : 'transparent' }}
                              >
                                {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                              </div>

                              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center font-bold text-emerald-700">
                                {mhs.nama?.charAt(0) || '?'}
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-800">{mhs.nama}</h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{mhs.nim}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-800">{formatDateIndoShort(lap.tanggal)}</p>
                              <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md mt-1 inline-block">Pending</span>
                            </div>
                          </div>

                          <div className="mb-4 bg-white p-3 rounded-xl border border-emerald-50 flex items-center gap-3">
                            <FileText className="w-6 h-6 text-emerald-500 shrink-0" />
                            {lap.fileLink ? (
                              <a href={lap.fileLink} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-700 truncate hover:underline">{lap.fileName}</a>
                            ) : (
                              <p className="text-sm font-bold text-slate-700 truncate">{lap.fileName}</p>
                            )}
                          </div>

                          <div className="flex gap-3 mt-4 pt-3 border-t border-emerald-100/50">
                            <button
                              onClick={() => handleApprove(lap.id, 'laporan')}
                              disabled={actionLoadingId === lap.id || isBulkApproving}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                              {actionLoadingId === lap.id ? <ButtonSpinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} Setujui
                            </button>
                            <button onClick={() => setRevisiModal({ isOpen: true, itemId: lap.id, type: 'laporan', text: '' })} className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-100 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex justify-center items-center gap-2">
                              <AlertCircle className="w-4 h-4" /> Revisi
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pendingLogs.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Antrean Logbook Harian</h3>
                  <div className="space-y-4">
                    {pendingLogs.map(log => {
                      const mhs = log.mahasiswa || {};
                      const isSelected = selectedLogs.includes(log.id);
                      return (
                        <div key={log.id} className={`bg-white p-5 rounded-[2rem] shadow-sm border transition-colors ${isSelected ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-100'}`}>
                          <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-6 h-6 border-2 rounded-md flex items-center justify-center cursor-pointer transition-colors shrink-0"
                                onClick={(e) => { e.stopPropagation(); toggleLogSelection(log.id); }}
                                style={{ borderColor: isSelected ? '#10B981' : '#CBD5E1', backgroundColor: isSelected ? '#10B981' : 'transparent' }}
                              >
                                {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                              </div>

                              <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-600">
                                {mhs.nama?.charAt(0) || '?'}
                              </div>
                              <div>
                                <h3 className="font-bold text-slate-800">{mhs.nama}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{mhs.nim}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-slate-800">{formatDateIndoShort(log.tanggal)}</p>
                              <p className="text-[10px] font-bold text-slate-500 mt-0.5">{log.durasi} Jam</p>
                            </div>
                          </div>

                          <div className="mb-4">
                            <p className="text-sm font-bold text-slate-800 mb-1">{log.kegiatan.join(', ')}</p>
                            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed mb-3">
                              {log.deskripsi}
                            </p>
                          </div>

                          <div className="flex gap-3 mt-4 pt-3 border-t border-slate-50">
                            <button
                              onClick={() => handleApprove(log.id, 'logbook')}
                              disabled={actionLoadingId === log.id || isBulkApproving}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                              {actionLoadingId === log.id ? <ButtonSpinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} Setujui
                            </button>
                            <button onClick={() => setRevisiModal({ isOpen: true, itemId: log.id, type: 'logbook', text: '' })} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95 flex justify-center items-center gap-2">
                              <AlertCircle className="w-4 h-4" /> Revisi
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === 'mahasiswa' && (
          <div className="space-y-4">
            {/* SEARCH + FILTER + EXPORT */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, NIM, prodi, atau mitra..."
                  value={mhsSearchTerm}
                  onChange={(e) => setMhsSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                {mhsSearchTerm && (
                  <button onClick={() => setMhsSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setOnlyAtRisk(prev => !prev)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors border
                    ${onlyAtRisk ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Perlu Perhatian {atRiskCount > 0 ? `(${atRiskCount})` : ''}
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60"
                >
                  {isExporting ? <ButtonSpinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} Export Excel
                </button>
              </div>
            </div>

            {/* LIST MAHASISWA */}
            <div className="space-y-3">
              {filteredMhsList.map(mhs => {
                const totalPending = mhs._pendingLogCount + mhs._pendingLaporanCount;
                const adaProgres = typeof mhs.progressPercentage === 'number';
                const waHref = waLink(mhs.wa, buildReminderMessage(mhs, reviewerInfo));

                return (
                  <div
                    key={mhs.id}
                    className={`bg-white p-4 rounded-2xl shadow-sm border transition-all group ${mhs._isAtRisk ? 'border-rose-200 shadow-rose-100/50' : 'border-slate-100 hover:border-indigo-200'}`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMhsId(mhs.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedMhsId(mhs.id); } }}
                      className="flex items-center gap-4 cursor-pointer"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold shrink-0 transition-colors ${mhs._isAtRisk ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600'}`}>
                        {mhs.nama.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 truncate">{mhs.nama}</h3>
                          {mhs._isAtRisk && (
                            <span className="shrink-0 flex items-center gap-1 bg-rose-100 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                              <AlertCircle className="w-2.5 h-2.5" /> Perhatian
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{mhs.nim} • {mhs.prodi}</p>
                        {mhs.mitra && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 shrink-0" /> {mhs.mitra}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                        {totalPending > 0 && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-md">{totalPending} Antrean</span>}
                      </div>
                    </div>

                    {adaProgres && (
                      <div className="mt-3">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Progres Jam Logbook</span>
                          <span className={`text-[10px] font-black ${mhs._isAtRisk ? 'text-rose-600' : 'text-indigo-600'}`}>{mhs.progressPercentage}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${mhs._isAtRisk ? 'bg-rose-500' : mhs.progressPercentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, mhs.progressPercentage)}%` }}
                          />
                        </div>
                        {(typeof mhs.currentHours === 'number' && typeof mhs.targetHours === 'number') && (
                          <p className="text-[9px] font-bold text-slate-400 mt-1">{mhs.currentHours}/{mhs.targetHours} Jam</p>
                        )}
                      </div>
                    )}

                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-colors
                          ${mhs._isAtRisk ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                      >
                        <FaWhatsapp className="w-3.5 h-3.5" />
                        {mhs._isAtRisk ? 'Ingatkan Isi Logbook' : 'Kirim Pesan WA'}
                      </a>
                    )}
                  </div>
                );
              })}

              {filteredMhsList.length === 0 && (
                <div className="text-center p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                  <FileWarning className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-400">Tidak ada mahasiswa yang cocok dengan pencarian/filter.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {totalSelectedCount > 0 && activeTab === 'antrean' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-11/12 max-w-lg bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-40 flex justify-between items-center animate-in slide-in-from-bottom-10 border border-slate-700">
          <div className="flex flex-col">
            <span className="text-sm font-bold flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px]">{totalSelectedCount}</span>
              Item Terpilih
            </span>
            <button
              onClick={() => { setSelectedLogs([]); setSelectedLaporans([]); }}
              className="text-[10px] text-slate-400 text-left hover:text-white transition-colors mt-1"
            >
              Batalkan Pilihan
            </button>
          </div>
          <button
            onClick={handleBulkApprove}
            disabled={isBulkApproving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-70 shadow-lg shadow-emerald-500/20"
          >
            {isBulkApproving ? <ButtonSpinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} Setujui Terpilih
          </button>
        </div>
      )}

      {revisiModal.isOpen && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-[2rem] p-6 animate-in slide-in-from-bottom-full duration-300 shadow-[0_-20px_40px_-10px_rgba(0,0,0,0.2)]">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" /> Catatan Revisi {revisiModal.type === 'logbook' ? 'Logbook' : 'Laporan'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">Beritahu mahasiswa apa yang perlu diperbaiki.</p>
            <textarea
              autoFocus
              disabled={isSubmittingRevisi}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-32 resize-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-4 font-medium text-slate-700 disabled:opacity-60"
              placeholder="Contoh: Tolong lengkapi deskripsi dengan hasil dari rapat..."
              value={revisiModal.text}
              onChange={(e) => setRevisiModal({ ...revisiModal, text: e.target.value })}
            />
            <div className="flex gap-3">
              <button onClick={() => setRevisiModal({ isOpen: false, itemId: null, type: '', text: '' })} disabled={isSubmittingRevisi} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleSubmitRevisi} disabled={isSubmittingRevisi} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-70">
                {isSubmittingRevisi ? <ButtonSpinner className="w-4 h-4" /> : <Send className="w-4 h-4" />} Kirim Revisi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-0 pointer-events-none">
        <span className="bg-slate-200/50 backdrop-blur-sm text-slate-500 text-[9px] font-bold px-3 py-1.5 rounded-full">
          Portal aman, tidak memerlukan sesi login.
        </span>
      </div>
    </div>
  );
};

export default ReviewerView;