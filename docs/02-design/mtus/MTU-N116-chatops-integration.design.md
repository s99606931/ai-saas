# MTU-N116: ChatOps 통합 — 설계 문서

> 작성일: 2026-04-10 | Plan 참조: MTU-N116

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | Botkube + Alertmanager Webhook + RBAC 기반 명령 제어 |
| 핵심 결정 | Botkube로 통합, Slack/Teams 웹훅 추상화, kubectl 읽기 전용 기본 |
| 의존성 | Alertmanager (기 설치), Prometheus (기 설치) |

## 상세 설계

### DS-N116.1: Botkube Helm Values
- 채널 3개: #incidents, #operations, #audit
- kubectl executor: 읽기 전용 기본
- 알림 필터: 심각도별 라우팅

### DS-N116.2: 채널별 알림 라우팅
- #incidents: critical/firing 알림만
- #operations: warning + 배포 이벤트
- #audit: 보안 이벤트 (Falco, 접근 로그)

### DS-N116.3: RBAC 기반 명령 제한
- get, describe, logs: 모든 운영자
- scale, rollout: SRE팀만
- delete, exec: 금지 (비상 시 관리자만)

### DS-N116.4: Alertmanager 웹훅 연동
- Alertmanager → Botkube 웹훅 → 채널 라우팅
