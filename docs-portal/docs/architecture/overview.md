---
sidebar_position: 1
---

# 아키텍처 개요

## 시스템 구성

공공기관 SaaS 프레임워크는 마이크로서비스 아키텍처 기반으로 설계되었습니다.

### 서비스 목록

| 서비스 | 포트 | 역할 |
|--------|------|------|
| auth-service | 3001 | 인증/인가 (JWT RS256) |
| user-service | 3002 | 사용자 관리 |
| tenant-service | 3003 | 테넌트 관리 |
| menu-service | 3004 | 메뉴/권한 관리 |
| notification-service | 3010 | 알림 서비스 |
| ai-service | 3011 | AI/LLM 연동 |
| audit-service | 3013 | 감사 로그 |
| security-monitor-service | 3014 | 보안 모니터링 |

### 인프라 구성

- **PostgreSQL 16**: 주 데이터베이스
- **Redis 7**: 캐시/세션/이벤트 버스
- **MinIO**: 파일 저장소 (S3 호환)
- **k3s**: 경량 Kubernetes (프로덕션)
- **Docker Compose**: 개발/스테이징 환경
