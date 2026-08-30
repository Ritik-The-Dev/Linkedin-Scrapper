import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '../../utils/cn.ts';
import { Spinner } from './Spinner.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-xl font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-55 active:translate-y-px select-none whitespace-nowrap';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-[0_1px_2px_rgba(10,22,40,0.12)] hover:bg-brand-700 ' +
    'disabled:hover:bg-brand-600',
  secondary:
    'border border-line-strong bg-white text-ink hover:border-brand-300 hover:bg-brand-50/60 ' +
    'disabled:hover:border-line-strong disabled:hover:bg-white',
  ghost: 'text-ink-soft hover:bg-ink/[0.05] hover:text-ink',
  danger:
    'border border-bad-100 bg-bad-50 text-bad-700 hover:border-bad-500/40 hover:bg-bad-100 ' +
    'disabled:hover:bg-bad-50',
  quiet: 'bg-ink/[0.04] text-ink-soft hover:bg-ink/[0.07] hover:text-ink',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[0.8125rem]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[0.9375rem]',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface ButtonProps extends CommonProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> {
  /** Shows a spinner and blocks interaction; the label stays put to avoid reflow. */
  loading?: boolean;
}

/**
 * A real `<button>`, always. Loading state sets `aria-busy` and disables the
 * control rather than swapping the label, so the width does not jump.
 *
 * Refs are forwarded because the confirmation dialog needs to focus its
 * confirm button when it opens.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    iconLeft,
    iconRight,
    fullWidth,
    loading = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth === true && 'w-full', className)}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 13 : 15} /> : iconLeft}
      {children}
      {loading ? null : iconRight}
    </button>
  );
});

export interface ButtonLinkProps extends CommonProps {
  to: string;
  'aria-label'?: string;
}

/** Router link with button styling, for navigation rather than actions. */
export function ButtonLink({
  to,
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth === true && 'w-full', className)}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  );
}

export interface ExternalButtonLinkProps extends CommonProps {
  href: string;
  'aria-label'?: string;
}

/** Outbound link, always opened in a new tab with a safe rel. */
export function ExternalButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}: ExternalButtonLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth === true && 'w-full', className)}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </a>
  );
}
