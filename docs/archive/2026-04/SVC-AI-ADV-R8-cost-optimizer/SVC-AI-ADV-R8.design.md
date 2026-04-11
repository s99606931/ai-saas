# SVC-AI-ADV-R8: AI Cost Optimizer — Design

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R8.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Design Anchor

### 아키텍처 옵션

| 옵션 | 장점 | 단점 | 적합도 |
|------|------|------|--------|
| A: Redis 기반 캐시 | 고성능, 분산 | 외부 서비스 의존 | 불가 (CLAUDE.md §1) |
| B: 인메모리 LRU + 임베딩 (선택) | 외부 의존 없음, 단일 노드 최적 | 재시작 시 초기화 | **높음** |
| C: SQLite 영속 캐시 | 재시작 생존 | 디스크 I/O, 복잡성 | 중간 |

**선택: 옵션 B — 인메모리 LRU + 임베딩**

---

## §1 시맨틱 캐시 (semantic-cache.ts)

### 1.1 캐시 구조

```
캐시 엔트리:
{
  key: string (normalized query hash)
  embedding: number[] (쿼리 임베딩)
  response: string (캐시된 응답)
  tenantId: string (테넌트 격리)
  model: string (사용된 모델)
  createdAt: number (생성 시각)
  accessedAt: number (최종 접근)
  hitCount: number (히트 횟수)
}
```

### 1.2 캐시 조회 알고리즘

1. 쿼리 정규화 (소문자, 공백 정리, PII 제거)
2. 정규화된 쿼리 임베딩 생성
3. 동일 테넌트의 캐시 엔트리와 코사인 유사도 계산
4. 유사도 >= 0.92 → 캐시 히트 (응답 반환)
5. 유사도 < 0.92 → 캐시 미스 (LLM 호출 후 저장)

### 1.3 만료 정책

- TTL: 24시간 (설정 가능)
- LRU: 최대 10,000 엔트리 (설정 가능)
- 수동 무효화: tenantId + 패턴 기반 삭제

---

## §2 동적 모델 라우팅 (cost-optimizer.ts)

### 2.1 복잡도 분류 기준

| 복잡도 | 특성 | 추천 모델 | 비용 배수 |
|--------|------|----------|----------|
| simple | FAQ, 단순 조회, 1-2문장 응답 | haiku | 1x |
| standard | 분석, 요약, 다단계 추론 | sonnet | 3x |
| expert | 법률 해석, 정책 분석, 복합 추론 | opus | 15x |

### 2.2 복잡도 분류 알고리즘

- 키워드 기반 (빠른 1차 필터)
- 메시지 길이 + 대화 턴 수
- 시스템 프롬프트 분석 (전문 분석 요구 감지)

---

## §3 토큰 예산 관리 (token-budget.ts)

### 3.1 예산 구조

```
테넌트 예산:
{
  tenantId: string
  dailyBudgetTokens: number   (일일 한도)
  monthlyBudgetTokens: number (월간 한도)
  usedToday: number
  usedThisMonth: number
  alertThreshold: number (80% 기본)
}
```

### 3.2 차단 로직

- 일일/월간 한도 초과 시 선제 차단
- 예상 토큰 수 계산 후 잔여 예산과 비교
- 80% 도달 시 경고, 100% 도달 시 차단

---

## §4 비용 메트릭

- 모델별 호출 수, 토큰 수, 예상 비용
- 캐시 히트율 (히트/총 조회)
- 라우팅 분포 (모델별 비율)

---

## Session Guide

1. semantic-cache.ts: 캐시 엔트리 + LRU + 코사인 유사도 + 무효화
2. cost-optimizer.ts: 복잡도 분류기 + 모델 선택 + 비용 메트릭
3. token-budget.ts: 예산 관리 + 차단 + 경고
