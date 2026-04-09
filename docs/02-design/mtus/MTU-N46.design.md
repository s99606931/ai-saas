# MTU-N46: SLSA Level 3 빌드 무결성 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)
> **Plan 참조**: docs/01-plan/mtus/MTU-N46.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 증명 형식 | in-toto SLSA Provenance v1.0 (DSSE 서명 래퍼) |
| 서명 도구 | Cosign (기존 MTU-N27 키 재사용) |
| 빌드 격리 | Gitea Actions 에페머럴 컨테이너 러너 |
| 검증 계층 | Kyverno + cosign verify-attestation |

---

## SLSA L3 요건 매핑

| SLSA 요건 | 구현 방법 | 상태 |
|-----------|---------|------|
| 빌드 출처 기록 | in-toto provenance 자동 생성 | 신규 |
| 격리된 빌드 | 에페머럴 컨테이너 러너 (각 빌드마다 새 환경) | 기존 (Gitea Actions) |
| 변조 불가 증명 | Cosign 서명 (빌드 플랫폼 키) | 기존 키 활용 |
| 의존성 완전성 | SBOM + 해시 고정 (MTU-N37) | 기존 |
| 소스 무결성 | Git 커밋 서명 + 브랜치 보호 | 기존 |

---

## 아키텍처

```
[Git Push] → [Gitea Actions Trigger]
                    ↓
         [에페머럴 컨테이너 러너]
                    ↓
         [빌드] → [SBOM 생성] → [Provenance 생성]
                                      ↓
                              [Cosign 서명 (attestation)]
                                      ↓
                              [Harbor 푸시 (이미지 + 증명)]
                                      ↓
                              [Kyverno 검증 (배포 시)]
```

---

## Provenance 구조 (in-toto SLSA v1.0)

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [{
    "name": "harbor.local/saas-platform/api-gateway",
    "digest": { "sha256": "<image-digest>" }
  }],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": {
    "buildDefinition": {
      "buildType": "https://gitea-actions/v1",
      "externalParameters": {
        "repository": "https://gitea.local/saas/ai-saas",
        "ref": "refs/heads/main",
        "workflow": ".gitea/workflows/slsa-provenance.yml"
      },
      "internalParameters": {
        "runner": "ephemeral-container"
      }
    },
    "runDetails": {
      "builder": {
        "id": "https://gitea.local/actions/runner",
        "version": { "gitea-actions": "1.x" }
      },
      "metadata": {
        "invocationId": "<run-id>",
        "startedOn": "<timestamp>",
        "finishedOn": "<timestamp>"
      }
    }
  }
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
