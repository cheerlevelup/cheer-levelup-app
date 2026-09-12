'use client'
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'dark' | 'gold'
  size?: 'default' | 'small'
}

const variantClass: Record<string, string> = {
  default: '',
  ghost: 'coach-btn-ghost',
  dark: 'coach-btn-dark',
  gold: 'coach-btn-gold',
}

export default function Button({ variant = 'default', size = 'default', className, children, ...rest }: ButtonProps) {
  const cls = [
    'coach-btn',
    variantClass[variant],
    size === 'small' ? 'coach-btn-small' : '',
    className || '',
  ].filter(Boolean).join(' ')
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
