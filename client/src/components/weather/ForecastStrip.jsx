import { WeatherIcon } from '@/lib/weatherIcons';

const formatDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function ForecastStrip({ daily }) {
  if (!daily?.length) return null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <h2 className="mb-3 px-2 font-serif text-lg text-navy-900">7-day forecast</h2>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {daily.map((day) => (
          <ForecastDay key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}

function ForecastDay({ day }) {
  return (
    <div className="flex flex-col items-center rounded-lg p-2 transition-colors hover:bg-cream">
      <p className="text-xs font-medium text-navy-700">{formatDay(day.date)}</p>
      <p className="mb-2 text-[10px] text-navy-500">{formatDate(day.date)}</p>
      <WeatherIcon code={day.weatherCode} size={24} className="mb-2 text-orange-600" />
      <p className="text-sm font-medium text-navy-900">{day.tempMax}°</p>
      <p className="text-xs text-navy-500">{day.tempMin}°</p>
      {day.precipitationProb > 30 && (
        <p className="mt-1 text-[10px] text-orange-700">{day.precipitationProb}%</p>
      )}
    </div>
  );
}
