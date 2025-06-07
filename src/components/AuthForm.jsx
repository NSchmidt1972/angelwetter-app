import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';

export default function AuthForm() {
  const [mode, setMode] = useState('login'); // "login" oder "register"
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      if (error.message === 'Email not confirmed') {
        setError('Bitte bestätige deine E-Mail-Adresse (Link wurde per Mail gesendet).');
      } else if (error.message === 'Invalid login credentials') {
        setError('Ungültige Anmeldedaten. Bitte überprüfe E-Mail und Passwort. (Vielleicht noch nicht registriert?)');
      } else {
        setError(error.message);
      }
    } else {
      navigate('/');
    }

    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim().toLowerCase();

    const { data: whitelist, error: whitelistError } = await supabase
      .from('whitelist_emails')
      .select('*')
      .eq('email', cleanEmail)
      .single();

    if (whitelistError || !whitelist) {
      setError('Diese E-Mail ist nicht für die Registrierung freigeschaltet.');
      setLoading(false);
      return;
    }

    const { data: signUpResponse, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: 'https://asv-rotauge.de/angelwetter-app/auth-verified'
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const userId = signUpResponse?.user?.id;
    if (userId) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        name: name.trim(),
      });

      if (profileError) {
        console.error('❌ Fehler beim Anlegen des Profils:', profileError.message);
        setError('Profil konnte nicht gespeichert werden.');
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setMode('login');
    resetForm();
    alert("✅ Registrierung erfolgreich! Bitte überprüfe deine E-Mails, um deine Adresse zu bestätigen.");
  };

  return (
    <form
      method="post"
      name={mode}
      className="space-y-4 max-w-sm mx-auto mt-20 bg-white shadow-lg p-6 rounded-xl"
      onSubmit={mode === 'login' ? handleLogin : handleSignup}
    >
      <h2 className="text-2xl font-bold text-center text-blue-700">
        {mode === 'login' ? '🔐 Anmeldung' : '🆕 Registrierung'}
      </h2>

      <input
        type="email"
        name="email"
        autoComplete="email"
        placeholder="E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white dark:placeholder-blue-400"
        required
      />

      <input
        type="password"
        name={mode === 'login' ? 'current-password' : 'new-password'}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        placeholder="Passwort"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400  dark:bg-gray-800 dark:text-white dark:placeholder-blue-400"
        required
      />

      {mode === 'register' && (
        <input
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Vor und Nachname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400  dark:bg-gray-800 dark:text-white dark:placeholder-blue-400"
          required
        />
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        className={`w-full text-white py-2 rounded font-semibold transition ${loading
          ? 'bg-gray-400 cursor-not-allowed'
          : mode === 'login'
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-green-600 hover:bg-green-700'
          }`}
        disabled={loading}
      >
        {loading
          ? 'Bitte warten...'
          : mode === 'login'
            ? 'Einloggen'
            : 'Registrieren'}
      </button>

      <p className="text-center text-sm text-gray-600 mt-2">
        {mode === 'login' ? (
          <>
            Noch kein Konto?{' '}
            <button
              type="button"
              onClick={() => setMode('register')}
              className="text-blue-600 hover:underline"
            >
              Jetzt registrieren
            </button>
          </>
        ) : (
          <>
            Schon registriert?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-blue-600 hover:underline"
            >
              Zur Anmeldung
            </button>
          </>
        )}
      </p>
    </form>
  );
}
