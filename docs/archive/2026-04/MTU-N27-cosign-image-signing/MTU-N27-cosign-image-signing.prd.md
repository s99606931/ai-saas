# PRD: MTU-N27 Cosign 이미지 서명 실전 적용

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N27 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead (Opus 4.6) |
| 복잡도 | HIGH |

---

## WHY — 왜 필요한가

CSAP D-12 (시스템 개발 보안)과 D-05-03 (공급망 보안)은 컨테이너 이미지의 무결성 검증을 요구합니다.
기존 MTU-C8에서 Cosign 서명 가이드 문서를 작성했으나, 실제 Harbor 레지스트리에서 이미지 서명/검증을
실행한 적이 없습니다. 이번 MTU에서 실전 적용하여 CSAP 인증 증적을 확보합니다.

## WHO — 누가 사용하는가

- DevOps 엔지니어: CI/CD 파이프라인에서 빌드 후 자동 서명
- 보안 담당자: 서명 검증 정책 관리
- CSAP 심사 대응팀: 서명 증적 제출

## RISK — 위험 요소

- 폐쇄망 환경에서 Fulcio/Rekor 접근 불가 → 로컬 키 쌍 모드 필수
- Harbor insecure registry 설정 시 서명 저장 호환성
- Kyverno verify-image-signature 정책이 기존 Pod에 영향

## SUCCESS — 성공 기준

1. Cosign 키 쌍 생성 완료 (cosign.key, cosign.pub)
2. Harbor 이미지 서명 성공 (public-saas/test-app)
3. 서명 검증 성공 (cosign verify 통과)
4. Kyverno 이미지 서명 검증 정책 YAML 생성
5. Gitea Actions 서명 자동화 워크플로우 작성

## SCOPE — 범위

### 포함
- Cosign 설치 및 키 쌍 생성
- Harbor 이미지 서명/검증 실행
- Kyverno ClusterPolicy YAML 작성
- CI/CD 서명 자동화 워크플로우 문서
- 실행 가이드 문서

### 제외
- Fulcio/Rekor 서버 구축 (폐쇄망 대상 외)
- Notary v2 연동 (Cosign 표준 우선)

---

## 시장조사 반영

- Cosign v3.0.6 (2026-04-06 릴리스) 사용
- sigstore-go 기반 차세대 Cosign 방향
- Kyverno + Cosign 조합이 k3s 경량 환경에 최적
- Harbor v2.11.2 OCI 호환 서명 저장 지원 확인

### 참조
- [Sigstore Cosign 공식 문서](https://docs.sigstore.dev/cosign/signing/signing_with_containers/)
- [Kyverno + Cosign 이미지 검증](https://medium.com/@anil.goyal0057/securing-your-kubernetes-deployments-docker-image-signing-and-verification-with-cosign-and-kyverno-e9bed3ae3efd)
- [Chainguard Cosign 서명 가이드](https://edu.chainguard.dev/open-source/sigstore/cosign/how-to-sign-a-container-with-cosign/)
