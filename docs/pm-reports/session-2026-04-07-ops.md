# PM 세션 보고서 -- 2026-04-07 (운영 준비성)

## 세션 목표
프로덕션 운영 준비성 6개 영역 탐색 및 미비 항목 구현

## 탐색 결과

| 영역 | 상태 | 판정 |
|------|------|------|
| 1. Correlation ID (X-Request-ID) | 미구현 | 구현 완료 |
| 2. 모니터링 알림 규칙 | 미구현 | 구현 완료 |
| 3. 백업/복구 절차 | 미구현 | 구현 완료 |
| 4. Circuit Breaker | 미구현 | 구현 완료 |
| 5. 보안 심화 (JWT/쿠키/패스워드) | 이미 구현 | 현상 유지 |
| 6. 기타 운영 도구 (healthcheck.sh) | 이미 구현 | 현상 유지 |

## 구현 항목 상세

### 1. Correlation ID (X-Request-ID)
- **파일**: `platform/services/api-gateway/src/plugins/correlation-id.ts`
- **동작**: 인바운드 X-Request-ID 있으면 전파, 없으면 UUIDv4 생성
- **통합**: Fastify request.id 바인딩 (pino 자동 포함), 응답 헤더 포함
- **프록시 전파**: 동적 프록시 헤더에 x-request-id 추가
- **감사 로그**: AuditLogEntry에 requestId 필드 추가
- **CORS**: allowedHeaders + exposedHeaders에 X-Request-ID 추가
- **테스트**: 5건 PASS

### 2. Prometheus 알림 규칙 + Grafana 대시보드
- **파일**: `k8s/monitoring/prometheus-alerts.yaml`
- **알림 규칙 5개 그룹, 22개 규칙**:
  - saas-infra-alerts: CPU 80%/95%, 메모리 90%/95%
  - saas-http-alerts: 5xx > 5%, P95 응답 > 2s/5s
  - saas-availability-alerts: CrashLoop, NotReady, 레플리카 불일치
  - saas-security-alerts: 로그인 실패율, Rate Limit 초과
  - saas-infra-component-alerts: PostgreSQL/Redis 다운, 연결 풀, 디스크
- **파일**: `k8s/monitoring/grafana-dashboard.json`
- **대시보드 10개 패널**: 서비스 상태, CPU, 메모리, 요청 처리율, 5xx, 응답시간, 재시작, 로그인 실패, DB 연결, Rate Limit

### 3. DB 백업/복구 스크립트
- **파일**: `scripts/db-backup.sh` -- pg_dump + gzip + SHA-256 해시 + 보존 정책
- **파일**: `scripts/db-restore.sh` -- 무결성 검증 + 복원 + 테이블 수 검증
- **파일**: `k8s/infra/db-backup-cronjob.yaml` -- 매일 02:00 KST 자동 백업 CronJob + PVC
- **CSAP D-07**: 90일 보존, 감사 추적, 별도 볼륨 백업

### 4. Circuit Breaker
- **파일**: `platform/services/api-gateway/src/lib/circuit-breaker.ts`
- **3단계 상태 머신**: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
- **구성**: failureThreshold=5, resetTimeout=30s, requestTimeout=10s
- **통합**: 동적 프록시(플러그인) fetch 호출에 적용
- **OPEN 시**: 503 + retryAfterMs 응답
- **테스트**: 13건 PASS

## 이미 구현 확인 (현상 유지)

### 5. 보안 심화
- Refresh Token Rotation: 완비 (블랙리스트 + 1회용 교체)
- JWT RS256: 접근 15분, 갱신 7일 (CSAP D-08)
- 계정 잠금: 5회 실패 -> 30분 잠금 (CSAP D-08-06)
- 동시 세션 제한: 최대 3개 (CSAP D-08-04)
- Password Reset: 30분 만료 토큰, SHA-256 해시 저장, 1회 사용 폐기
- 쿠키 방식 아님: Bearer 토큰 SPA 패턴 (httpOnly 쿠키 불필요)

### 6. 기타 운영 도구
- `scripts/healthcheck.sh`: 15개 서비스 + 3개 인프라 + 포털 HTTP 헬스체크
- `scripts/build-all.sh`, `scripts/deploy-k8s.sh` 완비

## 테스트 결과
- 전체: 623개 PASS (이전 세션 대비 +18건)
- api-gateway: 46개 PASS (이전 28개 -> +18)
- 실패: 0건
- TypeScript 빌드: 오류 없음

## 전체 진행률
- MTU: 46/46 archived (100%)
- 테스트: 623+ PASS
- CSAP/N2SF: 100% 커버리지

## 신규 생성 파일
1. `platform/services/api-gateway/src/plugins/correlation-id.ts`
2. `platform/services/api-gateway/src/lib/circuit-breaker.ts`
3. `platform/services/api-gateway/tests/unit/correlation-id.test.ts`
4. `platform/services/api-gateway/tests/unit/circuit-breaker.test.ts`
5. `k8s/monitoring/prometheus-alerts.yaml`
6. `k8s/monitoring/grafana-dashboard.json`
7. `scripts/db-backup.sh`
8. `scripts/db-restore.sh`
9. `k8s/infra/db-backup-cronjob.yaml`

## 수정 파일
1. `platform/services/api-gateway/src/index.ts` -- correlationId 플러그인 등록 + CORS 헤더
2. `platform/services/api-gateway/src/routes/proxy.ts` -- Circuit Breaker + x-request-id 전파
3. `platform/services/api-gateway/src/plugins/audit-logger.ts` -- requestId 필드 추가
4. `CHANGELOG.md` -- 운영 준비성 항목 추가
