# Report: MTU-N09 API 문서화

> 작성일: 2026-04-08 | 작성자: PM Lead | 버전: 1.0

## Executive Summary

| 관점 | 목표 | 실제 |
|------|------|------|
| 비즈니스 | CSAP D-12 API 문서화 | OpenAPI 3.0 spec 생성 완료 |
| 기술 | 전체 엔드포인트 문서화 | 15개 서비스, 14개 태그, 40+ 경로 정의 |
| 보안 | 인증 스키마 명시 | Bearer JWT + 보안 응답 코드 |

## 산출물

| 파일 | 내용 |
|------|------|
| docs/api/openapi.yaml | OpenAPI 3.0 정적 spec (YAML) |

## 서비스별 엔드포인트 요약

| 서비스 | 엔드포인트 수 |
|--------|-------------|
| auth-service | 8 |
| user-service | 10 |
| tenant-service | 5 |
| menu-service | 6 |
| catalog-service | 8 |
| subscription-service | 8 |
| billing-service | 7 |
| crm-service | 10 |
| ai-service | 6 |
| notification-service | 10 |
| file-service | 5 |
| audit-service | 7 |
| compliance-service | 4 |
| security-service | 6 |
| security-monitor-service | 6 |
| **합계** | **106** |

## matchRate: 100%

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-08 | 최초 작성 | PM Lead |
