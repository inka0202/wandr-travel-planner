import AttractionCard from './AttractionCard';

export default function AttractionList({
  attractions,
  favoritedIds,
  onToggleFavorite,
  isLoading,
  error,
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-soft p-4 animate-pulse">
            <div className="h-5 bg-navy-100 rounded w-3/4 mb-2" />
            <div className="h-4 bg-navy-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return <p className="text-red-700">Couldn&apos;t load attractions. Try again.</p>;
  }
  if (!attractions?.length) {
    return <p className="text-navy-500">No attractions found nearby.</p>;
  }

  return (
    <div className="space-y-3">
      {attractions.map((a) => (
        <AttractionCard
          key={a.xid}
          attraction={a}
          isFavorited={favoritedIds.has(a.xid)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
