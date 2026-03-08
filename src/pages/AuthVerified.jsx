// src/pages/AuthVerified.jsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui';

export default function AuthVerified() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const club = (params.get('club') || '').trim();
    const safeClub = /^[a-z0-9-]+$/i.test(club) ? club : '';
    const target = safeClub ? `/${safeClub}/auth` : '/';
    const timer = setTimeout(() => navigate(target, { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [location.search, navigate]);

  return (
    <Card className="max-w-md mx-auto mt-20 bg-white shadow-lg p-6 rounded-xl text-center">
      <h2 className="text-2xl font-bold text-green-600 mb-4">✅ E-Mail bestätigt</h2>
      <p className="text-gray-700 mb-2">Deine E-Mail-Adresse wurde erfolgreich bestätigt.</p>
      <p className="text-sm text-gray-500">Du wirst gleich weitergeleitet …</p>
    </Card>
  );
}
