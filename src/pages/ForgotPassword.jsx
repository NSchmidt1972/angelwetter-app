import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Card } from '@/components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();
  const { clubSlug } = useParams();

  const searchParams = new URLSearchParams(location.search || '');
  const queryClub = searchParams.get('club');
  const clubFromPath = typeof clubSlug === 'string' ? clubSlug.trim() : '';
  const clubFromQuery = typeof queryClub === 'string' ? queryClub.trim() : '';
  const rawClub = clubFromPath || clubFromQuery;
  const safeClub = /^[a-z0-9-]+$/i.test(rawClub) ? rawClub : '';

  const handleReset = async () => {
    setMessage('');
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    const query = safeClub ? `?club=${encodeURIComponent(safeClub)}` : '';
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/update-password${query}`
        : 'https://app.asv-rotauge.de/update-password';
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });
    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage('📩 Passwort-Link wurde an deine E-Mail gesendet.');
    }
  };

  return (
    <Card className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-blue-700 mb-4">🔑 Passwort vergessen</h2>
      <input
        type="email"
        placeholder="Deine E-Mail-Adresse"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border rounded px-4 py-2 mb-4"
      />
      <button
        onClick={handleReset}
        className="w-full bg-blue-600 text-white font-semibold py-2 rounded"
      >
        Link zum Zurücksetzen senden
      </button>
      {message && <p className="text-green-600 mt-4">{message}</p>}
      {error && <p className="text-red-600 mt-4">{error}</p>}
    </Card>
  );
}
