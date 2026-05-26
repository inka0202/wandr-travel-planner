import { forwardRef } from 'react';
import clsx from 'clsx';

export const FormField = forwardRef(function FormField(
  { label, error, hint, type = 'text', ...rest },
  ref,
) {
  const inputId = rest.id || rest.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-navy-700">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        type={type}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={clsx(
          'block w-full rounded-lg border-navy-200 shadow-soft',
          'focus:border-orange-600 focus:ring-orange-600',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500',
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-navy-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
