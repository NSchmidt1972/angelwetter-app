import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Card } from '@/components/ui';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // ✅ NEU
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token') || '';

    if (access_token) {
      supabase.auth.setSession({ access_token, refresh_token })
        .then(({ error }) => {
          if (error) {
            setError("Fehler beim Anmelden – bitte Link erneut aufrufen.");
          } else {
            setReady(true);
          }
        });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
        } else {
          setError("❌ Ungültiger oder abgelaufener Link. Bitte neuen Link anfordern.");
        }
      });
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async () => {
    setError(null);

    if (!password || !confirmPassword) {
      setError("Bitte beide Felder ausfüllen.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/auth');
      }, 2000);
    }
  };

  if (!ready && !error) {
    return (
      <Card className="p-6 text-center text-gray-500">
        <p>🔄 Lade Wiederherstellung...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <h2 className="text-xl font-semibold text-red-700">❌ Fehler</h2>
        <p className="text-gray-700 mt-2">{error}</p>
        <a href="/forgot-password" className="text-blue-600 hover:underline block mt-4">
          🔁 Neuen Link anfordern
        </a>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="p-6 text-center">
        <h2 className="text-xl font-semibold text-green-700">✅ Passwort geändert</h2>
        <p>Du wirst gleich zur Anmeldung weitergeleitet …</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4 text-blue-700">🔐 Neues Passwort vergeben</h2>
      
      <input
        type="password"
        placeholder="Neues Passwort"
        className="w-full border rounded px-4 py-2 mb-3"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <input
        type="password"
        placeholder="Passwort wiederholen"
        className="w-full border rounded px-4 py-2 mb-4"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
      />

      <button
        onClick={handleUpdate}
        className="w-full bg-blue-600 text-white font-semibold py-2 rounded"
      >
        Passwort aktualisieren
      </button>

      {error && <p className="text-red-600 mt-4">{error}</p>}
    </Card>
  );
}
