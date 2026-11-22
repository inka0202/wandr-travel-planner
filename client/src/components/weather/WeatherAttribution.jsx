// Open-Meteo data is CC BY 4.0: show this wherever the forecast is shown.
export default function WeatherAttribution() {
  return (
    <p className="text-xs text-navy-500">
      Weather data by{' '}
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-navy-700"
      >
        Open-Meteo.com
      </a>
    </p>
  );
}
