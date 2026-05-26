import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/axios';

export default function HomePage() {
  const [health, setHealth] = useState(null);

  const checkHealth = async () => {
    try {
      const { data } = await api.get('/health');
      setHealth({ ok: true, data });
    } catch {
      setHealth({ ok: false });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream">
      <h1 className="text-5xl font-bold text-navy-900">Wandr</h1>
      <p className="mt-4 text-lg text-navy-700">Plan your next escape.</p>
      <Link
        to="/search"
        className="mt-8 inline-block rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white shadow-soft transition-colors hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-cream"
      >
        Search trips
      </Link>
      <button
        onClick={checkHealth}
        className="mt-4 rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm text-navy-600 shadow-soft transition-colors hover:bg-navy-50"
      >
        Check API health
      </button>
      {health && (
        <p className={`mt-2 text-sm ${health.ok ? 'text-green-600' : 'text-red-600'}`}>
          {health.ok
            ? `✅ API ok — uptime ${Math.round(health.data.uptime)}s`
            : '❌ API unreachable'}
        </p>
      )}
    </div>
  );
}
