import { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { withTimeout } from '@/utils/async';

const LOGIN_TIMEOUT_MS = 12000;
const SUPERADMIN_CHECK_TIMEOUT_MS = 10000;

export default function SuperAdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error: loginError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        }),
        LOGIN_TIMEOUT_MS,
        'Superadmin Login timeout',
      );

      if (loginError) {
        setError(loginError.message || 'Login fehlgeschlagen.');
        return;
      }

      const { data: isSuperadmin, error: roleError } = await withTimeout(
        supabase.rpc('is_superadmin'),
        SUPERADMIN_CHECK_TIMEOUT_MS,
        'Superadmin Rollencheck timeout',
      );
      if (roleError || !isSuperadmin) {
        await supabase.auth.signOut();
        setError('Kein Zugriff. Dieser Account ist kein Superadmin.');
      }
    } catch (loginErr) {
      setError(loginErr?.message || 'Login fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-xl rounded border border-gray-200 bg-white p-6 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <h1 className="text-xl font-semibold">Superadmin Login</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Zugriff nur für Superadmin-Accounts.
      </p>
      <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-Mail"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Passwort"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        {error ? <div className="text-sm text-red-600 dark:text-red-300">{error}</div> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? 'Anmeldung läuft...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}
