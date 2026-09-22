import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'primaryDark' | 'outline' | 'gold' | 'ghost' | 'danger' | 'scoring';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-dark',
  primaryDark: 'bg-primary-dark text-on-dark',
  outline: 'border border-primary text-primary bg-transparent',
  gold: 'bg-gold text-dark-chrome',
  ghost: 'bg-transparent text-text',
  danger: 'bg-danger text-on-dark',
  scoring: 'bg-scoring text-scoring-on',
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 font-bold uppercase tracking-wide',
        'min-h-touch disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
