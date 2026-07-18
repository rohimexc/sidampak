import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminUniversitasView from './AdminUniversitasView.jsx';

// Samakan dengan import CSS di src/main.jsx (App utama) supaya Tailwind
// ikut ter-generate untuk halaman ini -- lihat catatan yang sama di
// admin-main.jsx.
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminUniversitasView />
  </React.StrictMode>
);