// Design Ref: MTU-N443 §AI 출력 워터마킹
// Plan SC: FR-N443.1~5

import { createHash } from 'node:crypto';

export interface WatermarkMetadata {
  modelId: string;
  timestamp: string;
  version: string;
}

export interface WatermarkedOutput {
  text: string;
  fingerprint: string;
  metadata: WatermarkMetadata;
}

export interface WatermarkVerification {
  matched: boolean;
  confidence: number;
  suspectedMetadata?: WatermarkMetadata;
}

export interface WatermarkRegistryEntry {
  fingerprint: string;
  metadata: WatermarkMetadata;
  createdAt: string;
}

export class AiOutputWatermarking {
  private registry: WatermarkRegistryEntry[] = [];

  /** FR-N443.1 지문 생성 (텍스트 + 메타데이터 해시) */
  fingerprint(text: string, metadata: WatermarkMetadata): string {
    return createHash('sha256')
      .update(`${text}|${metadata.modelId}|${metadata.timestamp}|${metadata.version}`)
      .digest('hex');
  }

  /** FR-N443.2 텍스트에 워터마크 적용 + 레지스트리 등록 */
  watermark(text: string, metadata: WatermarkMetadata): WatermarkedOutput {
    const fp = this.fingerprint(text, metadata);
    this.registry.push({
      fingerprint: fp,
      metadata,
      createdAt: new Date().toISOString(),
    });
    return { text, fingerprint: fp, metadata };
  }

  /** FR-N443.3 검증: 레지스트리에서 원본 지문 매칭 */
  verify(text: string, candidateMetadata: WatermarkMetadata): WatermarkVerification {
    const fp = this.fingerprint(text, candidateMetadata);
    const match = this.registry.find((r) => r.fingerprint === fp);
    if (match) {
      return { matched: true, confidence: 1, suspectedMetadata: match.metadata };
    }
    // 통계적 유사 — 텍스트만 부분 매칭
    const partial = this.registry.find((r) => r.metadata.modelId === candidateMetadata.modelId);
    return {
      matched: false,
      confidence: partial ? 0.3 : 0,
      ...(partial ? { suspectedMetadata: partial.metadata } : {}),
    };
  }

  /** FR-N443.4 제거 저항성 평가 (수정 후 재검증) */
  assessRobustness(original: string, modified: string, metadata: WatermarkMetadata): number {
    const origFp = this.fingerprint(original, metadata);
    const modFp = this.fingerprint(modified, metadata);
    if (origFp === modFp) return 1;
    // 문자 단위 일치 비율
    const lenMin = Math.min(original.length, modified.length);
    let same = 0;
    for (let i = 0; i < lenMin; i++) {
      if (original[i] === modified[i]) same++;
    }
    return +(same / Math.max(1, Math.max(original.length, modified.length))).toFixed(3);
  }

  /** FR-N443.5 레지스트리 조회 */
  listRegistry(): readonly WatermarkRegistryEntry[] {
    return this.registry;
  }
}

export const aiOutputWatermarking = new AiOutputWatermarking();
