// components/ui/Button.tsx
// 공통 버튼 컴포넌트 — primary / ghost / danger variant
// UI/UX REVISIONS.md §3 — cursor-pointer 명시, <button> 태그 사용
'use client';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'danger';
type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: '#ea580c',
    color: '#fff',
    border: 'none',
    boxShadow: '0 3px 12px rgba(234,88,12,0.3)',
  },
  ghost: {
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.55)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  danger: {
    background: 'rgba(240,65,65,0.12)',
    color: '#f04141',
    border: '1px solid rgba(240,65,65,0.3)',
  },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { fontSize: 10, padding: '4px 10px', borderRadius: 5 },
  md: { fontSize: 11, padding: '7px 14px', borderRadius: 6 },
  lg: { fontSize: 13, padding: '10px 20px', borderRadius: 8 },
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      style,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          transition: 'all 0.15s',
          width: fullWidth ? '100%' : undefined,
          ...VARIANT_STYLES[variant],
          ...SIZE_STYLES[size],
          ...style,
        }}
        {...rest}
      >
        {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
        {isLoading ? (
          <span
            aria-label="로딩 중"
            style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.85s linear infinite', display: 'inline-block' }}
          />
        ) : children}
        {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  },
);

Button.displayName = 'Button';
