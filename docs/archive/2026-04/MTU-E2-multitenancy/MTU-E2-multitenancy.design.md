# MTU-E2: 공공기관 멀티테넌시 SaaS 아키텍처 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-E2 |
| Phase | Phase 5 Ecosystem |
| 문서 유형 | Design |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-E2-multitenancy.plan.md` |
| FR 매핑 | FR-8.5 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 전환율 2026년 40% — 다수 기관 동시 서비스 시 N2SF 등급별 테넌트 격리 필수 |
| WHO | 인프라 아키텍트 (격리 설계), 보안 담당 (정책 적용), 운영팀 (온보딩) |
| RISK | C등급 테넌트 격리 미흡 → N2SF N-03 위반 → CSAP 인증 취소 |
| SUCCESS | N2SF 3등급 격리 전략 + Kyverno 정책 + 1일 자동 온보딩 |

---

## 1. 아키텍처 옵션 평가

### Option A: 테넌트당 클러스터
- 장점: 최대 격리
- 단점: 운영 비용 과다 (테넌트 x N 클러스터)

### Option B: 등급별 차등 격리 (선택)
- 장점: C등급 = 전용 클러스터, S등급 = 네임스페이스, O등급 = 공유 — 비용 대 보안 최적화
- 단점: 3가지 운영 모델 관리 필요
- **선택 근거**: N2SF 3등급 체계와 1:1 매핑, CSAP D-08 접근 통제 동시 충족

### Option C: 모두 네임스페이스 격리
- 장점: 운영 단순
- 단점: C등급 물리적 격리 요건 미충족 (N2SF N-03 위반)

**최종 선택: Option B (등급별 차등 격리)**

---

## 2. 산출물 구조

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `11-multitenancy/architecture-guide.md` | 아키텍처 레퍼런스 | N2SF 등급별 격리 전략 + 전체 구성도 |
| `11-multitenancy/tenant-isolation-policy.md` | 구현 가이드 | Kyverno 정책 YAML + C등급 에어갭 |
| `11-multitenancy/onboarding-procedure.md` | 절차서 | 자동 온보딩 타임라인 (24시간 이내) |

---

## 3. 격리 아키텍처

### C등급 (기밀) — 클러스터 격리
- 전용 k3s 클러스터 (에어갭, 물리 네트워크 분리)
- Harbor 프라이빗 레지스트리만 사용
- 외부 통신 전면 차단 NetworkPolicy

### S등급 (민감) — 네임스페이스 격리
- 공유 k3s 클러스터 내 전용 네임스페이스
- NetworkPolicy ingress/egress 동일 네임스페이스만 허용
- Kyverno 리소스 한도 강제

### O등급 (공개) — 논리 격리
- 공유 네임스페이스
- RBAC 기반 테넌트별 리소스 분리

---

## 4. Kyverno 정책 설계

| 정책명 | 적용 대상 | 기능 |
|--------|---------|------|
| require-tenant-resource-limits | 모든 테넌트 Pod | CPU/메모리 한도 필수화 |
| block-external-network-grade-c | C등급 NS | 외부 이그레스 차단 |
| enforce-namespace-isolation | S등급 NS | 크로스 네임스페이스 통신 차단 |
| require-tenant-labels | 모든 Pod | tenant-id, n2sf-grade 레이블 필수 |

---

## 5. 온보딩 자동화 타임라인

```
T+0h:  온보딩 요청 접수 (기관명, 등급, 용량)
T+1h:  자동 스크립트 실행 (NS 생성, RBAC, Kyverno, Harbor)
T+4h:  격리 테스트 자동 실행
T+8h:  관리자 계정 발급
T+24h: 온보딩 완료 확인 + audit.jsonl 기록
```

---

## 6. Design Anchor

- Plan SC: FR-8.5 (멀티테넌시)
- Design Ref: MTU-C3 CSAP D-08 접근 통제
- Design Ref: MTU-C7 Kyverno Policy as Code
- Design Ref: MTU-I1 k3s 클러스터 구성
- Design Ref: N2SF N-03 격리 영역

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Option B 등급별 차등 격리 선택 | Claude Code |
