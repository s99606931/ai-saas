// Platform Maturity Radar — 플랫폼 성숙도 레이더 차트 — MTU-N560
// Design Ref: MTU-N243 platform-maturity-assessment
// Plan SC: FR-UP.AI.10

'use client';

import { useEffect, useMemo, useState } from 'react';

interface MaturityData {
  tenantId: string;
  assessedAt: string;
  dimensions: Array<{
    name: string;
    score: number; // 0~5
    target: number;
  }>;
  overallLevel: 'initial' | 'managed' | 'defined' | 'measured' | 'optimized';
}

interface PlatformMaturityRadarProps {
  tenantId: string;
  size?: number;
}

const LEVEL_LABEL: Record<MaturityData['overallLevel'], string> = {
  initial: 'Initial (1)',
  managed: 'Managed (2)',
  defined: 'Defined (3)',
  measured: 'Measured (4)',
  optimized: 'Optimized (5)',
};

const LEVEL_COLOR: Record<MaturityData['overallLevel'], string> = {
  initial: 'var(--color-error)',
  managed: 'var(--color-warning)',
  defined: 'var(--color-info)',
  measured: 'var(--color-success)',
  optimized: 'var(--color-primary)',
};

interface PolygonPoint {
  x: number;
  y: number;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleRad: number): PolygonPoint {
  return { x: cx + radius * Math.cos(angleRad), y: cy + radius * Math.sin(angleRad) };
}

function pointsToPath(points: PolygonPoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
}

export function PlatformMaturityRadar({ tenantId, size = 320 }: PlatformMaturityRadarProps) {
  const [data, setData] = useState<MaturityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
        const res = await fetch(`${apiBase}/api/platform/maturity?tenantId=${tenantId}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: MaturityData };
        setData(json.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId]);

  const geometry = useMemo(() => {
    if (!data) return null;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 40;
    const max = 5;
    const count = data.dimensions.length;

    const axisPoints: Array<{ x: number; y: number; label: string }> = [];
    const scorePoints: PolygonPoint[] = [];
    const targetPoints: PolygonPoint[] = [];

    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const dim = data.dimensions[i]!;
      const labelPt = polarToCartesian(cx, cy, radius + 18, angle);
      axisPoints.push({ x: labelPt.x, y: labelPt.y, label: dim.name });
      scorePoints.push(polarToCartesian(cx, cy, (radius * dim.score) / max, angle));
      targetPoints.push(polarToCartesian(cx, cy, (radius * dim.target) / max, angle));
    }

    const gridLevels = [1, 2, 3, 4, 5].map((level) => {
      const pts: PolygonPoint[] = [];
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        pts.push(polarToCartesian(cx, cy, (radius * level) / max, angle));
      }
      return pointsToPath(pts);
    });

    return { cx, cy, axisPoints, scorePath: pointsToPath(scorePoints), targetPath: pointsToPath(targetPoints), gridLevels };
  }, [data, size]);

  if (loading) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        성숙도 데이터 로딩 중...
      </div>
    );
  }

  if (!data || !geometry) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--color-error)' }}>
        성숙도 데이터 없음
      </div>
    );
  }

  return (
    <div
      className="p-4 border rounded-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      role="region"
      aria-label="플랫폼 성숙도 레이더"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          플랫폼 성숙도
        </p>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{ backgroundColor: LEVEL_COLOR[data.overallLevel], color: '#fff' }}
        >
          {LEVEL_LABEL[data.overallLevel]}
        </span>
      </div>

      <svg width={size} height={size} role="img" aria-label="성숙도 레이더 차트">
        {geometry.gridLevels.map((path, i) => (
          <path key={i} d={path} fill="none" stroke="var(--color-border)" strokeWidth="1" opacity="0.4" />
        ))}
        <path d={geometry.targetPath} fill="var(--color-primary)" fillOpacity="0.1" stroke="var(--color-primary)" strokeWidth="1" strokeDasharray="4 2" />
        <path d={geometry.scorePath} fill="var(--color-success)" fillOpacity="0.3" stroke="var(--color-success)" strokeWidth="2" />
        {geometry.axisPoints.map((pt) => (
          <text
            key={pt.label}
            x={pt.x}
            y={pt.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill="var(--color-text-muted)"
          >
            {pt.label}
          </text>
        ))}
      </svg>

      <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
        평가일: {new Date(data.assessedAt).toLocaleDateString('ko-KR')}
      </p>
    </div>
  );
}
