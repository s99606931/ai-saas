/**
 * DS-ATOM-R1 — Button variants (CVA)
 * Design Ref: docs/02-design/mtus/DS-ATOM-R1.design.md §Button
 * Plan SC: FR-DSA.3
 */

import { cva } from '../lib/cva.js';

export const buttonVariants = cva(
  // Base: 모든 variant 공통
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium whitespace-nowrap',
    'rounded-[var(--button-radius)]',
    'transition-[background-color,color,border-color,box-shadow]',
    'duration-[var(--motion-duration-fast)]',
    'ease-[var(--motion-ease-out)]',
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-[var(--color-focus-ring)]',
    'focus-visible:ring-offset-2',
    'focus-visible:ring-offset-[var(--color-focus-ring-offset)]',
    'disabled:pointer-events-none',
    'disabled:opacity-60',
    'aria-[busy=true]:cursor-wait',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--button-primary-bg)]',
          'text-[var(--button-primary-fg)]',
          'hover:bg-[var(--button-primary-bg-hover)]',
          'active:bg-[var(--button-primary-bg-active)]',
        ].join(' '),
        secondary: [
          'bg-[var(--button-secondary-bg)]',
          'text-[var(--button-secondary-fg)]',
          'border border-[var(--button-secondary-border)]',
          'hover:bg-[var(--button-secondary-bg-hover)]',
        ].join(' '),
        ghost: [
          'bg-[var(--button-ghost-bg)]',
          'text-[var(--button-ghost-fg)]',
          'hover:bg-[var(--button-ghost-bg-hover)]',
        ].join(' '),
        danger: [
          'bg-[var(--button-danger-bg)]',
          'text-[var(--button-danger-fg)]',
          'hover:bg-[var(--button-danger-bg-hover)]',
        ].join(' '),
        link: [
          'bg-transparent',
          'text-[var(--button-link-fg)]',
          'underline-offset-4',
          'hover:underline',
          'hover:text-[var(--button-link-fg-hover)]',
          'h-auto p-0',
        ].join(' '),
      },
      size: {
        sm: [
          'h-[var(--button-height-sm)]',
          'px-[var(--button-padding-x-sm)]',
          'text-[length:var(--button-font-size-sm)]',
        ].join(' '),
        md: [
          'h-[var(--button-height-md)]',
          'px-[var(--button-padding-x-md)]',
          'text-[length:var(--button-font-size-md)]',
        ].join(' '),
        lg: [
          'h-[var(--button-height-lg)]',
          'px-[var(--button-padding-x-lg)]',
          'text-[length:var(--button-font-size-lg)]',
        ].join(' '),
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    compoundVariants: [
      // link variant은 height/padding 제외
      { variant: 'link', size: 'sm', class: 'h-auto px-0' },
      { variant: 'link', size: 'md', class: 'h-auto px-0' },
      { variant: 'link', size: 'lg', class: 'h-auto px-0' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);
