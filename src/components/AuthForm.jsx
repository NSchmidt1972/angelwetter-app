import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { getActiveClubId, setActiveClubId } from '@/utils/clubId';

export default function AuthForm() {
  const [mode, setMode] = useState('login'); // "login" oder "register"
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { clubSlug } = useParams();

  const clubBasePath = clubSlug ? `/${clubSlug}` : '/';

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
  };

  const resolveClubId = async () => {
    const activeSlug = clubSlug || null;
    if (!activeSlug) return getActiveClubId();

    const { data: clubRow, error: clubErr } = await supabase
      .from('clubs')
      .select('id')
      .eq('slug', activeSlug)
      .maybeSingle();

    if (clubErr || !clubRow?.id) return null;
    setActiveClubId(clubRow.id);
    return clubRow.id;
  };

  const checkEmailWhitelisted = async ({ emailToCheck, clubId }) => {
    const { data: isWhitelisted, error: whitelistError } = await supabase.rpc('is_email_whitelisted', {
      p_email: emailToCheck,
      p_club_id: clubId,
    });

    if (whitelistError) {
      return { ok: false, errorMessage: 'Freischaltung konnte nicht geprüft werden.' };
    }

    if (!isWhitelisted) {
      return { ok: false, errorMessage: 'Du bist für diesen Verein nicht freigeschaltet.' };
    }

    return { ok: true };
  };

  const ensureProfileAndMembership = async ({ userId, clubId, emailForWhitelistCheck, fallbackName }) => {
    const { data: membershipRow, error: membershipSelectError } = await supabase
      .from('memberships')
      .select('user_id, is_active')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (membershipSelectError) {
      return { ok: false, errorMessage: 'Mitgliedschaft konnte nicht geprüft werden.' };
    }

    if (membershipRow) {
      if (membershipRow.is_active === false) {
        return { ok: false, errorMessage: 'Dein Zugang für diesen Verein ist aktuell deaktiviert.' };
      }

      const { data: profileRow, error: profileSelectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .eq('club_id', clubId)
        .maybeSingle();

      if (profileSelectError) {
        return { ok: false, errorMessage: 'Profilprüfung fehlgeschlagen.' };
      }

      if (!profileRow) {
        const safeFallbackName = (fallbackName || '').trim() || emailForWhitelistCheck;
        const { error: profileInsertError } = await supabase.from('profiles').insert({
          id: userId,
          name: safeFallbackName,
          club_id: clubId,
        });

        if (profileInsertError) {
          console.warn(
            '⚠️ Profil konnte nach Login nicht nachgezogen werden:',
            profileInsertError?.message || profileInsertError
          );
        }
      }

      return { ok: true };
    }

    // Onboarding-Fall: Mitgliedschaft existiert noch nicht -> Whitelist erforderlich.
    const whitelistResult = await checkEmailWhitelisted({
      emailToCheck: emailForWhitelistCheck,
      clubId,
    });
    if (!whitelistResult.ok) {
      return whitelistResult;
    }

    const { data: profileRow, error: profileSelectError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .eq('club_id', clubId)
      .maybeSingle();

    if (profileSelectError) {
      return { ok: false, errorMessage: 'Profilprüfung fehlgeschlagen.' };
    }

    if (!profileRow) {
      const safeFallbackName = (fallbackName || '').trim() || emailForWhitelistCheck;
      const { error: profileInsertError } = await supabase.from('profiles').insert({
        id: userId,
        name: safeFallbackName,
        club_id: clubId,
      });

      if (profileInsertError) {
        return { ok: false, errorMessage: 'Profil konnte nicht gespeichert werden.' };
      }
    }

    const { error: membershipInsertError } = await supabase.from('memberships').insert({
      user_id: userId,
      club_id: clubId,
      role: 'mitglied',
      is_active: true,
    });

    if (membershipInsertError) {
      return { ok: false, errorMessage: 'Mitgliedschaft konnte nicht gespeichert werden.' };
    }

    return { ok: true };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim().toLowerCase();

    const { data: sessionData, error } = await supabase.auth.signInWithPassword({
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
      const userId = sessionData?.user?.id;
      if (!userId) {
        setError('Anmeldung fehlgeschlagen: Nutzer-ID fehlt.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      const resolvedClubId = await resolveClubId();
      if (!resolvedClubId) {
        setError('Verein unbekannt oder nicht verfügbar.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const provisioningResult = await ensureProfileAndMembership({
        userId,
        clubId: resolvedClubId,
        emailForWhitelistCheck: cleanEmail,
        fallbackName: sessionData?.user?.user_metadata?.name || '',
      });

      if (!provisioningResult.ok) {
        setError(provisioningResult.errorMessage);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      navigate(clubBasePath);
    }

    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const resolvedClubId = await resolveClubId();
    if (!resolvedClubId) {
      setError('Verein unbekannt oder nicht verfügbar.');
      setLoading(false);
      return;
    }

    const whitelistResult = await checkEmailWhitelisted({
      emailToCheck: cleanEmail,
      clubId: resolvedClubId,
    });

    if (!whitelistResult.ok) {
      setError(
        whitelistResult.errorMessage === 'Du bist für diesen Verein nicht freigeschaltet.'
          ? 'Diese E-Mail ist für diesen Verein nicht freigeschaltet.'
          : 'Freischaltung konnte nicht geprüft werden.'
      );
      setLoading(false);
      return;
    }

    const emailRedirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth-verified`
        : 'https://app.asv-rotauge.de/auth-verified';

    const { error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setMode('login');
    resetForm();
    alert("✅ Registrierung erfolgreich! Bitte bestätige deine E-Mail und logge dich danach ein.");
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
        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white dark:placeholder-blue-400"
        required
      />

      {/* NEU: Passwort vergessen */}
      {mode === 'login' && (
  <div className="text-right">
    <button
      type="button"
      onClick={async () => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) {
          alert("Bitte zuerst E-Mail-Adresse eingeben.");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: 'https://app.asv-rotauge.de/update-password'
        });
        if (error) {
          alert("Fehler beim Zurücksetzen: " + error.message);
        } else {
          navigate('/reset-done'); // 🆕 leitet weiter zur Info-Seite
        }
      }}
      className="text-sm text-blue-600 hover:underline"
    >
      Passwort vergessen?
    </button>
  </div>
)}


      {mode === 'register' && (
        <input
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Vor und Nachname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white dark:placeholder-blue-400"
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
