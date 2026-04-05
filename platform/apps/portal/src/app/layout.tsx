// Design Ref: DESIGN-MTU-U1-P §A — App Shell 루트 레이아웃
// Plan SC: FR-UP.1, FR-UP.10, FR-UP.27

import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '공공 SaaS 포털',
  description: '공공기관 SaaS 플랫폼 관리 포털',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
