/**
 * Realtime Translation Streamer — SVC-AI-ADV-R150 (트랙 B 3차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R146-R153-trackB/SVC-AI-ADV-R150.design.md
 * Plan SC: FR-R150.1 ~ FR-R150.5
 *
 * AsyncGenerator SSE 기반 실시간 번역 스트리밍.
 * N2SF N-05: C/S 등급 차단. 모의 번역 (테스트용 결정적 출력).
 */

// Design Ref: §2 — 타입 정의

export type DataGrade = 'C' | 'S' | 'O'

export interface TranslationChunk {
  index: number
  original: string
  translated: string
  locale: string
  progress: number
}

export interface TranslationResult {
  stream: AsyncGenerator<TranslationChunk>
  totalChunks: number
  requestId: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  requestId: string
  detail: Record<string, unknown>
}

let requestCounter = 0

export class RealtimeTranslationStreamer {
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R150.1 — Design Ref: §3.1 청크 분리
  getChunks(text: string): string[] {
    return text.split(/[.!?。\n]+/).map((s) => s.trim()).filter((s) => s.length > 0)
  }

  // Plan SC: FR-R150.2 — Design Ref: §3.2 모의 번역
  private mockTranslate(original: string, toLocale: string): string {
    return `[${toLocale}] ${original}`
  }

  // Plan SC: FR-R150.3 — N2SF N-05 차단 + AsyncGenerator 스트림
  translate(text: string, fromLocale: string, toLocale: string, grade: DataGrade = 'O'): TranslationResult {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 데이터 번역 금지 (N2SF N-05)`)
    }

    const chunks = this.getChunks(text)
    const totalChunks = chunks.length
    const requestId = `REQ-${++requestCounter}`

    this.appendAudit('translation.start', requestId, { fromLocale, toLocale, totalChunks })

    const mockTranslate = (original: string, locale: string) => this.mockTranslate(original, locale)
    const appendAudit = (action: string, reqId: string, detail: Record<string, unknown>) =>
      this.appendAudit(action, reqId, detail)

    const stream = (async function* (): AsyncGenerator<TranslationChunk> {
      for (let i = 0; i < chunks.length; i++) {
        const original = chunks[i] ?? ''
        const translated = mockTranslate(original, toLocale)
        const chunk: TranslationChunk = {
          index: i,
          original,
          translated,
          locale: toLocale,
          progress: (i + 1) / totalChunks,  // Design Ref: §3.3
        }
        yield chunk
      }
      appendAudit('translation.complete', requestId, { totalChunks })
    })()

    return { stream, totalChunks, requestId }
  }

  // Plan SC: FR-R150.4 — 스트림 결과 수집 헬퍼
  async collectChunks(result: TranslationResult): Promise<TranslationChunk[]> {
    const collected: TranslationChunk[] = []
    for await (const chunk of result.stream) {
      collected.push(chunk)
    }
    return collected
  }

  // Plan SC: FR-R150.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, requestId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, requestId, detail })
  }
}
