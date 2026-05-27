import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { getTrip, deleteTrip as deleteTripApi } from '@/api/trips';
import { getWeather } from '@/api/weather';
import WeatherCard from '@/components/weather/WeatherCard';
import ForecastStrip from '@/components/weather/ForecastStrip';
import TripMap from '@/components/map/TripMap';
import { Button } from '@/components/ui/Button';

const todayISO = () => new Date().toISOString().slice(0, 10);
const isFuture = (endDate) => endDate >= todayISO();

const fmtRange = (start, end) => {
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${s} — ${e}`;
};

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: trip, isLoading, error } = useFetch(() => getTrip(id), [id]);

  const showWeather = trip && isFuture(trip.endDate);
  const weatherState = useFetch(
    () =>
      getWeather({
        lat: trip.destination.latitude,
        lng: trip.destination.longitude,
        tz: 'auto',
      }),
    [trip?.destination.latitude, trip?.destination.longitude],
    { skip: !showWeather },
  );

  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteTripApi(id);
      navigate('/trips');
    } catch {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="h-96 bg-white rounded-2xl animate-pulse" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container py-10">
        <p className="text-red-700 mb-4">Trip not found.</p>
        <Link to="/trips">
          <Button variant="primary">Back to trips</Button>
        </Link>
      </div>
    );
  }
  if (!trip) return null;

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-16 z-20 bg-cream/95 backdrop-blur border-b border-navy-100">
        <div className="container py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/trips"
              className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700 mb-1"
            >
              <ArrowLeft size={14} /> All trips
            </Link>
            <h1 className="font-serif text-2xl sm:text-3xl text-navy-900">
              {trip.destination.name}
              {trip.destination.country && (
                <span className="text-navy-500">, {trip.destination.country}</span>
              )}
            </h1>
            <p className="text-sm text-navy-500 flex items-center gap-1">
              <Calendar size={14} /> {fmtRange(trip.startDate, trip.endDate)}
            </p>
          </div>
          <Button variant="ghost" onClick={handleDelete} disabled={deleting}>
            <Trash2 size={16} className="inline mr-1" />
            {deleting ? 'Deleting…' : 'Delete trip'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="container py-8 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        <div className="space-y-6 order-2 lg:order-1">
          {showWeather ? (
            <>
              {weatherState.data && <WeatherCard data={weatherState.data} />}
              {weatherState.data && <ForecastStrip daily={weatherState.data.daily} />}
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-card p-6">
              <p className="text-navy-500">
                This trip has passed. Weather forecast is no longer available.
              </p>
            </div>
          )}

          {trip.notes && (
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h2 className="font-serif text-lg text-navy-900 mb-2">Notes</h2>
              <p className="text-navy-700 whitespace-pre-wrap">{trip.notes}</p>
            </div>
          )}

          <div>
            <h2 className="font-serif text-2xl text-navy-900 mb-3">
              Saved attractions ({trip.savedAttractions.length})
            </h2>
            {trip.savedAttractions.length === 0 ? (
              <p className="text-navy-500">No attractions saved for this trip.</p>
            ) : (
              <div className="space-y-3">
                {trip.savedAttractions.map((a) => (
                  <div key={a._id || a.xid} className="bg-white rounded-xl shadow-soft p-4">
                    <h3 className="font-serif text-lg text-navy-900">{a.name}</h3>
                    <p className="text-sm text-navy-500 capitalize">{a.kind}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-48 h-[40vh] lg:h-[calc(100vh-14rem)]">
            <TripMap
              center={[trip.destination.latitude, trip.destination.longitude]}
              attractions={trip.savedAttractions}
              favoritedIds={new Set(trip.savedAttractions.map((a) => a.xid))}
            />
          </div>
        </div>
      </div>
    </>
  );
}
