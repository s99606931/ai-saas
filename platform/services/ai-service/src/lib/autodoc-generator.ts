/**
 * AutoDoc Generator — SVC-AI-ADV-R99
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R99.design.md
 * Plan SC: FR-R99.1 ~ FR-R99.5
 *
 * TypeScript 함수 시그니처를 정규식으로 추출하여 JSDoc 템플릿 생성.
 * 감리 문서 자동화용 (행안부 기준).
 */

export interface FunctionParam {
  name: string
  type: string
  optional: boolean
}

export interface FunctionSignature {
  name: string
  params: FunctionParam[]
  returnType: string
  isAsync: boolean
  isExported: boolean
}

export interface JsDocBlock {
  functionName: string
  comment: string
}

const FUNC_REGEX =
  /(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^{;\n]+)/g

const ARROW_REGEX =
  /(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*:\s*([^=]+?)=>/g

export class AutoDocGenerator {
  /**
   * FR-R99.1: 소스에서 함수 시그니처 추출.
   */
  parseSignature(source: string): FunctionSignature[] {
    const results: FunctionSignature[] = []

    FUNC_REGEX.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = FUNC_REGEX.exec(source)) !== null) {
      results.push(
        this.buildSig(
          m[3]!,
          m[4]!,
          m[5]!.trim(),
          Boolean(m[2]),
          Boolean(m[1]),
        ),
      )
    }

    ARROW_REGEX.lastIndex = 0
    while ((m = ARROW_REGEX.exec(source)) !== null) {
      results.push(
        this.buildSig(
          m[2]!,
          m[4]!,
          m[5]!.trim(),
          Boolean(m[3]),
          Boolean(m[1]),
        ),
      )
    }

    return results
  }

  /**
   * FR-R99.2, FR-R99.3: JSDoc 주석 생성.
   */
  generateJsDoc(sig: FunctionSignature, description?: string): string {
    const lines: string[] = ['/**']
    lines.push(` * ${description ?? 'TODO: 함수 설명을 작성하세요.'}`)
    if (sig.params.length > 0 || sig.returnType !== 'void') {
      lines.push(' *')
    }
    for (const p of sig.params) {
      const mark = p.optional ? '[' + p.name + ']' : p.name
      lines.push(` * @param {${p.type}} ${mark} - TODO: 설명`)
    }
    if (sig.returnType && sig.returnType !== 'void') {
      lines.push(
        ` * @returns {${sig.returnType}} TODO: 반환값 설명`,
      )
    }
    if (sig.isAsync) {
      lines.push(' * @async')
    }
    lines.push(' */')
    return lines.join('\n')
  }

  /**
   * FR-R99.4: 파일 전체 일괄 처리.
   */
  generateForFile(source: string): JsDocBlock[] {
    const sigs = this.parseSignature(source)
    return sigs.map((sig) => ({
      functionName: sig.name,
      comment: this.generateJsDoc(sig),
    }))
  }

  private buildSig(
    name: string,
    paramsRaw: string,
    returnType: string,
    isAsync: boolean,
    isExported: boolean,
  ): FunctionSignature {
    return {
      name,
      params: this.parseParams(paramsRaw),
      returnType,
      isAsync,
      isExported,
    }
  }

  private parseParams(raw: string): FunctionParam[] {
    const trimmed = raw.trim()
    if (trimmed === '') return []
    const parts = this.splitTopLevel(trimmed, ',')
    return parts.map((part) => {
      const m = part
        .trim()
        .match(/^(\.\.\.)?([\w$]+)(\?)?\s*:\s*(.+)$/)
      if (!m) {
        return { name: part.trim(), type: 'unknown', optional: false }
      }
      return {
        name: m[2]!,
        type: m[4]!.trim(),
        optional: m[3] === '?',
      }
    })
  }

  private splitTopLevel(input: string, sep: string): string[] {
    const out: string[] = []
    let depth = 0
    let buf = ''
    for (const ch of input) {
      if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth++
      else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth--
      if (ch === sep && depth === 0) {
        out.push(buf)
        buf = ''
      } else {
        buf += ch
      }
    }
    if (buf.trim() !== '') out.push(buf)
    return out
  }
}
