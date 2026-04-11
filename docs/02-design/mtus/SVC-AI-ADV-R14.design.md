# SVC-AI-ADV-R14: AI Workflow Orchestrator — Design

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

---

## Design Anchor

**선택: 경량 인메모리 DAG 엔진**

## §1 DAG 정의
- 노드: 이름 + 핸들러 함수 + 의존성 + 재시도 정책
- 엣지: 의존성 관계 (A→B = B는 A 완료 후 실행)
- 조건 엣지: 이전 결과에 따른 선택적 실행

## §2 실행 엔진
- 토폴로지 정렬 → 의존성 충족된 노드 병렬 실행
- 각 노드: pending → running → completed/failed/skipped
- 체크포인트: 완료된 노드 상태 저장

## §3 재시도
- 지수 백오프: delay = baseDelay * 2^attempt
- 최대 재시도: 기본 3회
- 재시�� 불가 에러 구분 (validation 에러 등)
