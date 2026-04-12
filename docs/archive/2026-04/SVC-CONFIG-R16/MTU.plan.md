# SVC-CONFIG-R16 Plan -- 중앙 설정 관리 패키지

> Round 16: 환경별 설정 오버라이드 + 런타임 리로드 + 시크릿 참조 해석
> 버전: 1.0.0 | 작성일: 2026-04-09 | 작성자: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 서비스별 설정 산재 해소, 환경 전환 비용 절감 |
| 기술 | @public-saas/config-vault 패키지: 계층형 설정, 스키마 검증, 런타임 리로드 |
| 보안 | CSAP D-09 암호화: 시크릿 참조 해석, 하드코딩 방지, 환경별 격리 |
| 운영 | 설정 변경 감사 로그, 환경별 자동 오버라이드, 설정 건강 검사 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 17개 서비스가 각자 환경 변수 파싱, 기본값 설정이 제각각 |
| WHO | 개발자, SRE 팀, 보안 관리자 |
| RISK | 환경 변수 누락 시 런타임 에러, 시크릿 하드코딩 위험 |
| SUCCESS | 중앙 설정 로드, Zod 스키마 검증, 환경별 오버라이드, 시크릿 참조 |
| SCOPE | config-vault 패키지 생성, ConfigLoader, SchemaValidator, SecretResolver |

## 기능 요구사항

### FR-CFG.1: @public-saas/config-vault 패키지 생성

**모듈 구조**:
- `ConfigLoader`: 계층형 설정 로드 (기본 → 환경별 → 환경변수 → 런타임)
- `ConfigValidator`: 스키마 기반 설정 검증
- `SecretResolver`: 시크릿 참조 해석 (`$secret:KEY_NAME`)
- `ConfigWatcher`: 런타임 설정 변경 감지
- `configPlugin`: Fastify 플러그인

### FR-CFG.2: 계층형 설정 로드

- 우선순위: 런타임 > 환경변수 > 환경별 파일 > 기본 설정
- 중첩 키 지원 (dot notation: `db.host`, `db.port`)
- 타입 안전한 접근 (제네릭)

### FR-CFG.3: 설정 스키마 검증

- 로드 시 스키마 검증 (누락/타입 오류 탐지)
- 필수/선택 필드 구분
- 기본값 자동 적용

### FR-CFG.4: 시크릿 참조 해석

- `$secret:DB_PASSWORD` → process.env.DB_PASSWORD 자동 해석
- 미해석 시크릿 참조 감지 (시작 시 경고)
- 하드코딩 시크릿 탐지 패턴

### FR-CFG.5: 런타임 설정 변경

- 런타임 설정 업데이트 (재시작 없이)
- 변경 이벤트 알림 (옵저버 패턴)
- 변경 감사 로그

## 검증 기준

- 계층형 설정 우선순위 검증
- 스키마 검증 실패 시 에러 반환
- 시크릿 참조 해석 정상 동작
- 런타임 변경 + 이벤트 알림 검증
- 전체 테스트 PASS

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
