# MTU-N128: 인시던트 타임라인 생성기 -- 설계 문서

> 작성일: 2026-04-10

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | 셸 스크립트 + 이벤트 소스 통합 + 시간순 정렬 |
| 의존성 | Prometheus API, 감사 로그, Git 히스토리 |
| 산출물 | 타임라인 스크립트, E2E 테스트 |

## 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| 타임라인 생성 스크립트 | `scripts/generate-incident-timeline.sh` | 이벤트 수집 + 시간순 정렬 + 보고서 |
| E2E 테스트 | `scripts/test-incident-timeline.sh` | 검증 |

## 이벤트 소스

| 소스 | 데이터 | 수집 방법 |
|------|--------|---------|
| Prometheus | 알림 발생/해소 | ALERTS API |
| 감사 로그 | 관리 작업 | audit.jsonl 파싱 |
| Git | 배포/변경 | git log --format |
| 수동 | 사용자 입력 이벤트 | --add-event 플래그 |
