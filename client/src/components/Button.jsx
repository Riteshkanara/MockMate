import { forwardRef } from 'react';

/**
 * MockMate shared Button
 * ─────────────────────────────────────────────────────────────────────────
 * Replaces the ~95 hand-styled <button> tags scattered across pages/*.jsx
 * with one component. Two things vary per screen in the real app, so both
 * are real props rather than assumptions:
 *
 *   surface  "light" (default) — button sits on the app's light background
 *            "dark"            — button sits on a dark glass panel
 *                                (e.g. Dashboard's hero card)
 *   variant  "primary" | "secondary" | "ghost" | "link" | "gradient"
 *
 * Usage:
 *   <Button onClick={goToInterview}>Start interview</Button>
 *   <Button variant="secondary" onClick={...}>Learn more</Button>
 *   <Button surface="dark" variant="ghost" onClick={...}>Close</Button>
 *   <Button variant="link" onClick={...}>Full radar →</Button>
 *   <Button variant="gradient" onClick={...}>Keep climbing →</Button>
 *   <Button loading disabled>Starting…</Button>
 */

const BASE =
  'inline-flex items-center justify-center gap-2 font-display font-bold ' +
  'rounded-md cursor-pointer transition-all duration-base ease-standard ' +
  'disabled:opacity-50 disabled:cursor-not-allowed select-none';

const SIZES = {
  sm: 'text-[13px] px-4 py-2',
  md: 'text-[13.5px] px-[22px] py-[13px]',
  lg: 'text-[15px] px-[38px] py-[14px]',
};

// Light-surface variants — the default, used on every normal page background
const LIGHT_VARIANTS = {
  primary:
    'bg-brand-500 text-white shadow-md border-none ' +
    'hover:bg-brand-600 active:bg-brand-700',
  secondary:
    'bg-surface text-text-sub border border-border-md shadow-sm ' +
    'hover:border-border-strong hover:text-text',
  ghost:
    'bg-transparent text-text-sub border border-border ' +
    'hover:bg-surface-alt hover:text-text',
  link:
    'bg-transparent text-brand-500 border-none shadow-none px-0 py-0 font-semibold ' +
    'hover:text-brand-600 hover:underline underline-offset-2',
  // Signature two-tone fill — matches the gradient already used on Dashboard's
  // CTA buttons (brand600 → accent400), lifted from real values, not invented
  gradient:
    'bg-gradient-to-br from-brand-600 to-accent-400 text-white border-none shadow-md ' +
    'hover:brightness-110',
};

// Dark-surface variants — for buttons placed on a dark glass panel
// (mirrors Dashboard.jsx's hero-card buttons, not a guess)
const DARK_VARIANTS = {
  primary:
    'bg-white text-text shadow-md border-none ' +
    'hover:opacity-90',
  secondary:
    'bg-white/[0.06] text-white border border-white/[0.16] backdrop-blur-md ' +
    'hover:bg-white/[0.1]',
  ghost:
    'bg-white/[0.06] text-white/60 border border-white/10 backdrop-blur-md ' +
    'hover:text-white hover:bg-white/[0.1]',
  link:
    'bg-transparent text-white/70 border-none shadow-none px-0 py-0 font-semibold ' +
    'hover:text-white hover:underline underline-offset-2',
  gradient:
    'bg-gradient-to-br from-brand-600 to-accent-400 text-white border-none shadow-md ' +
    'hover:brightness-110',
};

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    surface = 'light',
    size = 'md',
    loading = false,
    disabled = false,
    icon = null,
    iconPosition = 'left',
    className = '',
    type = 'button',
    ...rest
  },
  ref
) {
  const variantClasses = (surface === 'dark' ? DARK_VARIANTS : LIGHT_VARIANTS)[variant] || LIGHT_VARIANTS.primary;
  const sizeClasses = variant === 'link' ? '' : SIZES[size] || SIZES.md;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={`${BASE} ${sizeClasses} ${variantClasses} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {!loading && icon && iconPosition === 'left' && icon}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && icon}
    </button>
  );
});

export default Button;