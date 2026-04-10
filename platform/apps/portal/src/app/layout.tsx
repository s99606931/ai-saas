// Design Ref: DESIGN-MTU-U1-P §A — App Shell 루트 레이아웃
// Plan SC: FR-UP.1, FR-UP.10, FR-UP.27
// L-04: CSP nonce 지원 (Design Ref: L-04-CSP-NONCE.design.md §1)

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '공공 SaaS 포털',
  description: '공공기관 SaaS 플랫폼 관리 포털',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // FR-L04.4: middleware.ts에서 주입한 nonce 읽기
  const headerStore = await headers();
  const nonce = headerStore.get('x-nonce') ?? '';

  return (
    <html lang="ko">
      <body nonce={nonce}>
        {children}
      </body>
    </html>
  );
}
