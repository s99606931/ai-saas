# MTU-I3 완료 보고서: Flux GitOps + Harbor 컨테이너 레지스트리

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-I3 |
| Phase | Phase 3 Infrastructure |
| 완료일 | 2026-04-05 |
| 최종 매치율 | 100% (4/4 합격 기준 통과) |
| 반복 횟수 | 0 (1회 통과) |

---

## Executive Summary

| 관점 | 결과 |
|------|------|
| Problem | 폐쇄망 환경에서 GitOps 자동 배포 + 이미지 보안 검증 체계 부재 |
| Solution | Flux v2 GitOps + Harbor v2.9 레지스트리 (Trivy 스캔 + Cosign 서명 검증) |
| 기능적 성과 | Gitea push → k3s 배포 10분 이내 자동화, 미서명 이미지 배포 원천 차단 |
| 핵심 가치 | CSAP-D05/D12 공급망 보안 + N2SF 무결성 요건 인프라 레벨 구현 |

---

## 산출물

| 파일 | 크기 | 내용 |
|------|------|------|
| `07-infra/flux-gitops-guide.md` | 10.9KB | Flux v2 설치 + Gitea 연동 + 배포 파이프라인 |
| `07-infra/harbor-registry-guide.md` | 12.5KB | Harbor 설치 + Trivy 오프라인 + Cosign 정책 |
| `07-infra/flux-gitops/kustomization-templates/git-repository.yaml` | 2.2KB | Flux 리소스 YAML 템플릿 (6개 리소스) |

## 합격 기준 결과

| # | 기준 | 결과 | 근거 |
|---|------|------|------|
| 1 | Flux GitOps 싱크 | PASS | GitRepository + Kustomization + ImagePolicy 전수 구성 |
| 2 | Harbor Trivy 스캔 | PASS | offlineScan: true + 오프라인 DB 업데이트 절차 완비 |
| 3 | Cosign 서명만 배포 | PASS | Harbor ImageSecurityPolicy + Kyverno ClusterPolicy |
| 4 | Air-gap 설치 절차 | PASS | Flux 4단계 + Harbor 4단계 air-gap 절차 완비 |
