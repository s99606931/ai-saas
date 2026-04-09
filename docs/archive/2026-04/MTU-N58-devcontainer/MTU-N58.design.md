# MTU-N58: DevContainer 개발 환경 설계 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: bkend-expert

---

## 3.1 구조

```
.devcontainer/
  devcontainer.json          # 메인 설정
  Dockerfile                 # Node.js 22 + k8s 도구
  post-create.sh             # 초기화 스크립트
  onboarding-guide.md        # 온보딩 가이드
```

## 3.2 도구 목록

- Node.js 22 LTS + pnpm
- kubectl, helm, flux, kustomize, k9s
- step CLI, cosign, velero CLI, linkerd CLI
- git, jq, yq, shellcheck
- PostgreSQL/Redis 클라이언트

## 3.3 VS Code 확장

12개 사전 설치: Kubernetes, Docker, ESLint, Prettier, GitLens, YAML, Markdown, Thunder Client, Error Lens, TODO Highlight, Better Comments, Path Intellisense

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | bkend-expert |
