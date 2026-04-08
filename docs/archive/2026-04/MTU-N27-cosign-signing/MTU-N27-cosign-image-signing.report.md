# Report: MTU-N27 Cosign 이미지 서명 실전 적용

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N27 |
| 최종 매치율 | 100% (5/5 FR) |
| 완료일 | 2026-04-08 |
| 작성자 | PM Lead (Opus 4.6) |

---

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | CSAP D-12/D-05 증적 확보 | 100% |
| 기술 | Cosign v3.0.6 로컬 키 서명 | 완료 |
| 보안 | 이미지 무결성 검증 | 서명+검증 성공 |
| 운영 | CI/CD 자동 서명 | 워크플로우 작성 완료 |

---

## FR 달성 현황

| FR ID | 요구사항 | 상태 | 증적 |
|-------|---------|------|------|
| FR-N27.1 | Cosign 키 쌍 생성 | PASS | infra/cosign/cosign.pub |
| FR-N27.2 | Harbor 이미지 서명 | PASS | cosign sign 성공 출력 |
| FR-N27.3 | 이미지 서명 검증 | PASS | cosign verify 통과 (exit 0) |
| FR-N27.4 | Kyverno 정책 YAML | PASS | infra/kyverno/verify-image-signature.yaml |
| FR-N27.5 | CI/CD 서명 워크플로우 | PASS | .gitea/workflows/sign-image.yml |

---

## Key Decisions

1. **로컬 키 쌍 모드 선택**: Fulcio/Rekor 외부 의존 제거, 폐쇄망 호환
2. **signing-config.json**: Cosign v3.0.6에서 --tlog-upload=false 제거 대응
3. **Kyverno Audit 모드**: 초기 배포 안정성 확보, 검증 후 Enforce 전환

---

## 산출물

| 경로 | 설명 |
|------|------|
| infra/cosign/cosign.pub | Cosign 공개키 |
| infra/cosign/cosign.key | Cosign 개인키 (.gitignore) |
| infra/cosign/signing-config.json | 서명 설정 |
| infra/cosign/README.md | 키 관리 가이드 |
| infra/kyverno/verify-image-signature.yaml | Kyverno 정책 |
| .gitea/workflows/sign-image.yml | CI/CD 워크플로우 |
| docs/07-infra/cosign-signing-guide.md | 실전 가이드 |
