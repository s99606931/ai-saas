# MTU-P13: 감사 로그 서비스 — Design 문서

> **문서 ID**: DESIGN-MTU-P13 | **복잡도**: HIGH | **작성일**: 2026-04-05
> **Plan 참조**: PLAN-MTU-P13 | **CSAP**: D-06

## 1. Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-06 필수, append-only 감사 로그, SHA-256 체인 무결성 |
| 기술 | Fastify 5 + Prisma 6, AuditLog 모델, 체인 해시 검증 |
| 보안 | append-only (UPDATE/DELETE 금지), 1년 보존, 로그 내보내기 |
| 운영 | 15개 서비스의 audit-sdk 스텁 → HTTP 전송 연동 대상 |

## 2. 아키텍처 설계

### 2.1 API 엔드포인트

| 메서드 | 경로 | FR | 설명 |
|--------|------|-----|------|
| POST | /audit/logs | FR-P13.1 | 감사 로그 기록 (append-only) |
| GET | /audit/logs | FR-P13.3 | 감사 로그 조회 (필터, 페이지네이션) |
| POST | /audit/verify | FR-P13.4 | SHA-256 체인 무결성 검증 |
| GET | /audit/export | FR-P13.6 | 감사 로그 내보내기 (CSV, JSON) |
| GET | /audit/stats | FR-P13.5 | 감사 로그 통계 (보존 현황) |

### 2.2 핵심 로직

1. **append-only 기록**: `appendAuditLog()` — 이전 해시 조회 → SHA-256 해시 계산 → INSERT
2. **SHA-256 체인**: `previousHash` 필드로 로그 간 연결, 수정/삭제 시 체인 파괴 감지
3. **무결성 검증**: `verifyAuditLogIntegrity()` — 전체/부분 체인 재계산 비교
4. **내보내기**: CSV (RFC 4180 준수) 또는 JSON Lines 형식
5. **보존 정책**: `retentionDays = 365`, 통계 API에서 보존 현황 제공

### 2.3 기존 lib 활용

- `src/lib/append-only.ts` — `appendAuditLog()` 이미 구현
- `src/lib/integrity.ts` — `verifyAuditLogIntegrity()` 이미 구현

## 3. Design Anchor

| 항목 | 선택 | 근거 |
|------|------|------|
| 해시 알고리즘 | SHA-256 | CSAP D-06 요건, 국가정보원 암호 알고리즘 |
| 저장소 | PostgreSQL (Prisma) | 기존 인프라 활용, ACID 보장 |
| 내보내기 형식 | CSV + JSON | 감리 산출물 호환성 |
| 보존 기간 | 365일 | CSAP D-06 최소 1년 |

## 4. Session Guide

1. 기존 lib (append-only.ts, integrity.ts) 활용하여 핸들러 구현
2. Zod 스키마 기반 입력 검증
3. 페이지네이션 (cursor 기반) + 필터 (action, tenantId, actorId, dateRange)
4. CSV/JSON 내보내기 스트리밍
5. 보존 통계 API

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
