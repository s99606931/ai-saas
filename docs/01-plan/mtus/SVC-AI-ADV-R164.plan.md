# MTU Plan — SVC-AI-ADV-R164 AI Service Catalog Manager

> **원 요청 번호**: R164
> **모듈**: `platform/services/ai-service/src/lib/ai-service-catalog-manager-r164.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI 서비스 카탈로그 관리 — 발견/등록/접근제어 |
| 기술 | 서비스 등록/조회/검색 + RBAC 접근제어 |
| 보안 | 등록/접근 감사, C/S 차단, 권한 검증 |
| 규제 | CSAP D-08 접근통제, D-06 감사 |

## Context Anchor

- WHY: 조직 내 AI 서비스 무분별 난립 → 표준화된 카탈로그 필요
- WHO: AI 서비스 소유자, 운영자, 사용자
- RISK: 승인되지 않은 AI 서비스 사용 → 규정 위반
- SUCCESS: 등록/검색/접근제어, 감사 로그 완비
- SCOPE: register(), discover(), requestAccess(), approveAccess()

## FR

| ID | 설명 |
|----|------|
| FR-R164.1 | register(service, owner, grade): 카탈로그 등록 |
| FR-R164.2 | discover(query): 이름/태그/카테고리 검색 |
| FR-R164.3 | requestAccess(serviceId, userId): 접근 요청 |
| FR-R164.4 | approveAccess(requestId, approver): 요청 승인 |
| FR-R164.5 | 승인된 사용자만 카탈로그 상세 조회 |
| FR-R164.6 | getStats(), getAuditLog() |
| FR-R164.7 | C/S 등급 서비스 등록 시 차단 |
| FR-R164.8 | 중복 등록 시 duplicate_service |

## 테스트 케이스

- 서비스 등록/조회
- 태그 검색
- 접근 요청/승인 플로우
- 미승인자 상세 조회 차단
- 중복 등록 차단
- C/S 차단
- 카테고리 필터
- 승인자 권한 검증
- 감사 로그
- 통계
