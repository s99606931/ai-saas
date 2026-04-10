// Design Ref: DESIGN-MTU-U1-P §D — 서비스 카탈로그 그리드
// Plan SC: FR-UP.7

'use client';

interface ServiceCard {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'published' | 'draft' | 'archived';
  version: string;
}

const SAMPLE_SERVICES: ServiceCard[] = [
  {
    id: '1',
    name: '전자결재',
    description: '공공기관 전자결재 시스템',
    category: '업무',
    status: 'published',
    version: '1.2.0',
  },
  {
    id: '2',
    name: '인사관리',
    description: '공무원 인사 관리 시스템',
    category: '인사',
    status: 'published',
    version: '2.0.0',
  },
  {
    id: '3',
    name: '재정관리',
    description: '예산 편성 및 집행 관리',
    category: '재정',
    status: 'published',
    version: '1.0.0',
  },
  {
    id: '4',
    name: '민원처리',
    description: '온라인 민원 접수/처리',
    category: '민원',
    status: 'draft',
    version: '0.9.0',
  },
];

export function ServiceCatalogGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SAMPLE_SERVICES.map((service) => (
        <div
          key={service.id}
          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
              {service.name}
            </h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: service.status === 'published' ? 'var(--color-success)' : 'var(--color-warning)',
                color: '#fff',
              }}
            >
              {service.status === 'published' ? '게시' : '초안'}
            </span>
          </div>
          <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
            {service.description}
          </p>
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>{service.category}</span>
            <span>v{service.version}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
