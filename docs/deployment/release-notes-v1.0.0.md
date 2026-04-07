# Release Notes -- v1.0.0

> **공공기관 SaaS 프레임워크**
> **릴리스일**: 2026-04-08
> **CSAP 등급**: 중/상 등급 인증 대응 완료

---

## 릴리스 요약

공공기관 SaaS 프레임워크 v1.0.0 정식 릴리스.
CSAP 79개 통제항목 + N2SF 6개 보안 영역 100% 커버리지.
17개 마이크로서비스 + 2개 비즈니스 플러그인 프로덕션 레디.

---

## 주요 구성 요소

### 마이크로서비스 (17종)
| 서비스 | 포트 | 설명 |
|--------|------|------|
| api-gateway | 3000 | Fastify 기반 API 게이트웨이 (Rate Limiting, CORS, Swagger) |
| auth-service | 3001 | JWT 인증 + MFA + 세션 관리 |
| user-service | 3002 | 사용자 CRUD + RBAC |
| tenant-service | 3003 | 멀티테넌트 관리 (격리, 할당량) |
| menu-service | 3004 | 역할 기반 메뉴 관리 |
| catalog-service | 3005 | SaaS 카탈로그 (구독 상품 관리) |
| subscription-service | 3006 | 구독 생명주기 관리 |
| billing-service | 3007 | 과금/결제 관리 |
| crm-service | 3008 | 고객 관계 관리 |
| ai-service | 3009 | AI/LLM 게이트웨이 (N2SF 등급 검증) |
| notification-service | 3010 | 알림 (이메일/SMS/웹훅) |
| file-service | 3011 | 파일 관리 (MinIO S3 호환) |
| audit-service | 3012 | 감사 로그 (SHA-256 체인, append-only) |
| compliance-service | 3013 | CSAP/N2SF 준수 현황 API |
| security-monitor-service | 3014 | 보안 모니터링 (로그인 실패, IP 차단) |
| security-service | 3015 | 보안 정책 관리 |
| portal | 4000 | Next.js 15 관리자 포털 |

### 비즈니스 플러그인 (2종)
- **전자결재 플러그인** -- 결재 문서 생성/승인/반려 워크플로우
- **공공데이터 연동 플러그인** -- data.go.kr API 연동

### 인프라
- Docker Compose 전체 서비스 오케스트레이션
- k8s (k3s) 배포 매니페스트 전체
- **Helm Chart** (환경별 values 분리: dev/stg/prod)
- Gitea CI/CD 파이프라인 (CI + E2E + Helm Lint + Deploy + Security)
- Prometheus 알림 규칙 22개 + Grafana 대시보드

---

## 보안 준수 현황

### CSAP 79개 통제항목
| 영역 | 항목 수 | 준수율 |
|------|--------|-------|
| D-01 ~ D-04 | 20 | 100% |
| D-05 ~ D-07 | 15 | 100% |
| D-08 접근 통제 | 12 | 100% |
| D-09 암호화 | 4 | 100% |
| D-10 네트워크 보안 | 8 | 100% |
| D-11 가상화 보안 | 10 | 100% |
| D-12 시스템 개발 보안 | 10 | 100% |

### N2SF 6개 보안 영역
| 영역 | 준수율 |
|------|-------|
| N-01 인증 | 100% |
| N-02 접근 통제 | 100% |
| N-03 데이터 격리 | 100% |
| N-04 암호화 | 100% |
| N-05 AI 데이터 등급 | 100% |
| N-06 모니터링 | 100% |

---

## 품질 지표

| 지표 | 값 |
|------|-----|
| 단위 테스트 | 596건 |
| E2E 통합 테스트 | 155건 |
| 전체 테스트 | 751건 ALL PASS |
| Q-Gate G1~G7 | 전체 PASS |
| CSAP 79항목 | 100% |
| Dead Code | 0건 |
| HIGH 취약점 | 0건 |

---

## 배포 방법

### Docker Compose (개발)
```bash
cp .env.example .env
# .env 파일 편집 (시크릿 값 설정)
docker compose up -d
```

### Helm Chart (운영)
```bash
# 스테이징
helm install saas-stg ./helm/saas-platform -f helm/saas-platform/values-stg.yaml

# 프로덕션
helm install saas-prod ./helm/saas-platform -f helm/saas-platform/values-prod.yaml
```

### k8s Raw Manifests
```bash
kubectl apply -f k8s/config/namespace.yaml
kubectl apply -f k8s/config/secrets.yaml
kubectl apply -f k8s/config/configmap.yaml
kubectl apply -f k8s/config/network-policy.yaml
kubectl apply -f k8s/infra/
kubectl apply -f k8s/services/microservices.yaml
kubectl apply -f k8s/portal/portal.yaml
```

---

## 알려진 제한 사항

1. PostgreSQL 개발 환경에서 emptyDir 사용 (프로덕션은 PVC 사용)
2. Harbor 레지스트리 연동은 별도 설정 필요
3. Sealed Secrets / Vault 연동은 운영 환경 구축 시 적용

---

## 문서

- [프로덕션 배포 체크리스트](/docs/deployment/production-checklist.md)
- [API 라우트 문서](/docs/api-routes.md)
- [k8s 배포 가이드](/k8s/README.md)
- [CSAP 준수 가이드](/docs/framework/02-csap/)
- [N2SF 가이드](/docs/framework/03-n2sf/)
