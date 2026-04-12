# SVC-AI-ADV-R43 — 설계

## 기존 contract-analyzer.ts와의 차별화
- 기존 `contract-analyzer.ts`: 일반 계약 분석기
- 본 MTU `procurement-contract-analyzer.ts`: 공공 조달 계약 특화 (국가계약법, 지방계약법)

## 모듈
- procurement-contract-analyzer.ts: 공공 조달 계약 조항 분석, 위험도 스코어링
- regulation-compliance-checker.ts: CSAP/N2SF/ISMS-P 체크리스트 기반 준수 검증

## 위험 조항 카테고리
- 과도한 독점권/배타성
- 모호한 지급 조건 (지연이자/선급금)
- 개인정보 처리 누락
- 보안 요건 누락 (CSAP/ISMS-P)
- 부당 특약 (국가계약법 §5 위반)
- 분쟁 해결 관할 (공공 소송)

## 인터페이스
```typescript
interface Clause { id: string; text: string; category?: string }
interface RiskFinding { clauseId: string; severity: 'low'|'med'|'high'|'critical'; reason: string; lawRef?: string }
class ProcurementContractAnalyzer {
  analyze(contract: string): Promise<AnalysisResult>
  extractClauses(contract: string): Clause[]
  scoreRisk(clause: Clause): RiskFinding[]
}
class RegulationComplianceChecker {
  check(contract: string, standards: Array<'CSAP'|'N2SF'|'ISMS-P'>): ComplianceReport
}
```
