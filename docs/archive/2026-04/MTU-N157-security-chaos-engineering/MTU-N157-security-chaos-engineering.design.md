# MTU-N157 보안 카오스 엔지니어링 — Design

> **작성일**: 2026-04-10

## 아키텍처: Litmus 기반 보안 실험 + 자동 복구 검증

### 보안 카오스 실험 목록
1. NetworkPolicy 삭제 → Kyverno 자동 복구 확인
2. ServiceAccount 토큰 탈취 시뮬레이션 → Falco 감지 확인
3. 비인가 포트 접근 → Cilium 차단 확인
4. PSS 위반 Pod 생성 시도 → Admission Webhook 차단 확인
5. 암호화되지 않은 시크릿 생성 → Sealed Secrets 정책 확인
