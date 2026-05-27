import { WeatherIcon } from '@/lib/weatherIcons';
import { Wind, Droplets } from 'lucide-react';

export default function WeatherCard({ data }) {
  if (!data) return null;
  const { current, timezone } = data;

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-navy-500 mb-1">Right now</p>
          <p className="text-xs text-navy-400">{timezone}</p>
        </div>
        <WeatherIcon code={current.weatherCode} size={48} className="text-orange-600" />
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-serif text-5xl text-navy-900">{current.temp}°</span>
        <span className="text-navy-500">feels like {current.feelsLike}°</span>
      </div>
      <p className="text-navy-700 mb-4">{current.weatherText}</p>
      <div className="flex gap-4 text-sm text-navy-600">
        <span className="flex items-center gap-1">
          <Wind size={16} className="text-navy-400" /> {current.wind} km/h
        </span>
        <span className="flex items-center gap-1">
          <Droplets size={16} className="text-navy-400" /> {current.humidity}%
        </span>
      </div>
    </div>
  );
}
