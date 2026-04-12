# SVC-AI-ADV-R109-complaint — Public Complaint Classifier (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R109-complaint.plan.md

## 1. 아키텍처

```
registerCategory / registerDepartment
        ↓
PublicComplaintClassifier
  ├─ classify() — 키워드 빈도 기반 분류 + PII 마스킹
  ├─ route() — 카테고리 → 부서 매핑
  ├─ getAuditLog() — append-only 배열
  └─ N2SF guard: C/S 등급 차단
```

## 2. 타입 정의

```typescript
export type DataGrade = 'C' | 'S' | 'O'
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ComplaintCategory {
  categoryId: string
  name: string
  keywords: string[]
  defaultPriority: Priority
}

export interface Department {
  departmentId: string
  name: string
  categories: string[]
}

export interface ClassificationResult {
  categoryId: string | null
  categoryName: string | null
  score: number
  priority: Priority
  maskedText: string
  unclassified: boolean
}

export interface RoutingResult {
  departmentId: string | null
  departmentName: string | null
  classification: ClassificationResult
}

export interface AuditEntry {
  timestamp: string
  action: string
  categoryId: string | null
  departmentId: string | null
  grade: DataGrade
}
```

## 3. 알고리즘

### §3.1 분류
- 각 카테고리의 키워드 집합과 민원 텍스트 교집합 계산
- 키워드 매칭 수 / 카테고리 키워드 수 = score
- 최고 점수 카테고리 선택 (동점 시 먼저 등록된 카테고리)
- score = 0 → unclassified = true

### §3.2 PII 마스킹
- 주민번호: `/\d{6}-[1-4]\d{6}/g` → `######-#######`
- 전화번호: `/01[016789]-\d{3,4}-\d{4}/g` → `010-****-####`
- 이메일: `/[\w.+-]+@[\w-]+\.[\w.]+/g` → `****@***`

### §3.3 N2SF 등급 가드
- C 또는 S 등급 → 즉시 Error throw

## 4. Design Anchor

- CSAP D-06: 모든 분류 이벤트 감사 로그
- N2SF N-05: C/S 등급 차단
