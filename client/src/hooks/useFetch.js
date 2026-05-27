import { useEffect, useState, useRef } from 'react';

/**
 * Generic data-fetching hook with loading + error states.
 * Re-fetches when any dependency changes.
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
  const cancelRef = useRef(false);
  const [refetchCounter, setRefetchCounter] = useState(0);

  useEffect(() => {
    if (skip) {
      setIsLoading(false);
      return;
    }
    cancelRef.current = false;
    setIsLoading(true);
    setError(null);

    fetchFn()
      .then((result) => {
        if (!cancelRef.current) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelRef.current) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      cancelRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, refetchCounter, skip]);

  const refetch = () => setRefetchCounter((n) => n + 1);

  return { data, isLoading, error, refetch };
}
