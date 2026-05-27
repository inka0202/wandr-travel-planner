import { useSearchParams } from 'react-router-dom';

// Day 4 stub — replaced with full implementation on Day 6
export default function SearchResultsPage() {
  const [params] = useSearchParams();

  return (
    <div className="container py-8">
      <h1 className="font-serif text-2xl font-bold text-navy-900 mb-4">Search Results</h1>
      <pre className="text-sm text-navy-600 bg-white rounded-lg p-4 shadow-soft">
        {JSON.stringify(Object.fromEntries(params), null, 2)}
      </pre>
    </div>
  );
}
