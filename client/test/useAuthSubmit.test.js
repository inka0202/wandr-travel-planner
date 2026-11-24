// Browser globals come from test/helpers/dom.js, loaded with node --import (package.json).
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAuthSubmit, CONNECTION_ERROR } from '../src/hooks/useAuthSubmit.js';

afterEach(() => cleanup());

const loginUrl = (next) =>
  next === undefined ? '/login' : `/login?next=${encodeURIComponent(next)}`;

/** Renders the hook inside a router that starts at `url`; also reports where the router is. */
const setup = (url, action, describeError = () => 'described') =>
  renderHook(
    () => ({
      auth: useAuthSubmit(action, describeError),
      location: useLocation(),
      navigationType: useNavigationType(),
    }),
    {
      wrapper: ({ children }) => createElement(MemoryRouter, { initialEntries: [url] }, children),
    },
  );

const submit = (result, data = { email: 'a@b.co', password: 'secret123' }) =>
  act(() => result.current.auth.onSubmit(data));

/** An error like axios throws when the server answered. */
const httpError = (status, code) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { error: { message: 'msg', code } } },
  });

describe('useAuthSubmit', () => {
  it('on success: calls the action with the form data, then replaces /login with ?next', async () => {
    const calls = [];
    const { result } = setup(loginUrl('/trips/1?tab=map#notes'), async (data) => {
      calls.push(data);
    });

    await submit(result, { email: 'a@b.co', password: 'pw' });

    assert.deepEqual(calls, [{ email: 'a@b.co', password: 'pw' }]);
    assert.equal(result.current.location.pathname, '/trips/1');
    assert.equal(result.current.location.search, '?tab=map');
    assert.equal(result.current.location.hash, '#notes');
    assert.equal(result.current.navigationType, 'REPLACE');
    assert.equal(result.current.auth.submitError, null);
  });

  it('without a safe ?next, goes to /trips (safeNext rules)', async () => {
    for (const next of [undefined, '', '//evil.com', 'https://evil.com', '/\\evil.com', 'trips']) {
      const { result, unmount } = setup(loginUrl(next), async () => {});
      await submit(result);
      assert.equal(result.current.location.pathname, '/trips', String(next));
      assert.equal(result.current.location.search, '', String(next));
      unmount();
    }
  });

  it('no server response (network error, timeout): connection message, no navigation', async () => {
    const described = [];
    const { result } = setup(
      loginUrl('/trips'),
      async () => {
        throw new Error('Network Error');
      },
      (err) => described.push(err),
    );

    await submit(result);

    assert.equal(result.current.auth.submitError, CONNECTION_ERROR);
    assert.equal(described.length, 0);
    assert.equal(result.current.location.pathname, '/login');
    assert.equal(result.current.navigationType, 'POP');
  });

  it('server error: the page decides the message, no navigation', async () => {
    const err = httpError(401, 'INVALID_CREDENTIALS');
    const described = [];
    const { result } = setup(
      loginUrl('/trips'),
      async () => {
        throw err;
      },
      (e) => {
        described.push(e);
        return `message for ${e.response.data.error.code}`;
      },
    );

    await submit(result);

    assert.deepEqual(described, [err]);
    assert.equal(result.current.auth.submitError, 'message for INVALID_CREDENTIALS');
    assert.equal(result.current.location.pathname, '/login');
  });

  it('a new submit clears the previous error while it runs', async () => {
    let attempt = 0;
    let finish;
    const { result } = setup(loginUrl('/trips'), () => {
      attempt++;
      if (attempt === 1) return Promise.reject(httpError(429, 'RATE_LIMITED'));
      return new Promise((resolve) => {
        finish = resolve;
      });
    });

    await submit(result);
    assert.equal(result.current.auth.submitError, 'described');

    let pending;
    await act(async () => {
      pending = result.current.auth.onSubmit({});
    });
    assert.equal(result.current.auth.submitError, null);

    await act(async () => {
      finish();
      await pending;
    });
    assert.equal(result.current.location.pathname, '/trips');
  });
});
