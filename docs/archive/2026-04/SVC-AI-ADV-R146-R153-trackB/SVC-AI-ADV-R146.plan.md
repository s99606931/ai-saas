# SVC-AI-ADV-R146 — AI 스마트 알림 라우터

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 3차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 사용자 컨텍스트/시간대/채널 기반 알림 최적 배달 라우팅 |
| 품질 | 채널 우선순위 + 방해금지 시간대 + 알림 중복 억제 |
| 보안 | 사용자 ID 마스킹, C/S 등급 페이로드 차단 |
| 비용 | 규칙 기반 라우팅, 외부 API 없음 |

## Context Anchor

- **WHY**: 채널별 무분별한 알림으로 사용자 알림 피로 증가. 컨텍스트 기반 최적 채널 선택 필요.
- **WHO**: 플랫폼 운영자, 최종 사용자
- **RISK**: 방해금지 시간대 알림 전송, 채널 장애 시 알림 유실
- **SUCCESS**: 알림 등록 → 채널 선택 → 방해금지 검사 → 중복 억제 → 배달 반환
- **SCOPE**: In — 채널 우선순위, 시간대 필터, 중복 억제, 감사. Out — 실제 채널 전송(이메일/SMS).

## 요구사항

- **FR-R146.1**: `registerUser(userId, preferences)` — 사용자 알림 설정 등록
- **FR-R146.2**: `route(notification)` — 최적 채널 선택 + 방해금지 검사
- **FR-R146.3**: `suppressDuplicate(userId, key, ttlMs)` — 중복 알림 억제
- **FR-R146.4**: `getDeliveryHistory(userId)` — 배달 이력 조회
- **FR-R146.5**: `getAuditLog()` — 라우팅 이력 (CSAP D-06)
- **NFR-R146.1**: TypeScript strict 0 에러, 테스트 5개+

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
