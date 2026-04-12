// SVC-AI-ADV-R40: 번역 품질 평가 (BLEU 기반)
// Design Ref: §모듈, §인터페이스
// Plan SC: FR-R40.3
//
// sacreBLEU 방식의 n-gram 기반 BLEU 스코어 계산 + 품질 리포트.

export interface QualityReport {
  bleu: number
  length_penalty: number
  precision_ngrams: number[]
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  notes: string[]
}

/**
 * 번역 품질 평가기.
 * 0.60+ A, 0.45+ B, 0.30+ C, 0.15+ D, 그 외 F.
 */
export class TranslationEvaluator {
  /**
   * BLEU 스코어 계산 (최대 4-gram).
   */
  computeBLEU(candidate: string, references: string[]): number {
    if (!candidate || references.length === 0) return 0

    const candTokens = this.tokenize(candidate)
    if (candTokens.length === 0) return 0

    const refTokensList = references.map((r) => this.tokenize(r))
    const maxN = Math.min(4, candTokens.length)

    const precisions: number[] = []
    for (let n = 1; n <= maxN; n += 1) {
      const p = this.modifiedPrecision(candTokens, refTokensList, n)
      precisions.push(p)
    }

    if (precisions.length === 0 || precisions.some((p) => p === 0)) {
      return 0
    }

    const geoMean = Math.exp(precisions.reduce((sum, p) => sum + Math.log(p), 0) / precisions.length)
    const bp = this.brevityPenalty(candTokens.length, refTokensList)
    return bp * geoMean
  }

  /**
   * 번역 결과 평가 및 품질 리포트 생성.
   */
  evaluate(candidate: string, reference: string): QualityReport {
    const refs = [reference]
    const candTokens = this.tokenize(candidate)
    const refTokensList = refs.map((r) => this.tokenize(r))
    const bleu = this.computeBLEU(candidate, refs)

    const precisions: number[] = []
    const maxN = Math.min(4, candTokens.length)
    for (let n = 1; n <= maxN; n += 1) {
      precisions.push(this.modifiedPrecision(candTokens, refTokensList, n))
    }

    const bp = this.brevityPenalty(candTokens.length, refTokensList)
    const notes: string[] = []
    if (bp < 1.0) notes.push('후보 번역이 참조보다 짧음 (brevity penalty 적용)')
    if (precisions[0] !== undefined && precisions[0] < 0.5) notes.push('1-gram 정밀도 낮음')

    return {
      bleu,
      length_penalty: bp,
      precision_ngrams: precisions,
      grade: this.grade(bleu),
      notes,
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
  }

  private modifiedPrecision(
    candidate: string[],
    references: string[][],
    n: number,
  ): number {
    const candNgrams = this.ngrams(candidate, n)
    if (candNgrams.size === 0) return 0

    const maxRefCounts = new Map<string, number>()
    for (const ref of references) {
      const refNgrams = this.ngrams(ref, n)
      for (const [g, c] of refNgrams) {
        const prev = maxRefCounts.get(g) ?? 0
        if (c > prev) maxRefCounts.set(g, c)
      }
    }

    let clipped = 0
    let total = 0
    for (const [g, c] of candNgrams) {
      const maxRef = maxRefCounts.get(g) ?? 0
      clipped += Math.min(c, maxRef)
      total += c
    }
    return total === 0 ? 0 : clipped / total
  }

  private ngrams(tokens: string[], n: number): Map<string, number> {
    const map = new Map<string, number>()
    for (let i = 0; i + n <= tokens.length; i += 1) {
      const g = tokens.slice(i, i + n).join(' ')
      map.set(g, (map.get(g) ?? 0) + 1)
    }
    return map
  }

  private brevityPenalty(candLen: number, refs: string[][]): number {
    if (candLen === 0) return 0
    let closestRefLen = refs[0]?.length ?? 0
    let minDiff = Math.abs(closestRefLen - candLen)
    for (const r of refs) {
      const diff = Math.abs(r.length - candLen)
      if (diff < minDiff) {
        minDiff = diff
        closestRefLen = r.length
      }
    }
    if (candLen > closestRefLen) return 1
    return Math.exp(1 - closestRefLen / candLen)
  }

  private grade(bleu: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (bleu >= 0.6) return 'A'
    if (bleu >= 0.45) return 'B'
    if (bleu >= 0.3) return 'C'
    if (bleu >= 0.15) return 'D'
    return 'F'
  }
}

export function createTranslationEvaluator(): TranslationEvaluator {
  return new TranslationEvaluator()
}
