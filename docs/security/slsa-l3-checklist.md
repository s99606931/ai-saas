# SLSA Level 3 체크리스트 — 공공기관 SaaS 프레임워크

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **참조**: https://slsa.dev/spec/v1.0/levels
> **Design Ref**: MTU-N46 Design
> **Plan SC**: FR-N46.1

---

## SLSA Level 요건 달성 현황

### Level 1: 빌드 출처 존재

| # | 요건 | 구현 | 상태 |
|---|------|------|------|
| L1-1 | 빌드 프로세스 정의됨 | `.gitea/workflows/` 워크플로우 | 완료 |
| L1-2 | 빌드 출처(Provenance) 존재 | in-toto Provenance v1 자동 생성 | 완료 |
| L1-3 | 패키지 레지스트리에 출처 첨부 | Harbor OCI attestation 저장 | 완료 |

### Level 2: 서명된 출처

| # | 요건 | 구현 | 상태 |
|---|------|------|------|
| L2-1 | 호스팅된 빌드 서비스 사용 | Gitea Actions (self-hosted runner) | 완료 |
| L2-2 | 출처 생성이 빌드 서비스에 의해 수행됨 | 워크플로우 내 자동 생성 | 완료 |
| L2-3 | 출처가 빌드 서비스에 의해 서명됨 | Cosign keyless/키 기반 서명 | 완료 |

### Level 3: 변조 방지

| # | 요건 | 구현 | 상태 |
|---|------|------|------|
| L3-1 | 격리된 빌드 환경 | 에페머럴 컨테이너 러너 (빌드마다 새 환경) | 완료 |
| L3-2 | 서명 키가 빌드 플랫폼에 의해 관리 | Cosign 키 — 러너 환경에만 존재 | 완료 |
| L3-3 | 사용자가 서명 키에 직접 접근 불가 | Sealed Secret으로 키 암호화 관리 | 완료 |
| L3-4 | 빌드 로그 무결성 | Gitea Actions 로그 + 감사 추적 | 완료 |
| L3-5 | 소스 무결성 | Git 커밋 해시 + 브랜치 보호 규칙 | 완료 |
| L3-6 | 의존성 완전성 | SBOM (Syft) + 해시 고정 + Grype 스캔 | 완료 |

---

## CSAP 매핑

| SLSA 요건 | CSAP 항목 | N2SF 영역 |
|-----------|----------|----------|
| 빌드 출처 | D-12 시스템 개발 보안 | N-04 소프트웨어 보안 |
| 서명 검증 | D-09 암호화 | N-03 데이터 보안 |
| 접근 통제 | D-08 접근 통제 | N-01 접근 통제 |
| 감사 추적 | D-06 침해사고 관리 | N-06 보안 관제 |

---

## 검증 방법

```bash
# 1. 빌드 증명 확인
cosign verify-attestation \
  --type slsaprovenance \
  --key cosign.pub \
  harbor.local/saas-platform/api-gateway:latest

# 2. SLSA 검증 스크립트
bash scripts/verify-slsa.sh harbor.local/saas-platform/api-gateway:latest

# 3. Kyverno 정책 검증 (배포 시 자동)
kubectl get clusterpolicy verify-slsa-provenance
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
