import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import ReviewerView from './ReviewerView.jsx';

// Samakan dengan import CSS di src/main.jsx (App utama) supaya Tailwind
// ikut ter-generate untuk halaman ini -- lihat catatan yang sama di
// admin-main.jsx/super-admin-main.jsx.
import './index.css';

// Toast super-ringan khusus halaman ini -- ReviewerView butuh prop
// showToast, tapi tidak perlu import komponen Toast penuh dari App.jsx
// (yang akan menarik banyak dependency Mahasiswa yang tidak relevan di
// sini). Dibuat inline, cukup untuk kebutuhan notifikasi approve/revisi.
function ReviewerEntry() {
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const params = new URLSearchParams(window.location.search);
  const reviewerToken = params.get('token');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast({ message: '', type: 'success' }), 3000);
  };

  return (
    <div className="bg-slate-100 min-h-screen font-sans flex justify-center">
      <div className="w-full max-w-2xl bg-white min-h-screen shadow-2xl overflow-hidden relative flex flex-col">
        {toast.message && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300 w-11/12 max-w-sm pointer-events-none">
            <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium">
              {toast.message}
            </div>
          </div>
        )}
        <ReviewerView reviewerToken={reviewerToken} showToast={showToast} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ReviewerEntry />
  </React.StrictMode>
);