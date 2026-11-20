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
          <div key={i} className="animate-pulse rounded-xl bg-white p-4 shadow-soft">
            <div className="mb-2 h-5 w-3/4 rounded bg-navy-100" />
            <div className="h-4 w-1/3 rounded bg-navy-100" />
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
