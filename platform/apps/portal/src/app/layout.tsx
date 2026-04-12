// Design Ref: DESIGN-MTU-U1-P §A — App Shell 루트 레이아웃
// Design Ref: DS-THEME-R1 — ThemeProvider 통합
// Plan SC: FR-UP.1, FR-UP.10, FR-UP.27, FR-DST.13~18
// L-04: CSP nonce 지원 (Design Ref: L-04-CSP-NONCE.design.md §1)

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ThemeProvider, getInitialThemeScript } from '@public-saas/ui';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '공공 SaaS 포털',
  description: '공공기관 SaaS 플랫폼 관리 포털',
};

// FOUC 방지 — 초기 테마를 React hydration 이전에 적용
const INITIAL_THEME_SCRIPT = getInitialThemeScript({
  defaultTheme: 'default',
  defaultMode: 'system',
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // FR-L04.4: middleware.ts에서 주입한 nonce 읽기
  const headerStore = await headers();
  const nonce = headerStore.get('x-nonce') ?? '';

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* FOUC 방지: React hydration 이전에 테마 클래스 적용 */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: INITIAL_THEME_SCRIPT }}
        />
      </head>
      <body nonce={nonce}>
        <ThemeProvider defaultTheme="default" defaultMode="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
