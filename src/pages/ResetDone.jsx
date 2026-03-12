// src/pages/ResetDone.jsx
import { Link } from 'react-router-dom';
import { Button, Card } from '@/components/ui';
import usePageMeta from '@/hooks/usePageMeta';

export default function ResetDone() {
  usePageMeta({
    title: 'Passwort-Reset gesendet | Angelwetter',
    description: 'Der Link zum Zurücksetzen deines Passworts wurde versendet. Prüfe jetzt dein E-Mail-Postfach.',
  });

  return (
    <Card className="max-w-md mx-auto mt-20 bg-white shadow-lg p-6 rounded-xl text-center">
      <h2 className="text-2xl font-bold text-blue-700 mb-4">📬 Link gesendet</h2>
      <p className="text-gray-700 mb-4">
        Wir haben dir eine E-Mail geschickt. Bitte klicke auf den Link in der E-Mail, um ein neues Passwort festzulegen.
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Falls du keine E-Mail erhältst, prüfe deinen Spam-Ordner oder versuche es später erneut.
      </p>

      <Button
        as={Link}
        to="/"
        className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '44px',
        }}
      >
        Zurück zur Startseite
      </Button>
    </Card>
  );
}
