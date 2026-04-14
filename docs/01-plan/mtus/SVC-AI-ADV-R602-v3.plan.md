# SVC-AI-ADV-R602 (v3) Plan — AI기반 지식베이스 자동 갱신 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 신규 문서 수신 시 지식베이스를 자동 갱신하여 정보 최신성 보장 |
| WHO | 지식관리 담당자, 콘텐츠 운영팀 |
| RISK | 만료/구버전 문서 유입 차단 + C/S 등급 데이터 차단 |
| SUCCESS | SC-R602v3-1: 신규 항목 추가 / SC-R602v3-2: 만료 항목 제거 / SC-R602v3-3: 갱신 통계 |
| SCOPE | knowledge-base-updater-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R602v3.1: 입력 (entries: {id, title, grade: 'C'|'S'|'O', updatedAt: ISO, ttlDays}[])
- FR-R602v3.2: C/S 등급 → BLOCKED 에러
- FR-R602v3.3: now - updatedAt > ttlDays → 만료 처리(EXPIRED)
- FR-R602v3.4: 그 외 → ACTIVE
- FR-R602v3.5: 결과 = {active: number, expired: number, items: {id, status}[]}

## 추적성
FR-R602v3.* ↔ `knowledge-base-updater-v3.ts` ↔ 테스트 ↔ N2SF N-05
