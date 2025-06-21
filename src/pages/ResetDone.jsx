// src/pages/ResetDone.jsx
import { Link } from 'react-router-dom';

export default function ResetDone() {
  return (
    <div className="max-w-md mx-auto mt-20 bg-white shadow-lg p-6 rounded-xl text-center">
      <h2 className="text-2xl font-bold text-blue-700 mb-4">📬 Link gesendet</h2>
      <p className="text-gray-700 mb-4">
        Wir haben dir eine E-Mail geschickt. Bitte klicke auf den Link in der E-Mail, um ein neues Passwort festzulegen.
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Falls du keine E-Mail erhältst, prüfe deinen Spam-Ordner oder versuche es später erneut.
      </p>

      <Link
        to="/"
        className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
      >
        Zurück zur Startseite
      </Link>
    </div>
  );
}
