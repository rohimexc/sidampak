import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Lock, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, FileText, BookOpen,
  Download, Send, Loader2
} from 'lucide-react';

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
            className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'mahasiswa' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Mahasiswa
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
          <div className="space-y-3">
            {mhsList.map(mhs => {
              const pendingCount = pendingLogs.filter(l => l.nim === mhs.nim).length;
              const pendingLapCount = pendingLaporan.filter(l => l.nim === mhs.nim).length;
              const totalPending = pendingCount + pendingLapCount;

              return (
                <div
                  key={mhs.id}
                  onClick={() => setSelectedMhsId(mhs.id)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 cursor-pointer hover:border-indigo-200 transition-all group"
                >
                  <div className="w-12 h-12 bg-slate-100 group-hover:bg-indigo-100 rounded-full flex items-center justify-center font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">
                    {mhs.nama.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{mhs.nama}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{mhs.nim} • {mhs.prodi}</p>
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