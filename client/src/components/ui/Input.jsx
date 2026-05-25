import clsx from 'clsx';

export function Input({ label, id, error, className, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-navy-700">
          {label}
        </label>
      )}
      <input
        id={id}
        className={clsx(
          'rounded-lg border-navy-200 bg-white px-4 py-2.5 text-navy-800 shadow-soft',
          'placeholder:text-navy-300 focus:border-orange-500 focus:ring-orange-500',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
