// Design Ref: DESIGN-MTU-U1-P §E — 테넌트 서비스 마켓플레이스
// Plan SC: FR-UP.8, FR-UP.9

'use client';

import { useState } from 'react';

interface MarketplaceService {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  subscribed: boolean;
}

const SAMPLE_MARKETPLACE: MarketplaceService[] = [
  {
    id: '1',
    name: '전자결재',
    description: '공공기관 전자결재 시스템',
    category: '업무',
    price: '월 500,000원',
    subscribed: true,
  },
  {
    id: '2',
    name: '인사관리',
    description: '공무원 인사 관리 시스템',
    category: '인사',
    price: '월 300,000원',
    subscribed: true,
  },
  {
    id: '3',
    name: '재정관리',
    description: '예산 편성 및 집행 관리',
    category: '재정',
    price: '월 400,000원',
    subscribed: false,
  },
  {
    id: '4',
    name: '민원처리',
    description: '온라인 민원 접수/처리',
    category: '민원',
    price: '월 250,000원',
    subscribed: false,
  },
  {
    id: '5',
    name: 'AI 문서분석',
    description: '공문서 자동 분류/요약',
    category: 'AI',
    price: '월 200,000원',
    subscribed: false,
  },
];

export function ServiceMarketplace() {
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');
  const categories = ['전체', ...new Set(SAMPLE_MARKETPLACE.map((s) => s.category))];

  const filtered =
    categoryFilter === '전체' ? SAMPLE_MARKETPLACE : SAMPLE_MARKETPLACE.filter((s) => s.category === categoryFilter);

  return (
    <div>
      {/* 카테고리 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className="px-3 py-1.5 text-sm rounded-full border"
            style={{
              borderColor: categoryFilter === cat ? 'var(--color-primary)' : 'var(--color-border)',
              backgroundColor: categoryFilter === cat ? 'var(--color-primary)' : 'transparent',
              color: categoryFilter === cat ? '#fff' : 'var(--color-text)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 서비스 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((service) => (
          <div
            key={service.id}
            className="border rounded-lg p-4"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
          >
            <h3 className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
              {service.name}
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
              {service.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                {service.price}
              </span>
              <button
                className="px-3 py-1.5 text-sm rounded-lg"
                style={{
                  backgroundColor: service.subscribed ? 'var(--color-bg-secondary)' : 'var(--color-primary)',
                  color: service.subscribed ? 'var(--color-text-muted)' : '#fff',
                }}
                disabled={service.subscribed}
              >
                {service.subscribed ? '구독 중' : '구독하기'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
