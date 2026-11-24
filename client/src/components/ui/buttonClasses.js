// No `@/` imports and no JSX: `node --test` loads this file directly.
// The classes of <Button>, also for elements that must look like a button but aren't one,
// e.g. a <Link> (never <Link><Button/></Link>: a button inside a link is invalid HTML).
// Its own file (not exported from Button.jsx) so react-refresh's only-export-components rule holds.
import clsx from 'clsx';

const variants = {
  primary: 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-600',
  secondary: 'bg-navy-100 text-navy-800 hover:bg-navy-200 focus:ring-navy-500',
  ghost: 'bg-transparent text-navy-700 hover:bg-navy-50 focus:ring-navy-500',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

export const buttonClasses = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
} = {}) =>
  clsx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold shadow-soft',
    'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cream',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
    className,
  );
