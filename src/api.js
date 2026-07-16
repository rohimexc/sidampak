// =====================================================================
// api.js — Layer komunikasi ke Google Apps Script Web App (SIDAMPAK)
// + Cache layer (stale-while-revalidate) untuk pengalaman instan.
// =====================================================================

export const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbwpLDhR3clI_ECVI2IYoV2PQe95p9PeVK7HYQk5Y7U_tV-ly7fSeh121K01byy0M1R3/exec';

// ---------------------------------------------------------------------
// Fetch dasar
// ---------------------------------------------------------------------
async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API_BASE_URL}?${query}`, { method: 'GET' });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.message || 'Permintaan gagal.');
  return json.data;
}

async function apiPost(action, payload = {}) {
  const res = await fetch(API_BASE_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.message || 'Permintaan gagal.');
  return json.data;
}

// ---------------------------------------------------------------------
// WARM-UP GAS — Google Apps Script "dingin" (belum ada instance aktif
// untuk Web App ini) bisa butuh beberapa detik ekstra HANYA untuk start,
// di atas waktu eksekusi aksi sesungguhnya. ping() TIDAK menyentuh
// Spreadsheet sama sekali (lihat handlePing_ di Api.gs) -- tujuannya
// murni supaya instance GAS sudah "panas" SAAT pengguna menekan tombol
// Mulai Sesi/Submit, bukan baru dipanggil tepat saat itu.
//
// Sengaja TIDAK pakai await/throw ke pemanggil -- ini optimisasi
// best-effort. Kalau gagal (offline, dsb), tidak masalah; aksi
// sesungguhnya (login/save) tetap berjalan normal seperti biasa,
// hanya tanpa keuntungan warm-up.
// ---------------------------------------------------------------------
export function pingServer() {
  apiGet('ping').catch(() => {});
}

// ---------------------------------------------------------------------
// CACHE LAYER (localStorage) — "stale-while-revalidate".
//
// Tujuan: tampilan pertama instan (dari cache, kalau ada), TANPA pernah
// menyembunyikan kebenaran dari server. Begitu fetch fresh selesai, cache
// & UI selalu ditimpa dengan data server. Tidak ada keputusan penting
// (submit, approve, dst) yang pernah dibaca dari cache -- cache HANYA
// dipakai untuk render awal yang lebih cepat sebelum data asli datang.
//
// Setiap entry cache punya timestamp supaya bisa di-expire kalau terlalu
// basi (mencegah menampilkan data yang sudah usang berbulan-bulan).
// ---------------------------------------------------------------------
const CACHE_PREFIX = 'sidampak_cache_';

function cacheGet(key, maxAgeMs) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.t !== 'number') return null;
    if (maxAgeMs && Date.now() - entry.t > maxAgeMs) return null;
    return entry.v;
  } catch (e) {
    return null;
  }
}

function cacheSet(key, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch (e) {
    // localStorage penuh/disabled -- abaikan, cache hanya optimisasi
  }
}

function cacheClear(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (e) {
    // no-op
  }
}

function cacheClearPrefix(prefix) {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX + prefix)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    // no-op
  }
}

/**
 * swr(key, fetcher, { onCacheHit, maxAgeMs }) -> Promise<data terbaru>
 *
 * Pola: kalau ada cache valid, panggil onCacheHit(cachedData) SEGERA
 * (synchronous-ish, lewat microtask) supaya UI bisa render instan, lalu
 * tetap lanjut fetch ke server di background. Promise yang dikembalikan
 * SELALU resolve dengan data fresh dari server (bukan cache), supaya
 * pemanggil yang butuh data pasti-terbaru (mis. sebelum submit) tetap aman.
 */
async function swr(key, fetcher, { onCacheHit, maxAgeMs = 5 * 60 * 1000 } = {}) {
  const cached = cacheGet(key, maxAgeMs);
  if (cached !== null && onCacheHit) {
    // Beri render instan ke UI sebelum menunggu network.
    onCacheHit(cached);
  }
  const fresh = await fetcher();
  cacheSet(key, fresh);
  return fresh;
}

// ---------------------------------------------------------------------
// API publik
// ---------------------------------------------------------------------
export const api = {
  login: (nim, password) => apiGet('login', { nim, password }),
  register: (payload) => apiPost('register', payload),

  // --- PROFIL ---
  // getProfile menerima opsi onCacheHit supaya pemanggil bisa render
  // dashboard dari cache dulu, lalu otomatis diperbarui saat data fresh tiba.
  getProfile: (nim, opts = {}) =>
    swr(`profile_${nim}`, () => apiGet('getProfile', { nim }), {
      onCacheHit: opts.onCacheHit,
      maxAgeMs: 30 * 60 * 1000, // 30 menit
    }),
  saveProfile: async (payload) => {
    // Server (handleSaveProfile_) sekarang langsung mengembalikan profil
    // LENGKAP terbaru (bentuk sama dengan getProfile) di response save
    // ini -- TIDAK perlu lagi memanggil getProfile setelahnya. Itu
    // menghapus satu round-trip penuh ke GAS, yang sebelumnya jadi
    // alasan utama "simpan profil" terasa lama (2x latency GAS berurutan).
    const freshProfile = await apiPost('saveProfile', payload);
    // Isi cache langsung dengan hasil fresh ini supaya pemuatan
    // berikutnya (refresh halaman, dsb) tetap instan & akurat tanpa
    // perlu menunggu getProfile terpisah lagi.
    cacheSet(`profile_${payload.nim}`, freshProfile);
    return freshProfile;
  },

  // --- LOGBOOK ---
  getLogbooks: (nim, opts = {}) =>
    swr(`logbooks_${nim}`, () => apiGet('getLogbooks', { nim }), {
      onCacheHit: opts.onCacheHit,
      maxAgeMs: 10 * 60 * 1000, // 10 menit -- logbook lebih sering berubah
    }),
  saveLogbook: async (payload) => {
    // Server (handleSaveLogbook_) sekarang langsung mengembalikan SELURUH
    // DAFTAR logbook terbaru (termasuk link foto final dari Drive,
    // bentuk sama dengan getLogbooks) -- tidak perlu getLogbooks lagi
    // sesudahnya. Menghapus satu round-trip GAS penuh per simpan logbook.
    const freshLogbooks = await apiPost('saveLogbook', payload);
    cacheSet(`logbooks_${payload.nim}`, freshLogbooks);
    return freshLogbooks;
  },
  deleteLogbook: async (payload) => {
    // Sama seperti saveLogbook -- server mengembalikan list terbaru
    // setelah penghapusan, langsung dipakai tanpa fetch ulang.
    const freshLogbooks = await apiPost('deleteLogbook', payload);
    cacheSet(`logbooks_${payload.nim}`, freshLogbooks);
    return freshLogbooks;
  },

  // --- LAPORAN ---
  getLaporan: (nim, opts = {}) =>
    swr(`laporan_${nim}`, () => apiGet('getLaporan', { nim }), {
      onCacheHit: opts.onCacheHit,
      maxAgeMs: 10 * 60 * 1000,
    }),
  saveLaporan: async (payload) => {
    // Server (handleSaveLaporan_) sekarang langsung mengembalikan object
    // laporan LENGKAP terbaru (bentuk sama dengan getLaporan, termasuk
    // fileLink final dari Drive) -- tidak perlu getLaporan lagi sesudahnya.
    const freshLaporan = await apiPost('saveLaporan', payload);
    cacheSet(`laporan_${payload.nim}`, freshLaporan);
    return freshLaporan;
  },
  deleteLaporan: async (payload) => {
    const result = await apiPost('deleteLaporan', payload);
    cacheClear(`laporan_${payload.nim}`);
    return result;
  },

  // --- MASTER DATA --- (Fakultas/Prodi/JenisProgram jarang berubah -> cache lama aman)
  getMasterData: (opts = {}) =>
    swr('masterData', () => apiGet('getMasterData'), {
      onCacheHit: opts.onCacheHit,
      maxAgeMs: 24 * 60 * 60 * 1000, // 24 jam
    }),

  // Saran (datalist) Nama Program & Nama Mitra di ProfileSetupView,
  // diambil dari nilai yang sudah pernah diisi mahasiswa lain (tabel
  // Program). Sama seperti getMasterData, ini cache lama (24 jam) aman
  // dipakai -- daftar program/mitra tidak berubah drastis tiap hari, dan
  // ini cuma SARAN (datalist), bukan validasi, jadi tidak kritis fresh.
  getProgramSuggestions: (opts = {}) =>
    swr('programSuggestions', () => apiGet('getProgramSuggestions'), {
      onCacheHit: opts.onCacheHit,
      maxAgeMs: 24 * 60 * 60 * 1000, // 24 jam
    }),

  // --- REVIEWER ---
  // Semua aksi reviewer SEKARANG wajib menyertakan token (lihat
  // parseReviewerToken_ di Api.gs) -- tanpa token valid, server menolak
  // akses (INVALID_TOKEN). Cache key disertai token supaya reviewer
  // berbeda (mentor A vs mentor B) yang kebetulan memakai browser/device
  // yang sama TIDAK saling melihat cache antrean satu sama lain.
  getReviewerQueue: (token, opts = {}) =>
    swr(`reviewerQueue_${token}`, () => apiGet('getReviewerQueue', { token }), {
      onCacheHit: opts.onCacheHit,
      maxAgeMs: 5 * 60 * 1000,
    }),
  getMahasiswaDetailForReviewer: (nim, token, opts = {}) =>
    swr(`reviewerDetail_${token}_${nim}`, () => apiGet('getMahasiswaDetailForReviewer', { nim, token }), {
      onCacheHit: opts.onCacheHit,
      maxAgeMs: 5 * 60 * 1000,
    }),
  reviewApprove: async (type, id, token) => {
    const result = await apiPost('reviewApprove', { type, id, token });
    cacheClearPrefix('reviewer'); // antrean & semua detail mahasiswa (semua reviewer) jadi basi
    return result;
  },
  reviewRevisi: async (type, id, catatan, token) => {
    const result = await apiPost('reviewRevisi', { type, id, catatan, token });
    cacheClearPrefix('reviewer');
    return result;
  },

  // Reminder WhatsApp ke Mentor & DPL (lihat handleSendReminder_ di
  // Api.gs) -- server yang benar-benar mengirim lewat gateway WA &
  // mencatat cooldown, BUKAN simulasi seperti versi sebelumnya.
  sendReminder: (nim) => apiPost('sendReminder', { nim }),

  // --- ADMIN FAKULTAS / KOPRODI ---
  getAdminFakultasData: (token, tahunAjaranId, opts = {}) =>
    swr(`adminFakultas_${token}_${tahunAjaranId || 'all'}`, () =>
      apiGet('getAdminFakultasData', { token, tahunAjaranId: tahunAjaranId || '' }), {
      onCacheHit: opts.onCacheHit,
      maxAgeMs: 5 * 60 * 1000,
    }),

  getMahasiswaDetailForAdmin: (nim, token) =>
    apiGet('getMahasiswaDetailForAdmin', { nim, token }),
};

// ---------------------------------------------------------------------
// DRAF LOGBOOK LOKAL (localStorage) — TIDAK menyentuh server sama sekali.
//
// Hanya untuk logbook BARU (belum pernah ada di server / belum punya
// riwayat status server). Begitu logbook sudah pernah disubmit (sudah
// ada di tabel Logbook server), "Simpan Draf" pada logbook itu kembali
// ke jalur normal (update ke server) -- bukan lewat modul ini.
//
// Bisa menyimpan BANYAK draf sekaligus per mahasiswa, disimpan sebagai
// daftar (array) di bawah satu key per-NIM.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// KOMPRESI GAMBAR — khusus untuk draf lokal (localStorage punya kuota
// kecil, ~5-10MB per origin). Foto kamera HP modern (2-5MB per file)
// dengan cepat melebihi kuota begitu ada 2-4 foto dalam satu draf,
// menyebabkan localStorage.setItem gagal diam-diam (QuotaExceededError)
// dan draf yang tersimpan jadi versi lama/sebagian (bug "cuma 1 foto
// yang tersimpan").
//
// Solusi: kompres (resize + turunkan kualitas JPEG) SEBELUM disimpan ke
// localStorage. Foto ASLI (tanpa kompresi) tetap dipakai saat submit ke
// server -- kompresi ini HANYA memengaruhi apa yang disimpan sebagai draf
// lokal, tidak pernah memengaruhi data yang akhirnya diupload ke Drive.
// ---------------------------------------------------------------------
const DRAFT_IMAGE_MAX_DIMENSION = 1280;
const DRAFT_IMAGE_QUALITY = 0.7;

function compressImageDataUrl(dataUrl) {
  return new Promise((resolve) => {
    // Bukan gambar (mis. sudah link Drive, atau format tak terduga) -> lewati apa adanya.
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    try {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > DRAFT_IMAGE_MAX_DIMENSION || height > DRAFT_IMAGE_MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * DRAFT_IMAGE_MAX_DIMENSION) / width);
            width = DRAFT_IMAGE_MAX_DIMENSION;
          } else {
            width = Math.round((width * DRAFT_IMAGE_MAX_DIMENSION) / height);
            height = DRAFT_IMAGE_MAX_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', DRAFT_IMAGE_QUALITY));
        } catch (e) {
          resolve(dataUrl); // gagal encode -> fallback ke aslinya
        }
      };
      img.onerror = () => resolve(dataUrl); // gagal decode -> fallback ke aslinya
      img.src = dataUrl;
    } catch (e) {
      resolve(dataUrl);
    }
  });
}

async function compressFotoArray(fotoArray) {
  if (!Array.isArray(fotoArray) || fotoArray.length === 0) return fotoArray || [];
  return Promise.all(fotoArray.map(compressImageDataUrl));
}

const DRAFT_PREFIX = 'sidampak_drafts_';

function draftKey(nim) {
  return DRAFT_PREFIX + nim;
}

export const localDrafts = {
  // Mengembalikan array draf milik nim ini, terbaru lebih dulu.
  list(nim) {
    try {
      const raw = localStorage.getItem(draftKey(nim));
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  },

  // Simpan satu draf (insert baru atau update kalau localDraftId sudah ada).
  // ASYNC karena foto dikompresi dulu sebelum disimpan (lihat catatan
  // kompresi gambar di atas). Melempar error kalau localStorage tetap
  // gagal menyimpan SETELAH dikompresi (mis. kuota benar-benar penuh oleh
  // draf lain), supaya pemanggil bisa memberi tahu pengguna -- TIDAK
  // pernah menelan kegagalan secara diam-diam seperti versi sebelumnya.
  async save(nim, draftData) {
    const all = localDrafts.list(nim);
    const localDraftId = draftData.localDraftId || ('DRAFT-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));

    const compressedFoto = await compressFotoArray(draftData.foto);
    const entry = { ...draftData, foto: compressedFoto, localDraftId, isLocalDraft: true, savedAt: Date.now() };

    const idx = all.findIndex(d => d.localDraftId === localDraftId);
    let updated;
    if (idx >= 0) {
      updated = [...all];
      updated[idx] = entry;
    } else {
      updated = [entry, ...all];
    }

    try {
      localStorage.setItem(draftKey(nim), JSON.stringify(updated));
    } catch (e) {
      // Kuota localStorage tetap terlampaui walau sudah dikompresi --
      // kemungkinan ada banyak draf lain yang menumpuk. Lempar error
      // eksplisit, JANGAN ditelan, supaya pengguna tahu draf TIDAK
      // tersimpan dan bisa mengambil tindakan (hapus draf lama, dst).
      throw new Error('Gagal menyimpan draf: penyimpanan perangkat penuh. Coba hapus draf lama atau kurangi jumlah foto.');
    }
    return entry;
  },

  // Hapus satu draf (dipakai setelah draf berhasil disubmit ke server,
  // atau saat pengguna menghapusnya manual).
  remove(nim, localDraftId) {
    const all = localDrafts.list(nim);
    const updated = all.filter(d => d.localDraftId !== localDraftId);
    try {
      localStorage.setItem(draftKey(nim), JSON.stringify(updated));
    } catch (e) {
      // no-op
    }
  },
};


const SESSION_KEY = 'sidampak_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------
// THEME (light/dark mode) — preferensi disimpan permanen di localStorage.
// Default mengikuti preferensi sistem/OS (prefers-color-scheme) saat
// belum pernah dipilih sebelumnya.
// ---------------------------------------------------------------------
const THEME_KEY = 'sidampak_theme';

export const theme = {
  // 'light' | 'dark' -- mengembalikan pilihan tersimpan, atau mengikuti
  // preferensi sistem kalau pengguna belum pernah memilih secara eksplisit.
  getInitial() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
      // localStorage disabled -- lanjut ke fallback sistem
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  },

  save(mode) {
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      // no-op -- preferensi hanya berlaku untuk sesi ini
    }
  },
};

export const session = {
  save(nim, nama) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      nim, nama, loggedInAt: Date.now(),
    }));
  },

  getValid() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.nim || !data.loggedInAt) return null;
      const age = Date.now() - data.loggedInAt;
      if (age > SESSION_MAX_AGE_MS) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  clear() {
    localStorage.removeItem(SESSION_KEY);
    // Sekalian bersihkan semua cache data DAN draf lokal milik sesi
    // sebelumnya supaya user lain yang login di perangkat yang sama
    // tidak sempat melihat sepintas data/draf bekas milik akun sebelumnya.
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(CACHE_PREFIX) || k.startsWith(DRAFT_PREFIX))) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      // no-op
    }
  },
};

