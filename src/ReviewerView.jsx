import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, FileText, BookOpen,
  Download, Send, Loader2, Search, MapPin, FileWarning, X, HelpCircle
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import * as XLSX from 'xlsx';

import { api } from './api';

// =====================================================================
// UTIL LOKAL
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

const waLink = (wa, text) => {
  if (!wa) return null;
  const number = String(wa).replace(/[^0-9]/g, '');
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
};

const buildSenderLabel = (reviewerInfo) => {
  if (!reviewerInfo?.nama) return '';
  return reviewerInfo.role === 'dpl' ? `DPL ${reviewerInfo.nama}` : `Mentor ${reviewerInfo.nama}`;
};

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

const computeIsAtRisk = (m) => {
  if (typeof m.isAtRisk === 'boolean') return m.isAtRisk;
  if (typeof m.progressPercentage === 'number' && typeof m.timePercentage === 'number') {
    return m.progressPercentage < m.timePercentage;
  }
  return false;
};

// =====================================================================
// MODAL BANTUAN
// =====================================================================
const STATUS_HELP_ITEMS_ = [
  { no: 1, badges: ['Draf'], desc: 'Logbook atau Laporan masih dalam tahap pengerjaan.', points: ['Hanya dapat dilihat oleh Mahasiswa.', 'Belum dapat dilihat oleh Mentor maupun DPL.'] },
  { no: 2, badges: ['Menunggu Persetujuan Mentor'], desc: 'Logbook atau Laporan telah dikirim dan sedang menunggu persetujuan dari Mentor.', points: ['Akan muncul di sisi Mentor pada tab Antrean Review.', 'Mentor juga dapat melihat Logbook atau Laporan mahasiswa tertentu melalui tab Mahasiswa, kemudian memilih mahasiswa bimbingannya.'] },
  { no: 3, badges: ['Menunggu Persetujuan DPL'], desc: 'Logbook atau Laporan telah melalui tahap persetujuan Mentor dan sedang menunggu persetujuan dari DPL.', points: ['Akan muncul di sisi DPL pada tab Antrean Review.', 'DPL juga dapat melihat Logbook atau Laporan mahasiswa tertentu melalui tab Mahasiswa, kemudian memilih mahasiswa bimbingannya.'] },
  { no: 4, badges: ['Disetujui'], desc: 'Logbook atau Laporan telah selesai melalui seluruh proses persetujuan.', points: ['Sudah disetujui oleh Mentor dan DPL.', 'Tidak ada tindakan lebih lanjut yang perlu dilakukan.'] },
  { no: 5, badges: ['Revisi Mentor', 'Revisi DPL'], desc: 'Logbook atau Laporan perlu diperbaiki berdasarkan masukan dari Mentor atau DPL.', points: ['Data yang berstatus Revisi akan hilang dari Antrean Review.', 'Logbook atau Laporan akan kembali ke sisi Mahasiswa untuk diperbaiki dan dikirim ulang.'] }
];

const StatusHelpModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col justify-end sm:justify-center sm:items-center sm:p-6 transition-all duration-300">
    <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] max-h-[90vh] w-full sm:max-w-lg md:max-w-xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300 relative overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0 bg-white">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0" /> Status Logbook dan Laporan
        </h3>
        <button onClick={onClose} className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
        <p className="text-sm text-slate-500 leading-relaxed mb-5">
          Logbook dan Laporan memiliki 5 status, yaitu:
        </p>

        <div className="space-y-6">
          {STATUS_HELP_ITEMS_.map(item => (
            <div key={item.no}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-sm">
                  {item.no}
                </span>
                {item.badges.map(b => (
                  <span key={b} className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(b)}`}>
                    {b}
                  </span>
                ))}
              </div>
              <p className="text-sm text-slate-700 font-medium leading-relaxed mb-1.5 break-words">{item.desc}</p>
              <ul className="text-sm text-slate-500 leading-relaxed list-disc list-inside space-y-1 pl-1">
                {item.points.map((pt, i) => <li key={i} className="break-words">{pt}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="h-px bg-slate-100 my-6" />

        <h4 className="text-base font-extrabold text-slate-800 mb-4">Catatan Penting</h4>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-bold text-slate-700 mb-1">1. Jika Mahasiswa Tidak Mengisi Data Mentor</p>
            <p className="text-sm text-slate-500 leading-relaxed break-words">
              Jika Mahasiswa mengosongkan data Mentor pada profil, maka Logbook dan Laporan tidak akan melalui tahap verifikasi Mentor. Alurnya langsung menuju tahap verifikasi DPL.
            </p>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-700 mb-1">2. Pengisian Logbook Harian</p>
            <p className="text-sm text-slate-500 leading-relaxed break-words mb-2">
              Mahasiswa dapat memilih salah satu cara berikut:
            </p>
            <ul className="text-sm text-slate-500 leading-relaxed list-disc list-inside space-y-1 pl-1 mb-2">
              <li className="break-words">Opsi 1: Membuat 1 Logbook yang berisi beberapa kegiatan dalam satu hari.</li>
              <li className="break-words">Opsi 2: Membuat beberapa Logbook, dengan setiap Logbook berisi 1 kegiatan.</li>
            </ul>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 mt-3">
              <p className="text-sm text-indigo-700 leading-relaxed break-words font-medium">
                💡 Saran: Gunakan Opsi 1 untuk menghemat penggunaan penyimpanan sistem dan mempermudah rekapitulasi.
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-700 mb-1">3. Simpan Tautan Antrean</p>
            <p className="text-sm text-slate-500 leading-relaxed break-words">
              Setiap pembaruan terkait antrean akan selalu menggunakan tautan (Magic Link) yang sama. Silakan <i>bookmark</i> atau simpan tautan ini.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
        <button onClick={onClose} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-colors active:scale-[0.98]">
          Mengerti & Tutup
        </button>
      </div>
    </div>
  </div>
);

const PageLoader = ({ label = 'Memuat data...' }) => (
  <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-full w-full">
    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    <p className="mt-4 text-slate-500 font-bold text-sm tracking-widest uppercase text-center px-8">{label}</p>
  </div>
);
const ButtonSpinner = ({ className = '' }) => (
  <Loader2 className={`w-5 h-5 animate-spin ${className}`} />
);

// =====================================================================
// REVIEWER VIEW (Mentor/DPL)
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

  const [mhsSearchTerm, setMhsSearchTerm] = useState('');
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

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

  const toggleLogSelection = (id) => setSelectedLogs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleLaporanSelection = (id) => setSelectedLaporans(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

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
        const mapped = lb.pemetaanMk?.find(m => m.kodeMk === mk.kode);
        return total + (mapped && lb.status !== 'Draf' ? Number(mapped.jam) : 0);
      }, 0);
      const percentage = Math.min(100, Math.round((currentHours / targetHours) * 100)) || 0;
      return { ...mk, targetHours, currentHours, percentage };
    });
  }, [detailData]);

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
    rows.sort((a, b) => {
      if (a._isAtRisk !== b._isAtRisk) return a._isAtRisk ? -1 : 1;
      return (a.nama || '').localeCompare(b.nama || '', 'id');
    });
    return rows;
  }, [mhsListEnriched, mhsSearchTerm, onlyAtRisk]);

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

      const sheetMk = [];
      filteredMhsList.forEach(m => {
        (m.mataKuliah || []).forEach(mk => {
          sheetMk.push({ NIM: m.nim, 'Nama Lengkap': m.nama, 'MK Rekognisi': mk.nama, 'Progress MK': mk.percentage });
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

  // --- RENDERING VIEWS ---

  if (!hasToken) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen p-8 text-center">
        <Lock className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-base font-bold text-slate-700 mb-2">Akses Ditolak</p>
        <p className="text-sm text-slate-500 max-w-sm">
          Halaman ini hanya bisa diakses lewat tautan aman (magic link) yang dikirim ke WhatsApp Mentor/DPL.
        </p>
      </div>
    );
  }

  if (isLoadingQueue) return <PageLoader label="Memuat antrean review..." />;

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-screen p-8 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-base font-bold text-slate-700 mb-2">Gagal memuat data</p>
        <p className="text-sm text-slate-500 mb-6 max-w-sm">{loadError}</p>
        <button onClick={loadQueue} className="px-6 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl active:scale-95 transition-all">Coba Lagi</button>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: DETAIL MAHASISWA
  // ==========================================
  if (selectedMhsId) {
    const mhs = mhsList.find(m => m.id === selectedMhsId);
    
    if (detailLoading || !detailData) {
      return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden w-full">
          <div className="bg-white/90 backdrop-blur-md px-4 sm:px-6 pt-6 pb-4 shadow-sm border-b border-slate-100 z-20 shrink-0">
            <div className="max-w-7xl mx-auto flex items-center gap-4">
              <button onClick={() => setSelectedMhsId(null)} className="p-2 -ml-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
                <ChevronLeft className="w-6 h-6 text-slate-700" />
              </button>
              <h1 className="text-lg font-extrabold text-slate-800 tracking-tight truncate">{mhs?.nama || 'Memuat...'}</h1>
            </div>
          </div>
          <PageLoader label="Memuat data mahasiswa..." />
        </div>
      );
    }
    
    const mhsLogs = [...(detailData.logbooks || [])].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    const mhsLaporans = [...(detailData.laporan || [])].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    return (
      <div className="flex flex-col h-screen bg-slate-50 overflow-hidden w-full relative">
        {/* Sticky Header Detail */}
        <div className="bg-white/90 backdrop-blur-md px-4 sm:px-6 pt-6 sm:pt-8 pb-4 shadow-sm border-b border-slate-100 z-20 shrink-0 w-full">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <button onClick={() => setSelectedMhsId(null)} className="p-2 -ml-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
              <ChevronLeft className="w-6 h-6 text-slate-700" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight truncate">{detailData.mahasiswa?.nama}</h1>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{detailData.mahasiswa?.nim} • {detailData.mahasiswa?.prodi}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Detail Content */}
        <div className="flex-1 overflow-y-auto w-full">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 pb-32">
            
            {/* Section SKS */}
            <section>
              <h2 className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wider">Capaian SKS</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {selectedMhsMkProgress.map(mk => (
                  <div key={mk.id} className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 hover:border-indigo-100 transition-colors">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                        <path strokeDasharray={`${mk.percentage}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={mk.percentage === 100 ? '#10B981' : '#6366F1'} strokeWidth="4" strokeLinecap="round" className="transition-all duration-1000" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] sm:text-xs font-black text-slate-700">{mk.percentage}%</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] sm:text-xs font-bold text-slate-800 truncate leading-tight">{mk.nama}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">{mk.currentHours} / {mk.targetHours} Jam</p>
                    </div>
                  </div>
                ))}
                {selectedMhsMkProgress.length === 0 && (
                  <div className="col-span-full text-center p-6 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
                    <p className="text-xs font-medium text-slate-500">Belum ada matakuliah direkognisi.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Section Laporan Akhir */}
            <section>
              <h2 className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-500" /> Laporan Akhir
              </h2>
              <div className="space-y-3">
                {mhsLaporans.map(lap => (
                  <div key={lap.id} className="bg-emerald-50/50 p-4 sm:p-5 rounded-2xl shadow-sm border border-emerald-100">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider
                        ${lap.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' :
                          lap.status.includes('Revisi') ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'}`}>
                        {lap.status}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{formatDateIndoShort(lap.tanggal)}</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-3 sm:p-4 rounded-xl border border-emerald-50 mb-3">
                      <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500 shrink-0" />
                      {lap.fileLink ? (
                        <a href={lap.fileLink} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-700 truncate hover:underline">{lap.fileName}</a>
                      ) : (
                        <p className="text-sm font-bold text-slate-700 truncate">{lap.fileName}</p>
                      )}
                    </div>

                    {lap.status.includes('Menunggu') && (
                      <div className="flex gap-2 sm:gap-3 mt-4">
                        <button
                          onClick={() => handleApprove(lap.id, 'laporan')}
                          disabled={actionLoadingId === lap.id}
                          className="flex-1 bg-emerald-500 text-white py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-70 shadow-sm shadow-emerald-500/20"
                        >
                          {actionLoadingId === lap.id ? <ButtonSpinner className="w-4 h-4" /> : null} Approve
                        </button>
                        <button onClick={() => setRevisiModal({ isOpen: true, itemId: lap.id, type: 'laporan', text: '' })} className="flex-1 bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold active:scale-95 transition-transform">Revisi</button>
                      </div>
                    )}
                  </div>
                ))}
                {mhsLaporans.length === 0 && <p className="text-xs font-medium text-slate-500 bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">Mahasiswa belum mengunggah Laporan Akhir.</p>}
              </div>
            </section>

            {/* Section Riwayat Logbook */}
            <section>
              <h2 className="text-sm font-extrabold text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" /> Riwayat Logbook
              </h2>
              <div className="space-y-4">
                {mhsLogs.map(log => (
                  <div key={log.id} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-100 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${getStatusBadgeClass(log.status)}`}>
                        {log.status}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{formatDateIndoShort(log.tanggal)} • <span className="text-slate-700">{log.durasi} Jam</span></span>
                    </div>
                    
                    <p className="text-sm font-bold text-slate-800 mb-1.5 break-words">{log.kegiatan.join(', ')}</p>
                    <p className="text-xs sm:text-sm text-slate-500 mb-3 leading-relaxed break-words whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-50">{log.deskripsi}</p>

                    {log.foto && log.foto.length > 0 && (
                      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                        {log.foto.map((img, i) => (
                          <a key={i} href={getSafeImageUrl(img)} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={getSafeImageUrl(img)} alt={`Doc ${i}`} className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    )}
                    
                    <div className="bg-indigo-50/50 px-3 py-2.5 rounded-xl text-[11px] font-medium text-indigo-800 border border-indigo-50 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" /> 
                      <span className="truncate">{getLogMkNames(log, detailData.mataKuliah)}</span>
                    </div>

                    {log.status.includes('Menunggu') && (
                      <div className="flex gap-2 sm:gap-3 mt-4 pt-4 border-t border-slate-100">
                        <button
                          onClick={() => handleApprove(log.id, 'logbook')}
                          disabled={actionLoadingId === log.id}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95 shadow-sm shadow-emerald-500/20"
                        >
                          {actionLoadingId === log.id ? <ButtonSpinner className="w-4 h-4" /> : null} Approve
                        </button>
                        <button onClick={() => setRevisiModal({ isOpen: true, itemId: log.id, type: 'logbook', text: '' })} className="flex-1 bg-white border border-rose-100 hover:bg-rose-50 text-rose-600 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-colors active:scale-95">Revisi</button>
                      </div>
                    )}
                  </div>
                ))}
                {mhsLogs.length === 0 && <p className="text-center text-sm text-slate-500 py-8 border-2 border-dashed border-slate-200 rounded-2xl">Belum ada riwayat aktivitas.</p>}
              </div>
            </section>
          </div>
        </div>

        {/* Modal Revisi dalam View Detail */}
        {revisiModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col justify-end sm:justify-center sm:items-center sm:p-6 transition-all duration-300">
            <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 w-full sm:max-w-md flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300 relative">
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" /> Catatan Revisi {revisiModal.type === 'logbook' ? 'Logbook' : 'Laporan'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-4">Beritahu mahasiswa apa yang perlu diperbaiki.</p>
              <textarea
                autoFocus
                disabled={isSubmittingRevisi}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-32 resize-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-5 font-medium text-slate-700 disabled:opacity-60"
                placeholder="Contoh: Tolong lengkapi dengan format yang benar..."
                value={revisiModal.text}
                onChange={(e) => setRevisiModal({ ...revisiModal, text: e.target.value })}
              />
              <div className="flex gap-3">
                <button onClick={() => setRevisiModal({ isOpen: false, itemId: null, type: '', text: '' })} disabled={isSubmittingRevisi} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 active:scale-95">Batal</button>
                <button onClick={handleSubmitRevisi} disabled={isSubmittingRevisi} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-70">
                  {isSubmittingRevisi ? <ButtonSpinner className="w-4 h-4" /> : <Send className="w-4 h-4" />} Kirim
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: MAIN DASHBOARD (Antrean & Mahasiswa)
  // ==========================================
  const isAllSelected = (pendingLogs.length > 0 || pendingLaporan.length > 0) && (selectedLogs.length === pendingLogs.length && selectedLaporans.length === pendingLaporan.length);
  const totalSelectedCount = selectedLogs.length + selectedLaporans.length;

  return (
    <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Header Banner - Responsive Max Width */}
      <div className="bg-slate-900 text-white pt-4 pb-14 rounded-b-[2.5rem] shadow-xl relative shrink-0 w-full z-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <button
            onClick={() => setShowHelpModal(true)}
            title="Status Logbook & Laporan"
            className="absolute top-0 right-4 sm:right-6 lg:right-8 z-20 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-95"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        

          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
            <img src="/untad.png" alt="Logo UNTAD" className="h-12 sm:h-16 w-auto object-contain" />
            <span className="text-2xl sm:text-3xl font-black tracking-widest text-white">SIDAMPAK</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">Portal Reviewer</h1>
          {reviewerInfo?.nama && (
            <p className="text-sm sm:text-base text-slate-300 mt-1 max-w-sm sm:max-w-md truncate">
              Halo, {reviewerInfo.role === 'dpl' ? 'Bapak/Ibu Dosen' : 'Bapak/Ibu'} <span className="font-bold text-white">{reviewerInfo.nama}</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-3 sm:gap-5 mt-6 sm:mt-8 max-w-7xl">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-5 border border-white/10 flex flex-col items-center justify-center">
              <p className="text-xl sm:text-2xl md:text-3xl font-black text-white">{mhsList.length}</p>
              <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">Mhs</p>
            </div>
            <div className="bg-indigo-500/20 backdrop-blur-md rounded-2xl p-3 sm:p-5 border border-indigo-500/30 flex flex-col items-center justify-center relative">
              {pendingLogs.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-500 rounded-full animate-ping"></span>}
              {pendingLogs.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-slate-900"></span>}
              <p className="text-xl sm:text-2xl md:text-3xl font-black text-indigo-300">{pendingLogs.length}</p>
              <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-indigo-300/80 uppercase tracking-wider mt-1">Logbook</p>
            </div>
            <div className="bg-emerald-500/20 backdrop-blur-md rounded-2xl p-3 sm:p-5 border border-emerald-500/30 flex flex-col items-center justify-center relative">
              {pendingLaporan.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-500 rounded-full animate-ping"></span>}
              {pendingLaporan.length > 0 && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-slate-900"></span>}
              <p className="text-xl sm:text-2xl md:text-3xl font-black text-emerald-300">{pendingLaporan.length}</p>
              <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-emerald-300/80 uppercase tracking-wider mt-1">Laporan</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Centered with max-w */}
      <div className="px-4 sm:px-6 lg:px-8 -mt-6 relative z-20 mb-3 shrink-0 w-full">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-900/5 p-1 flex gap-1 border border-slate-100 max-w-7xl">
            <button
              onClick={() => setActiveTab('antrean')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all ${activeTab === 'antrean' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Antrean Review
            </button>
            <button
              onClick={() => setActiveTab('mahasiswa')}
              className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all relative flex items-center justify-center gap-2 ${activeTab === 'mahasiswa' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              Mahasiswa
              {atRiskCount > 0 && (
                <span className={`text-[9px] sm:text-[10px] font-black w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center px-1.5 ${activeTab === 'mahasiswa' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
                  {atRiskCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto w-full relative pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8">
          
          {/* TAB: ANTREAN */}
          {activeTab === 'antrean' && (
            (pendingLogs.length === 0 && pendingLaporan.length === 0) ? (
              <div className="bg-white p-8 sm:p-12 rounded-[2rem] text-center border border-slate-100 shadow-sm mt-4 w-full">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-500" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">Semua Selesai!</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">Tidak ada antrean logbook maupun laporan yang perlu direview saat ini.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-0 z-20">
                  <h3 className="font-bold text-slate-700 text-sm">Aksi Massal</h3>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors active:scale-95"
                  >
                    {isAllSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
                  </button>
                </div>

                {pendingLaporan.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Download className="w-4 h-4" /> Antrean Laporan Akhir</h3>
                    <div className="space-y-4">
                      {pendingLaporan.map(lap => {
                        const mhs = lap.mahasiswa || mhsList.find(m => m.id === lap.nim) || {};
                        const isSelected = selectedLaporans.includes(lap.id);
                        return (
                          <div key={lap.id} className={`bg-emerald-50/40 p-4 sm:p-6 rounded-3xl shadow-sm border transition-colors ${isSelected ? 'border-emerald-400 bg-emerald-100/40' : 'border-emerald-100/60'}`}>
                            <div className="flex justify-between items-start mb-4 border-b border-emerald-100/50 pb-4">
                              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-3">
                                <div
                                  className="w-6 h-6 sm:w-7 sm:h-7 border-2 rounded-lg flex items-center justify-center cursor-pointer transition-colors shrink-0 bg-white"
                                  onClick={(e) => { e.stopPropagation(); toggleLaporanSelection(lap.id); }}
                                  style={{ borderColor: isSelected ? '#10B981' : '#CBD5E1', backgroundColor: isSelected ? '#10B981' : 'white' }}
                                >
                                  {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-full flex items-center justify-center font-bold text-emerald-700 text-lg shrink-0">
                                  {mhs.nama?.charAt(0) || '?'}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">{mhs.nama}</h3>
                                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{mhs.nim}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[11px] sm:text-xs font-bold text-slate-800">{formatDateIndoShort(lap.tanggal)}</p>
                                <span className="text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md mt-1.5 inline-block uppercase tracking-wide">Pending</span>
                              </div>
                            </div>

                            <div className="mb-5 bg-white p-3.5 sm:p-4 rounded-2xl border border-emerald-50 flex items-center gap-3 sm:gap-4 shadow-sm">
                              <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500 shrink-0" />
                              {lap.fileLink ? (
                                <a href={lap.fileLink} target="_blank" rel="noreferrer" className="text-sm sm:text-base font-bold text-indigo-700 truncate hover:underline">{lap.fileName}</a>
                              ) : (
                                <p className="text-sm sm:text-base font-bold text-slate-700 truncate">{lap.fileName}</p>
                              )}
                            </div>

                            <div className="flex gap-2 sm:gap-4 mt-2">
                              <button
                                onClick={() => handleApprove(lap.id, 'laporan')}
                                disabled={actionLoadingId === lap.id || isBulkApproving}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70"
                              >
                                {actionLoadingId === lap.id ? <ButtonSpinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} Setujui
                              </button>
                              <button onClick={() => setRevisiModal({ isOpen: true, itemId: lap.id, type: 'laporan', text: '' })} className="flex-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-95 flex justify-center items-center gap-2">
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
                    <h3 className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Antrean Logbook Harian</h3>
                    <div className="space-y-4 sm:space-y-6">
                      {pendingLogs.map(log => {
                        const mhs = log.mahasiswa || {};
                        const isSelected = selectedLogs.includes(log.id);
                        return (
                          <div key={log.id} className={`bg-white p-4 sm:p-6 rounded-3xl shadow-sm border transition-colors ${isSelected ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-100 hover:border-slate-200'}`}>
                            <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-3">
                                <div
                                  className="w-6 h-6 sm:w-7 sm:h-7 border-2 rounded-lg flex items-center justify-center cursor-pointer transition-colors shrink-0 bg-white"
                                  onClick={(e) => { e.stopPropagation(); toggleLogSelection(log.id); }}
                                  style={{ borderColor: isSelected ? '#10B981' : '#CBD5E1', backgroundColor: isSelected ? '#10B981' : 'white' }}
                                >
                                  {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-600 text-lg shrink-0">
                                  {mhs.nama?.charAt(0) || '?'}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate">{mhs.nama}</h3>
                                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider truncate">{mhs.nim}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[11px] sm:text-xs font-bold text-slate-800">{formatDateIndoShort(log.tanggal)}</p>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-0.5">{log.durasi} Jam</p>
                              </div>
                            </div>

                            <div className="mb-5 pl-0 sm:pl-11">
                              <p className="text-sm sm:text-base font-bold text-slate-800 mb-2 break-words">{log.kegiatan.join(', ')}</p>
                              <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-100/80 leading-relaxed mb-4 break-words whitespace-pre-wrap">
                                {log.deskripsi}
                              </p>

                              {log.foto && log.foto.length > 0 && (
                                <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                  {log.foto.map((img, i) => (
                                    <a key={i} href={getSafeImageUrl(img)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0">
                                      <img src={getSafeImageUrl(img)} alt={`Doc ${i}`} className="h-16 w-16 sm:h-24 sm:w-24 object-cover rounded-xl border border-slate-200 hover:opacity-90 transition-opacity" />
                                    </a>
                                  ))}
                                </div>
                              )}

                              {log.pemetaanMk && log.pemetaanMk.length > 0 && (
                                <div className="mt-4 bg-indigo-50/50 px-3.5 py-3 rounded-2xl border border-indigo-50">
                                  <p className="text-[9px] sm:text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Pemetaan MK
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {log.pemetaanMk.map((pem, i) => (
                                      <span key={i} className="text-[10px] sm:text-[11px] font-semibold text-indigo-800 bg-white border border-indigo-100 px-2.5 py-1.5 rounded-lg break-words shadow-sm">
                                        {pem.nama} <span className="text-indigo-400 font-bold ml-1">· {pem.jam} jam</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 sm:gap-4 pt-4 border-t border-slate-50 pl-0 sm:pl-11">
                              <button
                                onClick={() => handleApprove(log.id, 'logbook')}
                                disabled={actionLoadingId === log.id || isBulkApproving}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex justify-center items-center gap-2 disabled:opacity-70"
                              >
                                {actionLoadingId === log.id ? <ButtonSpinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} Setujui
                              </button>
                              <button onClick={() => setRevisiModal({ isOpen: true, itemId: log.id, type: 'logbook', text: '' })} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all active:scale-95 flex justify-center items-center gap-2">
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

          {/* TAB: MAHASISWA */}
          {activeTab === 'mahasiswa' && (
            <div className="space-y-4">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3 sm:space-y-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, NIM, prodi..."
                    value={mhsSearchTerm}
                    onChange={(e) => setMhsSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-9 py-3 sm:py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                  />
                  {mhsSearchTerm && (
                    <button onClick={() => setMhsSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 bg-slate-200 rounded-full">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-2 sm:gap-3 flex-col sm:flex-row">
                  <button
                    onClick={() => setOnlyAtRisk(prev => !prev)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all border
                      ${onlyAtRisk ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}
                  >
                    <AlertCircle className="w-4 h-4" /> Perlu Perhatian {atRiskCount > 0 ? `(${atRiskCount})` : ''}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={isExporting}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs sm:text-sm font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60 border border-emerald-100"
                  >
                    {isExporting ? <ButtonSpinner className="w-4 h-4" /> : <Download className="w-4 h-4" />} Export Excel
                  </button>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {filteredMhsList.map(mhs => {
                  const totalPending = mhs._pendingLogCount + mhs._pendingLaporanCount;
                  const adaProgres = typeof mhs.progressPercentage === 'number';
                  const waHref = waLink(mhs.wa, buildReminderMessage(mhs, reviewerInfo));

                  return (
                    <div key={mhs.id} className={`bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm border transition-all group ${mhs._isAtRisk ? 'border-rose-200 shadow-rose-100/40' : 'border-slate-100 hover:border-indigo-200'}`}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedMhsId(mhs.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedMhsId(mhs.id); } }}
                        className="flex items-center gap-4 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl"
                      >
                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-lg shrink-0 transition-colors ${mhs._isAtRisk ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600'}`}>
                          {mhs.nama.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate max-w-full">{mhs.nama}</h3>
                            {mhs._isAtRisk && (
                              <span className="shrink-0 flex items-center gap-1 bg-rose-100 text-rose-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
                                <AlertCircle className="w-2.5 h-2.5" /> Perhatian
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">{mhs.nim} • {mhs.prodi}</p>
                          {mhs.mitra && (
                            <p className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1 mt-1 truncate">
                              <MapPin className="w-3 h-3 shrink-0" /> {mhs.mitra}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                          {totalPending > 0 && <span className="bg-amber-100 text-amber-700 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md">{totalPending} Antrean</span>}
                        </div>
                      </div>

                      {adaProgres && (
                        <div className="mt-4 pt-4 border-t border-slate-50">
                          <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wide">Progres Jam Logbook</span>
                            <span className={`text-[10px] sm:text-[11px] font-black ${mhs._isAtRisk ? 'text-rose-600' : 'text-indigo-600'}`}>{mhs.progressPercentage}%</span>
                          </div>
                          <div className="w-full h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${mhs._isAtRisk ? 'bg-rose-500' : mhs.progressPercentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                              style={{ width: `${Math.min(100, mhs.progressPercentage)}%` }}
                            />
                          </div>
                          {(typeof mhs.currentHours === 'number' && typeof mhs.targetHours === 'number') && (
                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1.5">{mhs.currentHours} / {mhs.targetHours} Jam</p>
                          )}
                        </div>
                      )}

                      {waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`mt-4 flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95
                            ${mhs._isAtRisk ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-500/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
                        >
                          <FaWhatsapp className="w-4 h-4" />
                          {mhs._isAtRisk ? 'Ingatkan via WhatsApp' : 'Hubungi Mahasiswa'}
                        </a>
                      )}
                    </div>
                  );
                })}

                {filteredMhsList.length === 0 && (
                  <div className="text-center p-8 sm:p-12 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <FileWarning className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Tidak ada mahasiswa yang cocok dengan pencarian atau filter.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button (Bulk Approve) */}
      {totalSelectedCount > 0 && activeTab === 'antrean' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-11/12 max-w-lg bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-[90] flex justify-between items-center animate-in slide-in-from-bottom-10 border border-slate-700">
          <div className="flex flex-col">
            <span className="text-sm font-bold flex items-center gap-2">
              <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px]">{totalSelectedCount}</span>
              Item Terpilih
            </span>
            <button onClick={() => { setSelectedLogs([]); setSelectedLaporans([]); }} className="text-[10px] text-slate-400 text-left hover:text-white transition-colors mt-1">
              Batalkan Pilihan
            </button>
          </div>
          <button
            onClick={handleBulkApprove}
            disabled={isBulkApproving}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-70 shadow-lg shadow-emerald-500/20"
          >
            {isBulkApproving ? <ButtonSpinner className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />} Setujui Terpilih
          </button>
        </div>
      )}

      {/* Modal Revisi (Dashboard View) */}
      {revisiModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex flex-col justify-end sm:justify-center sm:items-center sm:p-6 transition-all duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] p-6 w-full sm:max-w-md flex flex-col shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300 relative">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" /> Catatan Revisi {revisiModal.type === 'logbook' ? 'Logbook' : 'Laporan'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-4">Beritahu mahasiswa apa yang perlu diperbaiki.</p>
            <textarea
              autoFocus
              disabled={isSubmittingRevisi}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl h-32 resize-none text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-5 font-medium text-slate-700 disabled:opacity-60"
              placeholder="Contoh: Tolong lengkapi deskripsi dengan hasil dari rapat..."
              value={revisiModal.text}
              onChange={(e) => setRevisiModal({ ...revisiModal, text: e.target.value })}
            />
            <div className="flex gap-3">
              <button onClick={() => setRevisiModal({ isOpen: false, itemId: null, type: '', text: '' })} disabled={isSubmittingRevisi} className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 active:scale-95">Batal</button>
              <button onClick={handleSubmitRevisi} disabled={isSubmittingRevisi} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-70">
                {isSubmittingRevisi ? <ButtonSpinner className="w-4 h-4" /> : <Send className="w-4 h-4" />} Kirim Revisi
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelpModal && <StatusHelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  );
};

export default ReviewerView;