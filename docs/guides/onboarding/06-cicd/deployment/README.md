# 배포 학습 순서

> **목표**: 코드가 머지된 후 프로덕션에 배포되기까지의 과정을 이해하고, 긴급 상황에서 핫픽스를 배포할 수 있다

---

## 배포 방식 개요

이 플랫폼은 **GitOps** 방식을 사용합니다. 배포를 직접 실행하는 것이 아니라, Git 저장소의 상태가 클러스터 상태를 결정합니다.

```
전통적 배포:
  개발자 → kubectl apply → 서버 (수동, 실수 가능)

GitOps 배포:
  개발자 → git commit → Flux → 서버 (자동, 추적 가능)
```

---

## 학습 순서

1. **`01-gitops-deploy.md`** — 코드 머지 후 자동 배포 흐름, 배포 상태 확인, 롤백 방법
2. **`02-hotfix-process.md`** — 긴급 핫픽스 배포, 단계별 절차, 백포트

---

## 핵심 명령어 미리보기

```bash
# 현재 배포 상태 확인
flux get helmreleases -n saas-services

# 특정 서비스 배포 상태
kubectl rollout status deployment/auth-service -n saas-services

# 즉각 롤백
kubectl rollout undo deployment/auth-service -n saas-services
```
