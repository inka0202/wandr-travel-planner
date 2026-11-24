import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { safeNext } from '../lib/safeRedirect.js';

// No `@/` imports and no JSX: `node --test` loads this file directly.

export const CONNECTION_ERROR = 'Connection failed. Check your internet and try again.';

/**
 * The submit flow shared by LoginPage and RegisterPage.
 *
 * `onSubmit(data)` clears the error, awaits `action(data)`, then goes to the `?next=` path
 * (made safe by safeNext, '/trips' by default) without leaving /login in the history.
 * On failure: no server response → CONNECTION_ERROR; otherwise `describeError(err)` decides
 * the message (each page has its own codes, and may return JSX).
 *
 * @param {(data: object) => Promise<unknown>} action        e.g. (d) => login(d.email, d.password)
 * @param {(err: { response: object }) => import('react').ReactNode} describeError
 * @returns {{ submitError: import('react').ReactNode, onSubmit: (data: object) => Promise<void> }}
 */
export function useAuthSubmit(action, describeError) {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState(null);

  const onSubmit = async (data) => {
    setSubmitError(null);
    try {
      await action(data);
    } catch (err) {
      setSubmitError(err?.response ? describeError(err) : CONNECTION_ERROR);
      return;
    }
    const next = safeNext(new URLSearchParams(location.search).get('next'), window.location.origin);
    navigate(next, { replace: true });
  };

  return { submitError, onSubmit };
}
