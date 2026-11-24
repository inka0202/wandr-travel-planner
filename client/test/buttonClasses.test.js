// <Button> must look exactly as before buttonClasses was split out of it: the expected strings
// below are the class names Button.jsx produced before the refactor, copied verbatim.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buttonClasses } from '../src/components/ui/buttonClasses.js';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold shadow-soft ' +
  'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cream';
const VARIANTS = {
  primary: 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-600',
  secondary: 'bg-navy-100 text-navy-800 hover:bg-navy-200 focus:ring-navy-500',
  ghost: 'bg-transparent text-navy-700 hover:bg-navy-50 focus:ring-navy-500',
};
const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

describe('buttonClasses', () => {
  it('defaults: primary, md', () => {
    assert.equal(
      buttonClasses(),
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold shadow-soft ' +
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cream ' +
        'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-600 px-6 py-3 text-base',
    );
    assert.equal(buttonClasses({}), buttonClasses());
  });

  it('every variant × size', () => {
    for (const [variant, variantClasses] of Object.entries(VARIANTS)) {
      for (const [size, sizeClasses] of Object.entries(SIZES)) {
        assert.equal(
          buttonClasses({ variant, size }),
          `${BASE} ${variantClasses} ${sizeClasses}`,
          `${variant}/${size}`,
        );
      }
    }
  });

  it('fullWidth and className come last, in that order', () => {
    assert.equal(
      buttonClasses({ variant: 'ghost', size: 'sm', fullWidth: true, className: 'mr-1' }),
      `${BASE} ${VARIANTS.ghost} ${SIZES.sm} w-full mr-1`,
    );
    assert.equal(
      buttonClasses({ className: 'mt-4' }),
      `${BASE} ${VARIANTS.primary} ${SIZES.md} mt-4`,
    );
  });
});
