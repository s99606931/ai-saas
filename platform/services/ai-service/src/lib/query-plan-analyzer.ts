// SVC-AI-ADV-R48: SQL 쿼리 플랜 분석기
// Design Ref: §쿼리 플랜 분석 패턴, §인터페이스
// Plan SC: FR-R48.1, FR-R48.2

export interface QueryPlanNode {
  nodeType: string
  cost: number
  rows: number
  relation?: string
  filter?: string
  children: QueryPlanNode[]
  raw: string
}

export interface PlanIssue {
  severity: 'info' | 'warn' | 'critical'
  type:
    | 'seq-scan-large'
    | 'nested-loop-explosion'
    | 'sort-to-disk'
    | 'missing-index'
    | 'hash-join-skew'
    | 'high-cost'
  location: string
  message: string
}

export interface PlanAnalysisResult {
  topCost: number
  issues: PlanIssue[]
  seqScans: string[]
  nestedLoops: number
  totalRows: number
}

export interface IndexRecommendation {
  relation: string
  columns: string[]
  type: 'btree' | 'hash' | 'gin' | 'gist'
  reason: string
  estimatedImpact: 'low' | 'medium' | 'high'
  ddl: string
}

/**
 * PostgreSQL EXPLAIN 출력을 파싱하고 성능 이슈를 식별한다.
 */
export class QueryPlanAnalyzer {
  /**
   * EXPLAIN 텍스트를 트리로 파싱 (간이 파서).
   */
  parse(explainOutput: string): QueryPlanNode {
    if (!explainOutput || explainOutput.trim().length === 0) {
      throw new Error('explain output required')
    }

    const lines = explainOutput.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim())
    if (lines.length === 0) {
      throw new Error('no plan lines found')
    }

    // 스택 기반 파싱 — 들여쓰기로 계층 판별
    const root: QueryPlanNode = this.parseNodeLine(lines[0] ?? '', 0)
    const stack: Array<{ indent: number; node: QueryPlanNode }> = [{ indent: -1, node: root }]

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (!line) continue
      const indent = line.search(/\S/)
      if (indent < 0) continue
      const cleaned = line.trim()
      if (!cleaned.startsWith('->')) {
        // 부가 속성 (Filter, Index Cond)
        const parent = stack[stack.length - 1]?.node
        if (parent) {
          if (cleaned.startsWith('Filter:')) {
            parent.filter = cleaned.substring('Filter:'.length).trim()
          }
        }
        continue
      }

