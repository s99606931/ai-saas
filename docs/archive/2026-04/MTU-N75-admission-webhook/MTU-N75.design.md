# MTU-N75: Admission Webhook 커스텀 보안 검증기 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## 1. 정책 설계

### 1.1 이미지 레지스트리 화이트리스트
- 허용 레지스트리: harbor.saas.internal, registry.k8s.io, docker.io/library
- 차단: 기타 모든 레지스트리
- 예외: kube-system, flux-system

### 1.2 필수 라벨
- `app.kubernetes.io/name` (필수)
- `app.kubernetes.io/component` (필수)
- `team` (필수)

### 1.3 리소스 기본값 Mutation
- CPU request: 50m, limit: 200m
- Memory request: 64Mi, limit: 256Mi

### 1.4 시크릿 환경변수 검증
- `env[].value`에 base64 인코딩 패턴 감지 → 차단
- `envFrom.secretRef` 사용 강제

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
