// Browser globals come from test/helpers/dom.js, loaded with node --import (package.json).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';
import { useFetch } from '../src/hooks/useFetch.js';

afterEach(() => cleanup());

/** A promise you resolve or reject from the test. */
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** Lets pending promise callbacks run, inside act() so React applies the updates. */
const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('useFetch', () => {
  it('starts loading, then returns the data', async () => {
    const d = deferred();
    let calls = 0;
    const { result } = renderHook(() =>
      useFetch(() => {
        calls++;
        return d.promise;
      }, []),
    );
    assert.equal(result.current.isLoading, true);
    assert.equal(result.current.data, null);
    assert.equal(result.current.error, null);

    await act(async () => d.resolve({ temp: 4 }));
    assert.equal(result.current.isLoading, false);
    assert.deepEqual(result.current.data, { temp: 4 });
    assert.equal(result.current.error, null);
    assert.equal(calls, 1);
  });

  it('returns the error when the fetch rejects', async () => {
    const err = new Error('boom');
    const { result } = renderHook(() => useFetch(() => Promise.reject(err), []));
    await waitFor(() => assert.equal(result.current.isLoading, false));
    assert.equal(result.current.error, err);
    assert.equal(result.current.data, null);
  });

  it('skip: does not fetch and is not loading, then fetches once skip turns off', async () => {
    let calls = 0;
    const fetchFn = () => {
      calls++;
      return Promise.resolve('ok');
    };
    const { result, rerender } = renderHook(({ skip }) => useFetch(fetchFn, [], { skip }), {
      initialProps: { skip: true },
    });
    await flush();
    assert.equal(calls, 0);
    assert.equal(result.current.isLoading, false);
    assert.equal(result.current.data, null);

    rerender({ skip: false });
    await waitFor(() => assert.equal(result.current.data, 'ok'));
    assert.equal(calls, 1);
  });

  it('refetch runs the fetch again and clears a previous error', async () => {
    let calls = 0;
    const { result } = renderHook(() =>
      useFetch(() => {
        calls++;
        return calls === 1 ? Promise.reject(new Error('first fails')) : Promise.resolve('second');
      }, []),
    );
    await waitFor(() => assert.ok(result.current.error));

    act(() => result.current.refetch());
    assert.equal(result.current.isLoading, true);
    assert.equal(result.current.error, null);
    await waitFor(() => assert.equal(result.current.data, 'second'));
    assert.equal(result.current.error, null);
    assert.equal(calls, 2);
  });

  it('fetches again when a dependency changes', async () => {
    const seen = [];
    const { result, rerender } = renderHook(
      ({ city }) =>
        useFetch(() => {
          seen.push(city);
          return Promise.resolve(`weather:${city}`);
        }, [city]),
      { initialProps: { city: 'Paris' } },
    );
    await waitFor(() => assert.equal(result.current.data, 'weather:Paris'));

    rerender({ city: 'Rome' });
    await waitFor(() => assert.equal(result.current.data, 'weather:Rome'));
    assert.deepEqual(seen, ['Paris', 'Rome']);
  });

  it('does not re-fetch on a re-render with the same deps', async () => {
    let calls = 0;
    const { rerender } = renderHook(
      ({ city }) =>
        useFetch(() => {
          calls++;
          return Promise.resolve(city);
        }, [city]),
      { initialProps: { city: 'Paris' } },
    );
    await flush();
    rerender({ city: 'Paris' });
    await flush();
    assert.equal(calls, 1);
  });

  it('ignores a response that arrives after unmount', async () => {
    const d = deferred();
    const { result, unmount } = renderHook(() => useFetch(() => d.promise, []));
    const before = result.current;
    unmount();
    await act(async () => d.resolve('late'));
    assert.equal(result.current, before);
    assert.equal(result.current.data, null);
  });

  it('ignores a stale response that arrives after deps changed', async () => {
    const requests = {};
    const { result, rerender } = renderHook(
      ({ city }) =>
        useFetch(() => {
          requests[city] = deferred();
          return requests[city].promise;
        }, [city]),
      { initialProps: { city: 'Paris' } },
    );

    rerender({ city: 'Rome' }); // Paris request is still in flight
    assert.equal(result.current.isLoading, true);
    await act(async () => requests.Rome.resolve('weather:Rome'));
    assert.equal(result.current.data, 'weather:Rome');
    assert.equal(result.current.isLoading, false);

    await act(async () => requests.Paris.resolve('weather:Paris')); // late, stale
    assert.equal(result.current.data, 'weather:Rome');
    assert.equal(result.current.isLoading, false);
    assert.equal(result.current.error, null);
  });

  it('keeps the old data while the next request is loading', async () => {
    const requests = {};
    const { result, rerender } = renderHook(
      ({ city }) =>
        useFetch(() => {
          requests[city] = deferred();
          return requests[city].promise;
        }, [city]),
      { initialProps: { city: 'Paris' } },
    );
    await act(async () => requests.Paris.resolve('weather:Paris'));

    rerender({ city: 'Rome' });
    assert.equal(result.current.isLoading, true);
    assert.equal(result.current.data, 'weather:Paris');
  });

  it('clears the old data when the next request fails', async () => {
    const requests = {};
    const { result, rerender } = renderHook(
      ({ city }) =>
        useFetch(() => {
          requests[city] = deferred();
          return requests[city].promise;
        }, [city]),
      { initialProps: { city: 'Paris' } },
    );
    await act(async () => requests.Paris.resolve('weather:Paris'));

    rerender({ city: 'Rome' });
    const err = new Error('Rome fails');
    await act(async () => requests.Rome.reject(err));
    assert.equal(result.current.data, null);
    assert.equal(result.current.error, err);
    assert.equal(result.current.isLoading, false);
  });

  it('keeps loading when a stale response settles before the current one', async () => {
    const requests = {};
    const { result, rerender } = renderHook(
      ({ city }) =>
        useFetch(() => {
          requests[city] = deferred();
          return requests[city].promise;
        }, [city]),
      { initialProps: { city: 'Paris' } },
    );

    rerender({ city: 'Rome' }); // Paris request is still in flight
    await act(async () => requests.Paris.resolve('weather:Paris')); // stale, arrives first
    assert.equal(result.current.data, null);
    assert.equal(result.current.isLoading, true);

    await act(async () => requests.Rome.resolve('weather:Rome'));
    assert.equal(result.current.data, 'weather:Rome');
    assert.equal(result.current.isLoading, false);
  });
});
