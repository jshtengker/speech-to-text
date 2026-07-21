import React, { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs gap-2',
    lg: 'px-6 py-2.5 text-sm gap-2 font-semibold',
  };

  const variantStyles = {
    primary:
      'gold-gradient-btn text-white shadow-lg shadow-[#c8864a]/20 border border-[#c8864a]/40',
    secondary:
      'bg-[#201e1b] border border-[#2b2823] text-[#e6e2dd] hover:bg-[#2b2823] hover:border-[#c8864a]/30 hover:text-white',
    outline:
      'bg-[#c8864a]/10 border border-[#c8864a]/30 text-[#c8864a] hover:bg-[#c8864a]/20 hover:border-[#c8864a]/60',
    ghost:
      'text-[#a39b91] hover:text-[#e6e2dd] hover:bg-[#201e1b] border border-transparent hover:border-[#2b2823]',
    danger:
      'bg-rose-950/40 border border-rose-800/50 text-rose-300 hover:bg-rose-900/50',
  };

  return (
    <button
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
