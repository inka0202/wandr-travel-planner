import clsx from 'clsx';

export function Card({ className, children, ...props }) {
  return (
    <div className={clsx('overflow-hidden rounded-2xl bg-white shadow-card', className)} {...props}>
      {children}
    </div>
  );
}
