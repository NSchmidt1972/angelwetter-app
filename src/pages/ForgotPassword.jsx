import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async () => {
    setMessage('');
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app.asv-rotauge.de/update-password', // ← HIER wird redirect_to gesetzt
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage('📩 Passwort-Link wurde an deine E-Mail gesendet.');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
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
    </div>
  );
}