      const node = this.parseNodeLine(cleaned, indent)
      while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) >= indent) {
        stack.pop()
      }
      const parent = stack[stack.length - 1]?.node
      if (parent) parent.children.push(node)
      stack.push({ indent, node })
    }

    return root
  }

  /**
   * 플랜 트리를 순회하여 이슈 식별.
   */
  analyze(plan: QueryPlanNode, query: string): PlanAnalysisResult {
    const issues: PlanIssue[] = []
    const seqScans: string[] = []
    let nestedLoops = 0
    let totalRows = 0
    let topCost = 0

    const walk = (node: QueryPlanNode): void => {
      topCost = Math.max(topCost, node.cost)
      totalRows += node.rows

      if (/^Seq Scan/i.test(node.nodeType)) {
        const relation = node.relation ?? 'unknown'
        seqScans.push(relation)
        if (node.cost > 1000 || node.rows > 10000) {
          issues.push({
            severity: 'critical',
            type: 'seq-scan-large',
            location: relation,
            message: `대형 테이블 ${relation} 순차 스캔 (cost=${node.cost}, rows=${node.rows}) — 인덱스 필요`,
          })
        } else {
          issues.push({
            severity: 'warn',
            type: 'seq-scan-large',
            location: relation,
            message: `${relation} 순차 스캔 — 소규모이나 반복 호출 시 인덱스 권장`,
          })
        }
      }

      if (/^Nested Loop/i.test(node.nodeType)) {
        nestedLoops += 1
        if (node.rows > 100000) {
          issues.push({
            severity: 'critical',
            type: 'nested-loop-explosion',
            location: node.raw.substring(0, 40),
            message: `Nested Loop 결과 행 폭발 (${node.rows}) — Hash Join 권장`,
          })
        }
      }

      if (/^Sort/i.test(node.nodeType) && /external|disk/i.test(node.raw)) {
        issues.push({
          severity: 'warn',
          type: 'sort-to-disk',
          location: node.raw.substring(0, 40),
          message: `디스크 정렬 발생 — work_mem 증가 고려`,
        })
      }

      if (node.cost > 10000) {
        issues.push({
          severity: 'critical',
          type: 'high-cost',
          location: node.nodeType,
          message: `높은 비용 노드 (cost=${node.cost})`,
        })
      }

      for (const c of node.children) walk(c)
    }
    walk(plan)

    // WHERE 절에서 인덱스 힌트 추출
    if (seqScans.length > 0 && /WHERE\s+/i.test(query)) {
      issues.push({
        severity: 'info',
        type: 'missing-index',
        location: seqScans[0] ?? '',
        message: 'WHERE 조건 컬럼에 인덱스 후보 탐지',
      })
    }

    return { topCost, issues, seqScans, nestedLoops, totalRows }
  }

  /**
   * 분석 결과로부터 인덱스 추천 생성.
   */
  recommendIndexes(result: PlanAnalysisResult, query: string): IndexRecommendation[] {
    const recs: IndexRecommendation[] = []
    const whereColumns = this.extractWhereColumns(query)

    for (const relation of result.seqScans) {
      const candidates = whereColumns.filter((c) => !c.includes('.') || c.startsWith(`${relation}.`))
      const cols = candidates.length > 0 ? candidates : ['id']
      const impact = result.topCost > 5000 ? 'high' : result.topCost > 1000 ? 'medium' : 'low'

      recs.push({
        relation,
        columns: cols,
        type: 'btree',
        reason: `Seq Scan 제거 목적 — WHERE 컬럼 ${cols.join(', ')} 기반`,
        estimatedImpact: impact,
        ddl: `CREATE INDEX IF NOT EXISTS idx_${relation}_${cols.join('_')} ON ${relation} (${cols.join(', ')});`,
      })
    }

    return recs
  }

  private parseNodeLine(line: string, _indent: number): QueryPlanNode {
    const cleaned = line.replace(/^->/, '').trim()
    const costMatch = cleaned.match(/cost=[\d.]+\.\.([\d.]+)/)
    const rowsMatch = cleaned.match(/rows=(\d+)/)
    const relationMatch = cleaned.match(/on\s+([a-zA-Z_][\w]*)/)
    const nodeTypeMatch = cleaned.match(/^([A-Za-z ]+?)(?:\s+on|\s+\(cost|$)/)

    return {
      nodeType: nodeTypeMatch?.[1]?.trim() ?? cleaned.split(' ')[0] ?? 'Unknown',
      cost: costMatch ? parseFloat(costMatch[1] ?? '0') : 0,
      rows: rowsMatch ? parseInt(rowsMatch[1] ?? '0', 10) : 0,
      relation: relationMatch?.[1],
      children: [],
      raw: cleaned,
    }
  }

  private extractWhereColumns(query: string): string[] {
    const whereMatch = query.match(/WHERE\s+([\s\S]+?)(?:ORDER BY|GROUP BY|LIMIT|$)/i)
    if (!whereMatch) return []
    const whereClause = whereMatch[1] ?? ''
    const columns: string[] = []
    const colPattern = /([a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)?)\s*(?:=|>|<|>=|<=|!=|IN|LIKE)/gi
    let m: RegExpExecArray | null
    while ((m = colPattern.exec(whereClause)) !== null) {
      const col = m[1]
      if (col && !columns.includes(col)) columns.push(col)
    }
    return columns
  }
}

export function createQueryPlanAnalyzer(): QueryPlanAnalyzer {
  return new QueryPlanAnalyzer()
}
