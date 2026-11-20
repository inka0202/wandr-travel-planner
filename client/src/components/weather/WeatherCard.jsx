import { WeatherIcon } from '@/lib/weatherIcons';
import { Wind, Droplets } from 'lucide-react';

export default function WeatherCard({ data }) {
  if (!data) return null;
  const { current, timezone } = data;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="mb-1 text-sm text-navy-500">Right now</p>
          <p className="text-xs text-navy-500">{timezone}</p>
        </div>
        <WeatherIcon code={current.weatherCode} size={48} className="text-orange-600" />
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-serif text-5xl text-navy-900">{current.temp}°</span>
        <span className="text-navy-500">feels like {current.feelsLike}°</span>
      </div>
      <p className="mb-4 text-navy-700">{current.weatherText}</p>
      <div className="flex gap-4 text-sm text-navy-600">
        <span className="flex items-center gap-1">
          <Wind size={16} className="text-navy-500" /> {current.wind} km/h
        </span>
        <span className="flex items-center gap-1">
          <Droplets size={16} className="text-navy-500" /> {current.humidity}%
        </span>
      </div>
    </div>
  );
}
