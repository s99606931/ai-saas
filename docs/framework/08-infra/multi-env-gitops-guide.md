# 멀티환경 GitOps 분리 운영 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N41 Design
> **CSAP 참조**: D-12(배포 통제), N2SF 등급별 격리

---

## 1. 환경 구성

| 환경 | N2SF 등급 | 네임스페이스 | 동기화 주기 | 승격 조건 |
|------|---------|------------|-----------|---------|
| dev | O (공개) | saas-dev | 5분 | 자동 |
| stg | O (공개) | saas-staging | 10분 | dev 검증 후 |
| prod | S/C | saas-production | 30분 | stg 검증 + 승인 |

## 2. 디렉토리 구조

```
deploy/
  base/                     # 공통 매니페스트
  envs/
    dev/kustomization.yaml  # Dev overlay
    stg/kustomization.yaml  # Staging overlay
    prod/kustomization.yaml # Production overlay
```

## 3. 환경 승격 절차

### 3.1 dev -> stg

```bash
# Dev에서 검증 완료 후 이미지 태그 업데이트
cd deploy/envs/stg
# kustomization.yaml의 images 섹션 업데이트
# Git 커밋 → Flux 자동 동기화
```

### 3.2 stg -> prod

```bash
# 1. Staging에서 E2E 테스트 통과 확인
# 2. 릴리스 태그 생성
git tag v1.x.x
git push origin v1.x.x

# 3. Production overlay 이미지 태그를 릴리스 태그로 업데이트
# 4. PR 생성 → 보안 담당자 승인 → Merge
# 5. Flux 자동 동기화
```

## 4. N2SF 등급별 보안 정책

| 등급 | 정책 | 구현 |
|------|------|------|
| O | 기본 NetworkPolicy | 네임스페이스 기본 격리 |
| S | 이미지 서명 + SBOM 검증 | Kyverno verify-image + cosign |
| C | 전체 보안 + 감사 로그 | 모든 CSAP 정책 enforce |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
