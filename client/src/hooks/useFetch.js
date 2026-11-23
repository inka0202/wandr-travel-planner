import { useEffect, useState } from 'react';

/**
 * Generic data-fetching hook with loading + error states.
 * Re-fetches when any dependency changes.
 *
 * Only the latest request may update state: when deps change, refetch() runs,
 * skip turns on, or the component unmounts, the older request's result is ignored.
 * fetchFn is called with no arguments (an AbortSignal may be passed later).
 *
 * Usage:
 *   const { data, isLoading, error, refetch } = useFetch(
 *     () => getWeather({ lat, lng, tz }),
 *     [lat, lng, tz]
 *   );
 */
export function useFetch(fetchFn, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  useEffect(() => {
    if (skip) {
      setIsLoading(false);
      return;
    }
    // One flag per effect run, so a later run can't un-cancel an earlier one.
    // Every state update below must stay behind it (including any future .finally()).
    let ignore = false;
    setIsLoading(true);
    setError(null);

    fetchFn()
      .then((result) => {
        if (ignore) return;
        setData(result);
        setIsLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        setError(err);
        setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetchCounter, skip]);

  const refetch = () => setRefetchCounter((n) => n + 1);

  return { data, isLoading, error, refetch };
}
