// Design Ref: MTU-N486 §멀티리전 데이터 동기화
// Plan SC: FR-MR.1~5

export interface Region {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface SyncLink {
  fromRegion: string;
  toRegion: string;
  baseLatencyMs: number;
}

export interface ConflictResolution {
  key: string;
  winner: string;
  strategy: 'last-writer-wins' | 'version-vector' | 'custom';
}

export interface SyncMetric {
  fromRegion: string;
  toRegion: string;
  throughput: number;
  avgLatencyMs: number;
  lagSec: number;
}

export class MultiRegionSync {
  private regions = new Map<string, Region>();
  private links: SyncLink[] = [];

  /** FR-MR.1 리전 토폴로지 */
  registerRegion(r: Region): void {
    this.regions.set(r.id, r);
  }

  addLink(link: SyncLink): void {
    this.links.push(link);
  }

  /** FR-MR.2 지연 예측 (거리 기반) */
  predictLatency(fromId: string, toId: string): number {
    const from = this.regions.get(fromId);
    const to = this.regions.get(toId);
    if (!from || !to) return 0;
    const distKm = this.haversine(from.latitude, from.longitude, to.latitude, to.longitude);
    // 대략 100km당 0.5ms + 기본 10ms
    return +((distKm / 100) * 0.5 + 10).toFixed(2);
  }

  /** FR-MR.3 배치 크기 자동 조정 */
  recommendBatchSize(currentLatencyMs: number, targetLatencyMs = 50): number {
    if (currentLatencyMs > targetLatencyMs * 2) return 100;
    if (currentLatencyMs > targetLatencyMs) return 500;
    return 1000;
  }

  /** FR-MR.4 충돌 해결 */
  resolveConflict(
    key: string,
    writes: Array<{ regionId: string; timestamp: string; version?: number }>,
    strategy: ConflictResolution['strategy'] = 'last-writer-wins',
  ): ConflictResolution {
    if (writes.length === 0) return { key, winner: '', strategy };
    if (strategy === 'last-writer-wins') {
      const winner = [...writes].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]!;
      return { key, winner: winner.regionId, strategy };
    }
    if (strategy === 'version-vector') {
      const winner = [...writes].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0]!;
      return { key, winner: winner.regionId, strategy };
    }
    return { key, winner: writes[0]!.regionId, strategy };
  }

  /** FR-MR.5 동기화 메트릭 */
  snapshot(fromId: string, toId: string, throughput: number, lagSec: number): SyncMetric {
    return {
      fromRegion: fromId,
      toRegion: toId,
      throughput,
      avgLatencyMs: this.predictLatency(fromId, toId),
      lagSec,
    };
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

export const multiRegionSync = new MultiRegionSync();
