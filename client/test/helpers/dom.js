// Minimal browser globals for React Testing Library under node:test.
// Loaded before every test file by `node --import ./test/helpers/dom.js` (npm test),
// because react-dom reads `window`/`document` when it is first imported.
// RTL's automatic cleanup needs a global afterEach, which node:test doesn't have,
// so call cleanup() from @testing-library/react in your own afterEach.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.navigator ??= window.navigator;
for (const key of ['HTMLElement', 'Node', 'Event', 'MutationObserver', 'getComputedStyle']) {
  globalThis[key] ??= window[key];
}
globalThis.requestAnimationFrame ??= (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

// Tells React this is a test environment, so act() works without warnings.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
