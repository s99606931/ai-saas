# MTU-N116: ChatOps 통합 (BotKube + 인시던트 알림)

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 운영팀 채팅 기반 Kubernetes 관리, 인시던트 자동 알림, 실시간 운영 가시성 |
| 기술 | BotKube(Botkube) Helm 배포, Slack/Teams 웹훅, kubectl 원격 실행 |
| 보안 | RBAC 기반 명령 제한, 감사 로그 기록, N2SF 데이터 등급 필터링 |
| 운영 | ChatOps로 MTTR 50% 단축, 인시던트 대응 표준화 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N116.1 | Botkube Helm values 및 배포 매니페스트 | HIGH |
| FR-N116.2 | 채널별 알림 라우팅 (인시던트/일반/감사) | HIGH |
| FR-N116.3 | kubectl 명령 RBAC 제한 (읽기 전용 기본) | HIGH |
| FR-N116.4 | 인시던트 자동 알림 (Alertmanager 연동) | HIGH |
| FR-N116.5 | ChatOps 명령 감사 로그 | MED |
| FR-N116.6 | E2E 테스트 | HIGH |
