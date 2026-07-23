import { createClient } from '@supabase/supabase-js';

// =====================================================================
// PENTING soal keamanan key ini
// =====================================================================
// Ini ANON KEY (public), BUKAN service_role key -- AMAN ditaruh di kode
// frontend/browser. Keamanannya BUKAN dari menyembunyikan key ini
// (memang tidak bisa disembunyikan, semua orang yang buka DevTools bisa
// melihatnya), tapi dari RLS (Row Level Security) di sisi Supabase --
// lihat enable_public_read_rls.sql. Anon key ini HANYA bisa membaca
// (SELECT) tabel yang SUDAH DIBERI POLICY SELECT PUBLIK secara eksplisit
// (Fakultas, Prodi, TahunAjaran, datadosen) -- tabel lain (Mahasiswa,
// Logbook, dst) TIDAK PUNYA policy untuk anon sama sekali, jadi anon key
// ini TIDAK BISA membaca/menulis apa pun di tabel-tabel itu, walau
// ditulis dengan benar. JANGAN PERNAH taruh service_role key di sini.
//
// Ganti 2 nilai di bawah dengan milik project Supabase Anda sendiri
// (Project Settings -> API -> Project URL & anon public key).
// =====================================================================
const SUPABASE_URL = 'https://yofhzijkhsbrydftgtmn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZmh6aWpraHNicnlkZnRndG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTY5NjQsImV4cCI6MjA5NzczMjk2NH0.F47o2MjI9hekNc4kKEDQ-Q7YJWFd4TPYBt298jcC0Os';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);