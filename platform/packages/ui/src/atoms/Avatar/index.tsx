/**
 * DS-ATOM-R3 — Avatar 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-ATOM-R3.design.md §3
 * Plan SC: FR-DSA.23, FR-DSA.23.1, FR-DSA.23.2
 *
 * 이미지 + 이니셜 폴백. 한글(첫 글자) / 영문(첫 두 단어 이니셜) 자동 처리.
 * status 인디케이터 지원. 접근성: alt 필수.
 */

import {
  forwardRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn.js';
import {
  avatarVariants,
  statusIndicatorVariants,
} from './Avatar.variants.js';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'square';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** 이미지 URL */
  src?: string;
  /** 대체 텍스트 (접근성 필수) */
  alt: string;
  /** 이름 — 이니셜 생성용 */
  name?: string;
  /** 크기 */
  size?: AvatarSize;
  /** 모양 */
  shape?: AvatarShape;
  /** 상태 인디케이터 */
  status?: AvatarStatus;
  /** 커스텀 폴백 (우선순위 최상) */
  fallback?: ReactNode;
}

/**
 * 이름에서 이니셜 추출
 * - 한글: 첫 글자 (예: "홍길동" → "홍")
 * - 영문: 공백 기준 첫 두 단어의 첫 글자 대문자 (예: "john doe" → "JD")
 * - 단어 1개: 첫 글자 대문자
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  // 한글 범위 확인 (가~힣)
  const hangulRegex = /[\uAC00-\uD7AF]/;
  if (hangulRegex.test(trimmed)) {
    return trimmed.charAt(0);
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  return (
    (parts[0] ?? '').charAt(0).toUpperCase() +
    (parts[1] ?? '').charAt(0).toUpperCase()
  );
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  (
    {
      className,
      src,
      alt,
      name,
      size = 'md',
      shape = 'circle',
      status,
      fallback,
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);

    const showImage = Boolean(src) && !imageError;
    const initials = name ? getInitials(name) : getInitials(alt);

    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size, shape }), className)}
        role={showImage ? undefined : 'img'}
        aria-label={showImage ? undefined : alt}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span aria-hidden="true">{fallback ?? initials}</span>
        )}
        {status && (
          <span
            className={statusIndicatorVariants({ size, status })}
            role="status"
            aria-label={`상태: ${status}`}
          />
        )}
      </span>
    );
  }
);

Avatar.displayName = 'Avatar';
