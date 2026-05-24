export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream">
      <h1 className="text-5xl font-bold text-navy-900">Wandr</h1>
      <p className="mt-4 text-lg text-navy-700">Plan your next escape.</p>
      <button
        className="mt-8 rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white shadow-soft transition-colors hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-cream"
      >
        Search trips
      </button>
    </div>
  );
}
