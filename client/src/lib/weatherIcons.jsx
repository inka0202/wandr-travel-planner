import { Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning } from 'lucide-react';

const GROUP_TO_ICON = {
  clear: Sun,
  'partly-cloudy': CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

export const wmoCodeToGroup = (code) => {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly-cloudy';
  if (code === 3 || code === 45 || code === 48) return 'cloudy';
  if (code >= 51 && code <= 67) return 'rain';
  if ((code >= 80 && code <= 82) || code === 95) return 'storm';
  if (code >= 71 && code <= 86) return 'snow';
  return 'cloudy';
};

export const WeatherIcon = ({ code, size = 24, className = '' }) => {
  const group = wmoCodeToGroup(code);
  const Icon = GROUP_TO_ICON[group] ?? Cloud;
  return <Icon size={size} className={className} aria-hidden="true" />;
};
