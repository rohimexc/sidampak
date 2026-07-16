import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminFakultasEntry } from './AdminFakultasView.jsx';

// PENTING: ganti baris import CSS di bawah ini supaya SAMA PERSIS dengan
// yang dipakai di src/main.jsx (entry App utama Anda) -- biasanya
// './index.css' yang berisi @tailwind base/components/utilities. Kalau
// tidak di-import di sini, halaman admin akan tampil TANPA styling sama
// sekali (Tailwind class tidak akan ter-generate untuk halaman ini).
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminFakultasEntry />
  </React.StrictMode>
);