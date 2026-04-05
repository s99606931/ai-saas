// Design Ref: DESIGN-MTU-U1-P §B — ComplianceMatrix 유기체 컴포넌트
// Plan SC: FR-UP.14

'use client';

interface ComplianceDomain {
  id: string;
  name: string;
  totalItems: number;
  passCount: number;
  rate: number;
}

interface ComplianceMatrixProps {
  title: string;
  domains: ComplianceDomain[];
  overallRate: number;
}

export function ComplianceMatrix({
  title,
  domains,
  overallRate,
}: ComplianceMatrixProps) {
  const getStatusColor = (rate: number) => {
    if (rate >= 90) return 'var(--color-success)';
    if (rate >= 70) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div
      className="border rounded-lg p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        <div
          className="text-2xl font-bold"
          style={{ color: getStatusColor(overallRate) }}
        >
          {overallRate}%
        </div>
      </div>

      <div className="space-y-2">
        {domains.map((domain) => (
          <div key={domain.id} className="flex items-center gap-3">
            <span
              className="text-xs font-mono w-12 shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {domain.id}
            </span>
            <span
              className="text-sm w-32 shrink-0 truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {domain.name}
            </span>
            <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${domain.rate}%`,
                  backgroundColor: getStatusColor(domain.rate),
                }}
              />
            </div>
            <span
              className="text-xs w-16 text-right shrink-0"
              style={{ color: getStatusColor(domain.rate) }}
            >
              {domain.passCount}/{domain.totalItems}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
