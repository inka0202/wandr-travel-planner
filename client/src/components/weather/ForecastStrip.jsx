import { WeatherIcon } from '@/lib/weatherIcons';

const formatDay = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function ForecastStrip({ daily }) {
  if (!daily?.length) return null;

  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <h3 className="font-serif text-lg text-navy-900 mb-3 px-2">7-day forecast</h3>
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
    <div className="flex flex-col items-center p-2 rounded-lg hover:bg-cream transition-colors">
      <p className="text-xs font-medium text-navy-700">{formatDay(day.date)}</p>
      <p className="text-[10px] text-navy-400 mb-2">{formatDate(day.date)}</p>
      <WeatherIcon code={day.weatherCode} size={24} className="text-orange-600 mb-2" />
      <p className="text-sm font-medium text-navy-900">{day.tempMax}°</p>
      <p className="text-xs text-navy-500">{day.tempMin}°</p>
      {day.precipitationProb > 30 && (
        <p className="text-[10px] text-orange-700 mt-1">{day.precipitationProb}%</p>
      )}
    </div>
  );
}
