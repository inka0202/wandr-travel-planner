import { buttonClasses } from './buttonClasses';

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}) {
  return (
    <button className={buttonClasses({ variant, size, fullWidth, className })} {...props}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
