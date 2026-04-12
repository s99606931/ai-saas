// Design Ref: MTU-N481 §랜섬웨어 행동 탐지
// Plan SC: FR-RW.1~5

export interface FileEvent {
  path: string;
  op: 'create' | 'write' | 'rename' | 'delete';
  entropyDelta?: number;
  at: string;
}

export interface ProcessEvent {
  pid: number;
  name: string;
  parentPid: number;
  opsPerSec: number;
  suspiciousApis: string[];
}

export interface RansomwareAlert {
  severity: 'warning' | 'critical';
  indicators: string[];
  affectedPaths: string[];
  at: string;
}

export interface IsolationAction {
  processId: number;
  action: 'kill' | 'freeze' | 'network-block';
  taken: boolean;
}

export interface RecoveryPoint {
  snapshotId: string;
  takenAt: string;
  affectedFiles: number;
}

export class RansomwareAi {
  private encryptionThreshold = 50; // 50+ 파일 고엔트로피 = 의심

  /** FR-RW.1 파일 시스템 이상 */
  detectMassEncryption(events: FileEvent[]): boolean {
    const highEntropy = events.filter((e) => (e.entropyDelta ?? 0) > 0.3);
    return highEntropy.length >= this.encryptionThreshold;
  }

  /** FR-RW.2 프로세스 행동 분석 */
  analyzeProcess(event: ProcessEvent): { suspicious: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (event.opsPerSec > 100) reasons.push('비정상적 IO 속도');
    if (event.suspiciousApis.includes('CryptEncrypt')) reasons.push('암호화 API 남용');
    if (event.suspiciousApis.includes('DeleteShadowCopy')) reasons.push('섀도우 카피 삭제');
    return { suspicious: reasons.length >= 2, reasons };
  }

  /** FR-RW.3 자동 격리 */
  triggerIsolation(pid: number, severity: 'warning' | 'critical'): IsolationAction {
    const action = severity === 'critical' ? 'kill' : 'freeze';
    return { processId: pid, action, taken: true };
  }

  /** FR-RW.4 스냅샷 복구 연동 */
  selectRecoveryPoint(points: RecoveryPoint[], beforeTime: string): RecoveryPoint | undefined {
    return [...points]
      .filter((p) => p.takenAt < beforeTime)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0];
  }

  /** FR-RW.5 인시던트 보고 */
  buildAlert(fileEvents: FileEvent[], processEvent: ProcessEvent): RansomwareAlert {
    const indicators: string[] = [];
    if (this.detectMassEncryption(fileEvents)) indicators.push('대량 암호화 감지');
    const pa = this.analyzeProcess(processEvent);
    indicators.push(...pa.reasons);
    const severity: RansomwareAlert['severity'] = indicators.length >= 3 ? 'critical' : 'warning';
    return {
      severity,
      indicators,
      affectedPaths: fileEvents.slice(0, 10).map((e) => e.path),
      at: new Date().toISOString(),
    };
  }
}

export const ransomwareAi = new RansomwareAi();
