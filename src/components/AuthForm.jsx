import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { getActiveClubId, rememberClubSlugId, setActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import usePageMeta from '@/hooks/usePageMeta';
import { ROLES, normalizeRole } from '@/permissions/roles';

const AUTH_REQUEST_TIMEOUT_MS = 12000;

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
  const clubSeoLabel = clubSlug ? clubSlug.replace(/-/g, ' ') : 'asv rotauge';

  usePageMeta({
    title: mode === 'login' ? 'Anmeldung | Angelwetter' : 'Registrierung | Angelwetter',
    description:
      mode === 'login'
        ? `Melde dich bei Angelwetter (${clubSeoLabel}) an, um Wetter, Fänge und Vereinsfunktionen zu nutzen.`
        : `Registriere dich bei Angelwetter (${clubSeoLabel}) und erhalte Zugriff auf Fangmeldungen und Vereinsfunktionen.`,
  });

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
  };

  const runWithAuthTimeout = (promise, timeoutLabel) =>
    withTimeout(promise, AUTH_REQUEST_TIMEOUT_MS, timeoutLabel);

  const getSafeClubSlug = () => (
    typeof clubSlug === 'string' && /^[a-z0-9-]+$/i.test(clubSlug) ? clubSlug : null
  );

  const buildPasswordResetRedirect = () => {
    const safeClubSlug = getSafeClubSlug();
    const query = safeClubSlug ? `?club=${encodeURIComponent(safeClubSlug)}` : '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/update-password${query}`;
    }
    return 'https://app.asv-rotauge.de/update-password';
  };

  const buildResetDoneTarget = () => {
    const safeClubSlug = getSafeClubSlug();
    return safeClubSlug ? `/reset-done?club=${encodeURIComponent(safeClubSlug)}` : '/reset-done';
  };

  const resolveClubId = async () => {
    const activeSlug = clubSlug || null;
    if (!activeSlug) return getActiveClubId();

    const { data: clubRow, error: clubErr } = await runWithAuthTimeout(
      supabase
        .from('clubs')
        .select('id')
        .eq('slug', activeSlug)
        .maybeSingle(),
      'Club-Aufloesung timeout'
    );

    if (clubErr || !clubRow?.id) return null;
    setActiveClubId(clubRow.id);
    rememberClubSlugId(activeSlug, clubRow.id);
    return clubRow.id;
  };

  const checkEmailWhitelisted = async ({ emailToCheck, clubId, allowCheckFailure = false }) => {
    const { data: isWhitelisted, error: whitelistError } = await runWithAuthTimeout(
      supabase.rpc('is_email_whitelisted', {
        p_email: emailToCheck,
        p_club_id: clubId,
      }),
      'Whitelist-Check timeout'
    );

    if (whitelistError) {
      const debugMessage = whitelistError?.message || String(whitelistError);
      console.warn('[AuthForm] Whitelist-Check fehlgeschlagen:', debugMessage);
      if (allowCheckFailure) {
        return {
          ok: true,
          warningMessage:
            'Freischaltung konnte nicht vorab geprüft werden. Die finale Prüfung erfolgt beim ersten Login.',
        };
      }
      return { ok: false, errorMessage: `Freischaltung konnte nicht geprüft werden (${debugMessage}).` };
    }

    if (!isWhitelisted) {
      return { ok: false, errorMessage: 'Du bist für diesen Verein nicht freigeschaltet.' };
    }

    return { ok: true };
  };

  const ensureProfileAndMembership = async ({ userId, clubId, emailForWhitelistCheck, fallbackName }) => {
    const resolveWhitelistedRole = async () => {
      const { data: whitelistedRole, error: roleError } = await runWithAuthTimeout(
        supabase.rpc('whitelist_role_for_email', {
          p_email: emailForWhitelistCheck,
          p_club_id: clubId,
        }),
        'Whitelist-Rolle timeout'
      );
      if (roleError) {
        console.warn('[AuthForm] Whitelist-Rolle konnte nicht geladen werden:', roleError?.message || roleError);
        return ROLES.MEMBER;
      }
      return normalizeRole(whitelistedRole || ROLES.MEMBER, ROLES.MEMBER);
    };

    const { data: membershipRow, error: membershipSelectError } = await runWithAuthTimeout(
      supabase
        .from('memberships')
        .select('user_id, role, is_active')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .maybeSingle(),
      'Membership-Check timeout'
    );

    if (membershipSelectError) {
      return { ok: false, errorMessage: 'Mitgliedschaft konnte nicht geprüft werden.' };
    }

    if (membershipRow) {
      if (membershipRow.is_active === false) {
        return { ok: false, errorMessage: 'Dein Zugang für diesen Verein ist aktuell deaktiviert.' };
      }

      const { data: profileRow, error: profileSelectError } = await runWithAuthTimeout(
        supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .eq('club_id', clubId)
          .maybeSingle(),
        'Profil-Check timeout'
      );

      if (profileSelectError) {
        return { ok: false, errorMessage: 'Profilprüfung fehlgeschlagen.' };
      }

      if (!profileRow) {
        const safeFallbackName = (fallbackName || '').trim() || emailForWhitelistCheck;
        const { error: profileInsertError } = await runWithAuthTimeout(
          supabase.from('profiles').insert({
            id: userId,
            name: safeFallbackName,
            club_id: clubId,
          }),
          'Profil-Anlage timeout'
        );

        if (profileInsertError) {
          console.warn(
            '⚠️ Profil konnte nach Login nicht nachgezogen werden:',
            profileInsertError?.message || profileInsertError
          );
        }
      }

      return { ok: true };
    }

    // Onboarding nur beim ersten Verein: falls bereits in irgendeinem Verein Mitglied,
    // muss die neue Membership durch Vorstand/Superadmin gesetzt werden.
    const { count: existingMembershipCount, error: existingMembershipError } = await runWithAuthTimeout(
      supabase
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', userId),
      'Membership-Bestand timeout'
    );
    if (existingMembershipError) {
      return { ok: false, errorMessage: 'Mitgliedschaftsbestand konnte nicht geprüft werden.' };
    }
    if ((existingMembershipCount ?? 0) > 0) {
      return {
        ok: false,
        errorMessage:
          'Für diesen Verein bist du noch nicht freigeschaltet. Bitte Vorstand/Superadmin um Freigabe bitten.',
      };
    }

    // Erster Vereins-Onboarding-Fall: Mitgliedschaft existiert noch nicht -> Whitelist erforderlich.
    const whitelistResult = await checkEmailWhitelisted({
      emailToCheck: emailForWhitelistCheck,
      clubId,
      allowCheckFailure: false,
    });
    if (!whitelistResult.ok) {
      return whitelistResult;
    }

    const { data: profileRow, error: profileSelectError } = await runWithAuthTimeout(
      supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .eq('club_id', clubId)
        .maybeSingle(),
      'Profil-Check timeout'
    );

    if (profileSelectError) {
      return { ok: false, errorMessage: 'Profilprüfung fehlgeschlagen.' };
    }

    if (!profileRow) {
      const safeFallbackName = (fallbackName || '').trim() || emailForWhitelistCheck;
      const { error: profileInsertError } = await runWithAuthTimeout(
        supabase.from('profiles').insert({
          id: userId,
          name: safeFallbackName,
          club_id: clubId,
        }),
        'Profil-Anlage timeout'
      );

      if (profileInsertError) {
        return { ok: false, errorMessage: 'Profil konnte nicht gespeichert werden.' };
      }
    }

    const { error: membershipInsertError } = await runWithAuthTimeout(
      supabase.from('memberships').insert({
        user_id: userId,
        club_id: clubId,
        role: await resolveWhitelistedRole(),
        is_active: true,
      }),
      'Membership-Anlage timeout'
    );

    if (membershipInsertError) {
      return { ok: false, errorMessage: 'Mitgliedschaft konnte nicht gespeichert werden.' };
    }

    return { ok: true };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data: sessionData, error } = await runWithAuthTimeout(
        supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        }),
        'Login timeout'
      );

      if (error) {
        if (error.message === 'Email not confirmed') {
          setError('Bitte bestätige deine E-Mail-Adresse (Link wurde per Mail gesendet).');
        } else if (error.message === 'Invalid login credentials') {
          const resolvedClubId = await resolveClubId();
          if (!resolvedClubId) {
            setError('Ungültige Anmeldedaten. Bitte überprüfe E-Mail und Passwort.');
          } else {
            const whitelistResult = await checkEmailWhitelisted({
              emailToCheck: cleanEmail,
              clubId: resolvedClubId,
              allowCheckFailure: true,
            });

            if (!whitelistResult.ok) {
              setError('Diese E-Mail ist für diesen Verein nicht freigeschaltet.');
            } else {
              setError(
                'Anmeldung fehlgeschlagen: Entweder Passwort falsch oder noch kein Konto vorhanden. ' +
                'Wenn du neu bist: zuerst registrieren und E-Mail bestätigen. ' +
                'Falls bereits registriert: Passwort zurücksetzen.'
              );
            }
          }
        } else {
          setError(error.message);
        }
      } else {
        const userId = sessionData?.user?.id;
        if (!userId) {
          setError('Anmeldung fehlgeschlagen: Nutzer-ID fehlt.');
          await supabase.auth.signOut();
          return;
        }
        const resolvedClubId = await resolveClubId();
        if (!resolvedClubId) {
          setError('Verein unbekannt oder nicht verfügbar.');
          await supabase.auth.signOut();
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
          return;
        }

        navigate(clubBasePath);
      }
    } catch (err) {
      setError(err?.message || 'Login fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const resolvedClubId = await resolveClubId();
      if (!resolvedClubId) {
        setError('Verein unbekannt oder nicht verfügbar.');
        return;
      }

      const whitelistResult = await checkEmailWhitelisted({
        emailToCheck: cleanEmail,
        clubId: resolvedClubId,
        allowCheckFailure: true,
      });

      if (!whitelistResult.ok) {
        setError(
          whitelistResult.errorMessage === 'Du bist für diesen Verein nicht freigeschaltet.'
            ? 'Diese E-Mail ist für diesen Verein nicht freigeschaltet.'
            : 'Freischaltung konnte nicht geprüft werden.'
        );
        return;
      }
      if (whitelistResult.warningMessage) {
        console.warn('[AuthForm] Signup läuft trotz fehlender Vorprüfung:', whitelistResult.warningMessage);
      }

      const redirectQuery = clubSlug ? `?club=${encodeURIComponent(clubSlug)}` : '';
      const emailRedirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth-verified${redirectQuery}`
          : 'https://app.asv-rotauge.de/auth-verified';

      const { data: signUpData, error: signUpError } = await runWithAuthTimeout(
        supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: name.trim(),
              club_id: resolvedClubId,
              club_slug: clubSlug || null,
            },
            emailRedirectTo,
          },
        }),
        'Signup timeout'
      );

      if (signUpError) {
        const signUpMessage = String(signUpError?.message || '').toLowerCase();
        if (signUpMessage.includes('already registered')) {
          const { error: resetError } = await runWithAuthTimeout(
            supabase.auth.resetPasswordForEmail(cleanEmail, {
              redirectTo: buildPasswordResetRedirect(),
            }),
            'Passwort-Reset timeout'
          );

          if (resetError) {
            setError(
              'Diese E-Mail hat bereits ein Konto. Bitte einloggen oder "Passwort vergessen?" nutzen. ' +
              `Reset-Link konnte nicht automatisch versendet werden (${resetError.message}).`
            );
          } else {
            setError(
              'Diese E-Mail hat bereits ein Konto. Wir haben dir einen Link zum Passwort-Setzen gesendet. ' +
              'Bitte Mail öffnen, Passwort setzen und danach einloggen.'
            );
          }
        } else {
          setError(signUpError.message);
        }
        return;
      }
      if (!signUpData?.user?.id) {
        console.warn('[AuthForm] Signup lieferte keine user.id', {
          email: cleanEmail,
          clubId: resolvedClubId,
        });
      }

      setMode('login');
      resetForm();
      alert(
        "✅ Registrierung erfolgreich! Bitte E-Mail bestätigen und danach einloggen. " +
        "Hinweis: In Supabase erscheint der Eintrag zuerst unter Authentication > Users. " +
        "Die Tabellen profiles/memberships werden erst beim ersten Login befüllt."
      );
    } catch (err) {
      setError(err?.message || 'Registrierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
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

      <label htmlFor="auth-email" className="sr-only">
        E-Mail
      </label>
      <input
        id="auth-email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="E-Mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white dark:placeholder-blue-400"
        required
      />

      <label htmlFor="auth-password" className="sr-only">
        Passwort
      </label>
      <input
        id="auth-password"
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
                alert('Bitte zuerst E-Mail-Adresse eingeben.');
                return;
              }
              const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: buildPasswordResetRedirect(),
              });
              if (resetError) {
                alert(`Fehler beim Zurücksetzen: ${resetError.message}`);
              } else {
                navigate(buildResetDoneTarget());
              }
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Passwort vergessen?
          </button>
        </div>
      )}


      {mode === 'register' && (
        <>
          <label htmlFor="auth-name" className="sr-only">
            Vor und Nachname
          </label>
          <input
            id="auth-name"
            type="text"
            name="name"
            autoComplete="name"
            placeholder="Vor und Nachname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white dark:placeholder-blue-400"
            required
          />
        </>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {mode === 'login' && (
        <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Hinweis Vereinswechsel: Wenn diese E-Mail bereits in einem anderen Verein aktiv ist,
          muss der neue Verein dich zuerst freischalten (Membership durch Vorstand/Superadmin).
        </p>
      )}

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
