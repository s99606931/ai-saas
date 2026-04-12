# 장애 관리 FAQ — 사고 발생부터 종결, CSAP D-06 보고까지

> **문서 ID**: ONBOARD-FAQ-09
> **버전**: 1.0.0 | **작성일**: 2026-04-13 | **작성자**: Implementer (Sonnet)
> **목적**: 장애 발생 시 신규 팀원도 즉시 행동할 수 있도록 Q&A 형식으로 안내
> **선행 학습**: `08-ai-security-faq.md` → 본 문서 → `09-troubleshooting/` 시리즈

---

## 목차

1. [FAQ 섹션 구성 및 빠른 답변 TOP 5](#1-faq-섹션-구성-및-빠른-답변-top-5)
2. [초기 대응 FAQ](#2-초기-대응-faq)
3. [디버깅 및 진단 FAQ](#3-디버깅-및-진단-faq)
4. [CSAP D-06 보고 FAQ](#4-csap-d-06-보고-faq)
5. [사후 처리 FAQ](#5-사후-처리-faq)
6. [장애 대응 흐름도](#6-장애-대응-흐름도)
7. [변경 이력](#변경-이력)

---

## 1. FAQ 섹션 구성 및 빠른 답변 TOP 5

### 1.1 전체 FAQ 구성

| 섹션 | 질문 범위 | 질문 수 | 대상 독자 |
|------|---------|--------|---------|
| 2장: 초기 대응 | 사고 발생 ~ 에스컬레이션 | Q1~Q10 | 모든 팀원 |
| 3장: 디버깅 진단 | 원인 분석 ~ 복구 | Q11~Q20 | 개발자/SRE |
| 4장: CSAP D-06 보고 | 보고 의무 ~ 절차 | Q21~Q25 | 개발자/PM/관리자 |
| 5장: 사후 처리 | Post-Mortem ~ 보존 | Q26~Q30 | 모든 팀원 |

### 1.2 빠른 답변 TOP 5 (긴급 상황에서 바로 보기)

**TOP 1: 지금 당장 해야 할 3가지**

```
1. Slack #incidents 채널 생성: /incident P{1~3}-{서비스명}-{날짜}
2. Incident Commander 지정 (먼저 나선 사람이 IC)
3. 상태 페이지 업데이트: "조사 중 (INVESTIGATING)"
```

**TOP 2: P1 판단 기준**

```
다음 중 하나라도 해당하면 P1:
  - 모든 테넌트에 영향 (서비스 전면 중단)
  - 개인정보/공문서 데이터 유출 가능성
  - 50% 이상 요청 실패 > 10분 지속
  - 복구 예상 시간 > 30분
```

**TOP 3: 잘못된 배포 즉시 롤백 명령**

```bash
# Flux GitOps 롤백 (권장)
flux suspend kustomization {서비스명}
git revert HEAD && git push origin main

# 또는 이전 이미지 직접 지정
kubectl set image deployment/{서비스명} app={이전이미지}:{이전태그} -n production
```

**TOP 4: CSAP D-06 보고 기한**

```
개인정보 침해 사고: 72시간 이내 (인지 시점부터 계산)
일반 서비스 장애: 사후 5영업일 이내 Post-Mortem 제출
```

**TOP 5: Grafana에서 원인 찾는 최단 경로**

```
Grafana 홈 → Dashboards → SLO Overview
  → 에러율 급증 패널 클릭
  → 해당 시간대 로그로 이동 (Explore)
  → "error" 키워드 필터
  → 스택 트레이스 확인
```

---

## 2. 초기 대응 FAQ

### Q1. 서비스가 다운됐는데 어떻게 확인하나요?

서비스 상태를 빠르게 확인하는 우선순위 순서가 있습니다.

**1단계: 외부 모니터링 확인 (가장 빠름)**

```bash
# 상태 페이지 확인
curl https://status.내부주소.kr

# 주요 서비스 헬스체크 일괄 확인
for svc in auth-service tenant-service ai-service compliance-service; do
  echo -n "$svc: "
  curl -s --max-time 5 http://localhost:{포트}/health | jq -r '.status // "TIMEOUT"'
done
```

**2단계: Grafana SLO 대시보드 확인**

```
Grafana URL: http://grafana.내부주소
경로: Dashboards → Production → SLO Overview

확인 패널:
  - 가용성 (목표: 99.9%)
  - 에러율 (목표: < 0.1%)
  - 응답 시간 P99 (목표: < 500ms)
  - 요청 처리량 (현재 vs 정상 baseline)
```

**3단계: Kubernetes Pod 상태 확인**

```bash
# 전체 서비스 Pod 상태 확인
kubectl get pods -n production

# 재시작 횟수가 많은 Pod 필터링
kubectl get pods -n production | awk '$4 > 5 {print $0}'

# 특정 서비스 상태 상세 확인
kubectl describe pod {pod-name} -n production
kubectl logs {pod-name} -n production --tail=100
```

**4단계: PagerDuty 알림 확인**

```
PagerDuty URL: https://내부주소.pagerduty.com
- 활성 인시던트 목록 확인
- 이미 누군가 대응 중인지 확인 (중복 대응 방지)
```

---

### Q2. P1 사고로 판단하는 기준은?

사고 심각도는 영향 범위와 지속 시간, 데이터 노출 여부로 판단합니다.

**심각도 분류표**

| 심각도 | 정의 | 판단 기준 | 목표 복구 시간 |
|--------|------|---------|------------|
| P1 (긴급) | 서비스 전면 중단 or 데이터 침해 | 아래 P1 기준 참조 | 30분 이내 |
| P2 (높음) | 특정 기능 중단 or 일부 테넌트 영향 | 아래 P2 기준 참조 | 2시간 이내 |
| P3 (보통) | 성능 저하 or 비핵심 기능 장애 | 아래 P3 기준 참조 | 8시간 이내 |
| P4 (낮음) | 경미한 오류 or 사용성 문제 | 기타 모든 경우 | 다음 배포 시 |

**P1 판단 기준 (하나라도 해당 시 P1)**

```
- 전체 테넌트 서비스 이용 불가 (모든 요청 5xx)
- 개인정보 또는 공문서 데이터 무단 노출 가능성
- 인증 시스템 전체 장애 (로그인 불가)
- 요청 실패율 50% 초과 + 10분 이상 지속
- 다수 테넌트(5개 이상)에서 동시 장애 신고
- 데이터 손실 또는 무결성 손상 확인
```

**P2 판단 기준**

```
- 특정 기능(AI, 파일 업로드 등) 1개 이상 중단
- 1~4개 테넌트만 영향
- 응답 시간 P99 > 5초 (기준의 10배)
- 요청 실패율 10~50%
- 배포 직후 회귀 버그 (rollback으로 즉시 해결 가능)
```

**P3 판단 기준**

```
- 비핵심 기능 장애 (알림, 리포트 등)
- 응답 시간 P99 > 1초 (기준 초과)
- 간헐적 오류 (실패율 < 10%)
- 특정 브라우저/환경에서만 발생
```

---

### Q3. 누구에게 즉시 연락해야 하나요? (연락 체계)

**P1 연락 체계 (발생 후 5분 이내)**

```
1. Slack #incidents 채널에 즉시 메시지
   "/incident-create P1 {서비스명} {간략한 증상}"

2. Incident Commander 지정
   → 먼저 "#incidents에서 "IC는 제가 하겠습니다" 선언한 사람

3. On-Call 엔지니어 호출 (PagerDuty가 자동 호출)
   → 응답 없으면 10분 후 에스컬레이션 자동 실행

4. 서비스 책임자(TL)에게 직접 메시지
   → 새벽/주말도 P1은 즉시 연락

5. 영향받는 테넌트 수 > 10개이면 PM도 알림
   → 고객 커뮤니케이션 준비
```

**역할별 연락처 (실제 연락처는 팀 위키 참조)**

| 역할 | 역할 설명 | 연락 방법 | 언제 연락 |
|------|---------|---------|---------|
| Incident Commander | 사고 총괄 지휘 | Slack @mention | 즉시 |
| On-Call Engineer | 기술 대응 최일선 | PagerDuty | 즉시 |
| Service TL | 서비스 책임자 | Slack DM + 전화 | P1 즉시, P2 15분 내 |
| PM | 고객 커뮤니케이션 | Slack DM | P1 즉시, P2 30분 내 |
| CISO | 보안 침해 시 | 전화 필수 | 데이터 침해 의심 즉시 |

---

### Q4. Incident Commander는 어떻게 지정하나요?

Incident Commander(IC)는 사고 대응을 지휘하는 역할입니다. 기술적 해결보다는 조율과 소통에 집중합니다.

**IC 지정 원칙**

```
1. 자동 규칙: PagerDuty On-Call 엔지니어가 기본 IC
2. 현장 규칙: #incidents에서 먼저 "IC 맡겠습니다" 선언한 사람
3. 예외 규칙: P1이면 TL이 IC를 수락하거나 다른 사람에게 위임
```

**IC의 핵심 책임 (기술 해결 X)**

```
- 30분마다 상태 업데이트 (Slack #incidents)
- 역할 분담 조율 (누가 뭘 할지 지정)
- 회의 진행 (모두가 뭘 해야 할지 알게)
- 고객 커뮤니케이션 승인
- 에스컬레이션 결정
- 사고 종결 선언
```

**IC가 되었을 때 첫 3분 행동**

```
1. "이 사고의 IC는 제가 맡겠습니다. 현재 파악 중." 공지
2. #incidents 채널 고정 메시지로 사고 요약 핀
3. 기술 담당자 지정: "홍길동님, DB 확인해주세요. 이순신님, 서버 로그 부탁합니다."
4. 타임라인 스레드 시작: 모든 발견사항을 시간순으로 기록
```

---

### Q5. 사고 중 Slack 채널 어디서 소통하나요?

**채널 구조**

| 채널 | 용도 | 진입 조건 |
|------|------|---------|
| #incidents | 모든 사고 공지 및 기본 소통 | 모든 팀원 상시 모니터링 |
| #incident-{날짜}-{서비스} | 특정 사고 전용 전쟁실 | IC가 생성, 관련자만 |
| #csap-alerts | CSAP/보안 관련 알림 | 보안 사고 발생 시 |
| #on-call | On-Call 엔지니어 소통 | On-Call 담당자만 |
| #status-updates | 테넌트 향 상태 업데이트 | PM/IC만 작성 |

**사고 중 소통 규칙**

```
DO:
  - 모든 발견사항을 타임라인에 기록 (시간 포함)
  - 가설을 사실과 명확히 구분
  - 불확실한 것은 "확인 중" 명시
  - 복구 완료 시 즉시 공지

DON'T:
  - 원인 분석을 사고 중에 하지 않기 (복구 먼저)
  - 책임 추궁 절대 금지 (Post-Mortem에서)
  - 개인 DM으로만 소통 (공유 필수)
  - 추측을 사실처럼 전달하지 않기
```

---

### Q6. 처음 30초 안에 해야 할 3가지는?

장애 발생 직후 30초가 대응의 질을 결정합니다.

```
[30초 행동 지침]

1. (0~10초) Slack #incidents 채널 열기
   → "/incident P{심각도} {서비스명}: {증상 한 줄}"
   → 예: "/incident P1 auth-service: 로그인 API 전체 5xx"

2. (10~20초) PagerDuty 알림 확인
   → 이미 누군가 대응 중인지 확인
   → On-Call이 응답 안 하면 에스컬레이션 버튼 클릭

3. (20~30초) 증상 첫 스냅샷 기록
   → Grafana 에러율 패널 스크린샷
   → 영향받는 서비스와 시간 기록
   → 타임라인 스레드 시작: "[HH:MM] 사고 인지. 증상: {증상}"
```

30초 안에 #incidents에 메시지가 없으면 다른 팀원이 중복으로 대응을 시작할 수 있습니다. 일단 알리고, 그 다음에 조사합니다.

---

### Q7. 사고를 확대(escalate)해야 할 시점은?

에스컬레이션은 더 많은 자원이나 더 높은 권한이 필요할 때 합니다.

**에스컬레이션 트리거**

| 조건 | 에스컬레이션 대상 | 방법 |
|------|---------------|------|
| 30분 경과 + 복구 못 함 (P1) | TL → CTO | Slack DM + 전화 |
| 1시간 경과 + 복구 못 함 (P1) | CTO → CEO | 전화 필수 |
| 데이터 침해 의심 | 즉시 CISO | 전화 필수 |
| 법적 의무 보고 기한 임박 | 법무팀 + CISO | 즉시 알림 |
| On-Call 응답 없음 (10분) | 백업 On-Call | PagerDuty 에스컬레이션 |
| 2시간 경과 (P2) | 팀 리드 | Slack DM |

**에스컬레이션 메시지 템플릿**

```
[에스컬레이션 요청]

서비스: {서비스명}
심각도: P{1~3}
발생 시각: {시각}
현재 경과: {경과 시간}

현재 상태:
  - 증상: {증상}
  - 영향: {영향받는 테넌트 수, 사용자 수}
  - 시도한 조치: {조치 목록}
  - 원인 가설: {가설 또는 "미확인"}

에스컬레이션 사유: {왜 에스컬레이션이 필요한가}
필요한 것: {자원/권한/결정}
```

---

### Q8. 잘못된 배포를 롤백하는 방법은?

배포 직후 장애가 발생했다면 즉시 롤백이 최우선입니다. 원인 분석은 나중에 합니다.

**Flux GitOps 롤백 (권장 방법)**

```bash
# 1. 현재 Flux Kustomization 일시 중단 (새 배포 방지)
flux suspend kustomization {서비스명}

# 2. 이전 커밋으로 revert
git log --oneline -5  # 이전 커밋 해시 확인
git revert {장애_커밋_해시}
git push origin main

# 3. Flux 동기화 (revert 반영)
flux resume kustomization {서비스명}
flux reconcile kustomization {서비스명} --with-source

# 4. 배포 상태 확인
kubectl rollout status deployment/{서비스명} -n production
```

**kubectl 직접 롤백 (긴급 시)**

```bash
# 현재 배포 이력 확인
kubectl rollout history deployment/{서비스명} -n production

# 이전 버전으로 즉시 롤백
kubectl rollout undo deployment/{서비스명} -n production

# 특정 revision으로 롤백
kubectl rollout undo deployment/{서비스명} --to-revision=3 -n production

# 롤백 성공 확인
kubectl rollout status deployment/{서비스명} -n production
# 출력: "deployment "auth-service" successfully rolled out"
```

**롤백 후 반드시 확인**

```bash
# 1. 헬스체크 통과 확인
curl http://localhost:3001/health

# 2. 에러율 정상화 확인 (Grafana)
# 에러율이 < 0.1%로 돌아왔는지 5분간 관찰

# 3. 주요 API 기능 검증 (스모크 테스트)
pnpm test:smoke --env=production
```

---

### Q9. 다운 중 테넌트에게 알려야 하나요?

예. 테넌트(공공기관 고객)에게 적절한 시점에 적절한 정보를 제공해야 합니다.

**고객 커뮤니케이션 타이밍**

| 경과 시간 | 조치 | 채널 | 담당자 |
|---------|------|------|-------|
| 즉시 | 상태 페이지 "조사 중" 업데이트 | 상태 페이지 | IC |
| 15분 | 영향 받는 테넌트 이메일 | 이메일 | PM |
| 30분 (P1) | 공문서 형식 사고 알림 발송 | 이메일 + 전화 | PM + TL |
| 복구 직후 | "서비스 정상화" 공지 | 상태 페이지 + 이메일 | IC + PM |

**고객 알림 메시지 예시**

```
제목: [공공기관 SaaS] 서비스 장애 안내 (2026-04-13 10:30)

안녕하세요.
{기관명} SaaS 서비스에서 2026-04-13 10:30부터
인증 서비스 장애가 발생하여 안내드립니다.

현황: 복구 작업 진행 중 (예상 복구: 11:30)
영향: 로그인 및 모든 서비스 이용 불가
원인: 조사 중

복구 즉시 추가 공지 드리겠습니다.
불편을 드려 대단히 죄송합니다.

※ 긴급 연락: support@기관주소.kr / 02-XXXX-XXXX
```

---

### Q10. 데이터 손실이 의심될 때 첫 조치는?

데이터 손실은 CSAP D-06 즉시 보고 대상이며, 개인정보라면 GDPR/개인정보보호법 72시간 보고 의무가 발생합니다.

**데이터 손실 의심 시 즉시 조치 (10분 이내)**

```
1. 해당 서비스 즉시 격리 (신규 쓰기 차단)
   kubectl scale deployment/{서비스명} --replicas=0 -n production
   ※ 주의: 이 조치는 TL 또는 IC 승인 후 실행

2. CISO에게 즉시 전화 연락
   → "데이터 손실/노출 의심 사고 발생"

3. DB 스냅샷 즉시 생성 (현재 상태 보존)
   # PostgreSQL 수동 백업
   pg_dump {DB명} > backup-$(date +%Y%m%d-%H%M%S).sql

4. 접근 로그 보존 (증거 보전)
   kubectl logs {pod-name} -n production > incident-logs-$(date +%Y%m%d).txt

5. 영향 범위 초기 평가
   - 어떤 테이블/데이터가 영향받았는가?
   - 몇 명의 사용자 데이터인가?
   - 외부 노출 가능성이 있는가?
```

데이터 손실 의심 시 **절대 하면 안 되는 것**:

```
- 증거 데이터 삭제 금지 (법적 문제)
- 원인 파악 전 DB 복구 시도 금지 (증거 훼손)
- 공개 채널에 피해 규모 추측 게재 금지 (투기적 발언)
```

---

## 3. 디버깅 및 진단 FAQ

### Q11. Grafana에서 장애 원인을 빠르게 찾는 방법은?

Grafana는 장애 원인 추적의 핵심 도구입니다. 올바른 순서로 탐색하면 5분 이내에 문제 영역을 특정할 수 있습니다.

**장애 원인 추적 5단계**

```
1단계: SLO Overview 대시보드 열기
  → http://grafana.내부주소/d/slo-overview
  → 에러율, 가용성, 응답시간 중 어느 것이 이상한지 확인

2단계: 이상 시작 시점 특정
  → 그래프에서 급격한 변화가 시작된 시각 메모
  → 배포 이벤트와 겹치는지 확인 (Annotations 표시)

3단계: 어느 서비스인지 특정
  → Service Map 대시보드: 서비스 간 의존성 + 에러 흐름
  → 에러가 downstream에서 upstream으로 전파되는 패턴 파악

4단계: 해당 서비스 상세 대시보드
  → 에러 코드별 분류 (5xx, 4xx)
  → 느린 쿼리, DB 연결 풀 고갈 여부

5단계: Logs로 이동 (Explore)
  → 해당 서비스, 해당 시간대
  → "error" + "level:error" 필터
  → 첫 번째 에러 스택 트레이스 분석
```

**자주 쓰는 Grafana PromQL 쿼리**

```promql
# 서비스별 에러율 (5분 평균)
sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
/
sum(rate(http_requests_total[5m])) by (service)

# P99 응답시간
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))

# 최근 5분간 서비스별 에러 수
sum(increase(http_requests_total{status=~"5.."}[5m])) by (service)
```

---

### Q12. 특정 테넌트만 영향받는 것 같을 때 어떻게 확인하나요?

공공기관 SaaS는 멀티테넌시이므로 한 테넌트 문제가 다른 테넌트에 영향을 주지 않아야 합니다. 테넌트별 격리 확인 방법입니다.

```bash
# 1. 특정 테넌트의 최근 에러 로그 조회
kubectl logs -l app=auth-service -n production --tail=200 | \
  grep '"tenantId":"{문제테넌트ID}"' | grep '"level":"error"'

# 2. 테넌트별 요청 수 비교 (Grafana에서)
# PromQL: sum(rate(http_requests_total[5m])) by (tenant_id)
# → 특정 테넌트만 요청이 없거나 에러가 많으면 테넌트별 문제

# 3. 테넌트 데이터 상태 확인 (DB)
# 직접 DB 접근 시 반드시 읽기 전용 (SELECT만) + TL 승인 필수
SELECT id, plan, status, created_at
FROM tenants
WHERE id = '{문제테넌트ID}';

# 4. 테넌트 설정 무결성 확인
# tenant-service API 통해 확인 (직접 DB 접근 최소화)
curl http://localhost:3002/tenants/{문제테넌트ID} \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**테넌트별 문제 vs 전체 문제 판단**

```
전체 문제 신호:
  - 모든 테넌트에서 동시에 에러 발생
  - 인프라 레이어 (DB, Redis, k8s) 이상

테넌트별 문제 신호:
  - 특정 테넌트만 에러, 나머지는 정상
  - 해당 테넌트 설정/데이터 이상
  - 테넌트별 rate limit 초과
```

---

### Q13. DB 연결이 갑자기 모두 끊겼을 때 원인은?

DB 연결 고갈(Connection Pool Exhaustion)은 흔한 장애 원인입니다.

```bash
# 1. 현재 연결 수 확인
kubectl exec -it {db-pod} -n production -- psql -U postgres -c "
SELECT count(*), state, wait_event_type, wait_event
FROM pg_stat_activity
GROUP BY state, wait_event_type, wait_event
ORDER BY count DESC;
"

# 2. 연결 한도 확인
kubectl exec -it {db-pod} -n production -- psql -U postgres -c "
SHOW max_connections;
SELECT count(*) FROM pg_stat_activity;
"
# max_connections - count(*) 이 0에 가까우면 연결 고갈

# 3. 오래된 idle 연결 강제 종료 (TL 승인 필수)
kubectl exec -it {db-pod} -n production -- psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '5 minutes'
  AND pid <> pg_backend_pid();
"
```

**연결 고갈 원인과 해결책**

| 원인 | 증상 | 해결책 |
|------|------|------|
| 커넥션 풀 크기 부족 | 요청 급증 시 연결 대기 | Prisma connectionLimit 증가 |
| 누수된 연결 | 점진적 연결 수 증가 | await prisma.$disconnect() 누락 코드 찾기 |
| 장시간 트랜잭션 | idle in transaction 상태 | 쿼리 타임아웃 설정 |
| 배포 중 연결 급증 | 배포 직후 스파이크 | graceful shutdown 설정 확인 |

---

### Q14. CPU/메모리 갑증가의 흔한 원인과 확인법은?

```bash
# 1. CPU 급증 Pod 특정
kubectl top pods -n production --sort-by=cpu | head -10

# 2. 메모리 급증 Pod 특정
kubectl top pods -n production --sort-by=memory | head -10

# 3. 특정 Pod의 프로세스 수준 확인
kubectl exec -it {pod-name} -n production -- top -b -n 1 | head -20

# 4. 최근 배포와의 상관관계 확인
kubectl rollout history deployment/{서비스명} -n production
```

**CPU 급증 흔한 원인**

| 원인 | 확인 방법 | 조치 |
|------|---------|------|
| 무한 루프 | CPU 100% + 요청 처리 없음 | 해당 Pod 재시작 |
| AI 임베딩 대량 요청 | ai-service CPU + tokensUsed 급증 | Rate Limiting 활성화 |
| BullMQ 큐 폭발 | Redis 메모리 + 큐 길이 확인 | 큐 일시 중단 |
| 메모리 누수 | 메모리 점진적 증가 + GC 빈번 | Pod 재시작 후 원인 조사 |

---

### Q15. BullMQ 큐가 막혔을 때 어떻게 하나요?

```bash
# BullMQ 큐 상태 확인 (Redis CLI)
kubectl exec -it {redis-pod} -n production -- redis-cli

# 큐 길이 확인
LLEN bull:{큐이름}:wait
LLEN bull:{큐이름}:active
LLEN bull:{큐이름}:failed

# 실패한 작업 목록 확인 (최근 10개)
# BullBoard UI: http://localhost:3000/admin/queues

# 실패한 작업 재시도 (프로그래밍 방식)
# 직접 코드에서 queue.retryJobs({count: 10}) 호출

# 큐 워커 상태 확인
kubectl logs -l app={서비스명} -n production --tail=50 | grep "bull\|queue\|job"
```

**큐 막힘 원인별 조치**

```
원인 1: 워커 프로세스 다운
  → kubectl rollout restart deployment/{서비스명} -n production

원인 2: 실패한 작업 재시도 무한 반복
  → 실패 임계값 확인: maxAttempts 설정
  → Dead Letter Queue로 이동

원인 3: Redis 메모리 부족
  → kubectl top pods | grep redis
  → Redis 메모리 증설 또는 오래된 키 삭제

원인 4: 작업 처리 시간 초과
  → job.opts.timeout 설정 확인
  → 작업 자체가 블로킹 I/O인지 확인
```

---

### Q16. AI API 호출이 실패하기 시작했을 때?

```bash
# 1. AI API 에러율 확인 (Grafana)
# Dashboard: AI Service → LLM API Error Rate

# 2. 최근 AI API 에러 로그
kubectl logs -l app=ai-service -n production --tail=100 | grep '"level":"error"'

# 3. 외부 AI API 상태 페이지 확인
# OpenAI: https://status.openai.com
# Anthropic: https://status.anthropic.com

# 4. Circuit Breaker 상태 확인
curl http://localhost:3003/health | jq '.circuitBreaker'

# 5. API 키 만료 여부 확인 (Vault)
vault kv get secret/production/ai-service | grep -i "api_key\|expires"
```

**AI API 실패 시 대응 트리**

```
에러 401/403: API 키 문제
  → Vault에서 새 키 조회 후 시크릿 업데이트
  → Pod 재시작 (새 환경 변수 로드)

에러 429: Rate Limit 초과
  → 요청 속도 줄이기 (백오프 설정)
  → 다른 모델 Fallback 활성화

에러 500/502: AI API 서버 장애
  → AI API 상태 페이지 확인
  → Fallback 모델로 전환
  → Circuit Breaker 수동 OPEN

타임아웃: 응답 지연
  → timeout 설정 확인 (기본 30초)
  → Fallback 먼저 활성화, 원인 나중에 조사
```

---

### Q17. 인증서 만료로 HTTPS가 안 될 때?

```bash
# 1. 인증서 만료일 확인
kubectl get certificate -n production
kubectl describe certificate {인증서명} -n production | grep "Not After"

# 2. cert-manager 자동 갱신 상태 확인
kubectl describe certificaterequest -n production | grep -A5 "Status:"

# 3. 수동 인증서 갱신 (긴급 시)
kubectl annotate certificate {인증서명} -n production \
  cert-manager.io/issue-temporary-certificate="true"

# 4. cert-manager 갱신 트리거
kubectl delete certificaterequest {certificaterequest명} -n production
# → cert-manager가 새 CertificateRequest 자동 생성

# 5. Ingress에 적용된 인증서 확인
kubectl describe ingress {ingress명} -n production | grep tls
```

**인증서 만료 방지 설정**

```
cert-manager 자동 갱신 설정: 만료 30일 전 자동 갱신
  → Certificate 리소스의 renewBefore: 720h 확인

Grafana 알림: 만료 60일 전 #csap-alerts 알림
  → 알림이 안 온다면 Grafana 알림 규칙 점검
```

---

### Q18. Flux GitOps sync가 실패하면?

```bash
# 1. Flux 상태 전체 확인
flux get all -n flux-system

# 2. 실패한 Kustomization 상세 확인
flux get kustomization {서비스명} -n flux-system
kubectl describe kustomization {서비스명} -n flux-system | grep -A10 "Status:"

# 3. Flux 로그 확인
kubectl logs -n flux-system -l app=kustomize-controller --tail=50

# 4. 수동 sync 시도
flux reconcile kustomization {서비스명} --with-source -n flux-system

# 5. Source (Git repo) 상태 확인
flux get sources git -n flux-system
flux reconcile source git {source명} -n flux-system
```

**Flux sync 실패 원인별 대응**

| 오류 메시지 | 원인 | 해결책 |
|---------|------|------|
| "no such file or directory" | Helm Chart 경로 오류 | values.yaml 경로 확인 |
| "connection refused" | Git 서버 접근 불가 | Gitea 상태 확인 |
| "validation error" | 쿠버네티스 매니페스트 오류 | kubectl apply --dry-run으로 검증 |
| "helm upgrade failed" | Helm 릴리스 충돌 | helm status {릴리스명} 확인 |

---

### Q19. Pod가 재시작 루프에 빠졌을 때?

```bash
# 1. 재시작 횟수 높은 Pod 확인
kubectl get pods -n production | awk '$4 > 3 {print $0}'

# 2. 크래시 원인 확인 (이전 컨테이너 로그)
kubectl logs {pod-name} -n production --previous

# 3. Pod 이벤트 확인 (OOMKilled, CrashLoopBackOff 등)
kubectl describe pod {pod-name} -n production | grep -A20 "Events:"

# 4. 리소스 한도 초과 여부 확인
kubectl describe pod {pod-name} -n production | grep -A5 "Limits:\|Requests:"
kubectl top pod {pod-name} -n production
```

**재시작 루프 원인별 해결**

```
OOMKilled (메모리 초과):
  → Deployment의 resources.limits.memory 증가
  → 메모리 누수 코드 확인 (V8 heap snapshot)

CrashLoopBackOff (애플리케이션 크래시):
  → --previous 로그에서 에러 스택 확인
  → 환경 변수 누락 여부 확인

ImagePullBackOff (이미지 없음):
  → 이미지 태그 존재 여부 확인
  → Private registry 인증 시크릿 확인

Liveness probe 실패:
  → /health 엔드포인트 응답 시간 확인
  → livenessProbe.timeoutSeconds 증가 검토
```

---

### Q20. 로그가 갑자기 안 보일 때?

```bash
# 1. 로그 수집기 상태 확인 (Fluentd/Loki)
kubectl get pods -n logging
kubectl logs -n logging -l app=fluentd --tail=20

# 2. Grafana Loki에서 직접 확인
# Explore → Log Browser → {namespace="production"} |= "error"

# 3. Pod에서 직접 로그 확인 (임시 방편)
kubectl logs {pod-name} -n production --tail=200

# 4. 로그 볼륨 확인 (디스크 풀로 로그 중단 가능)
kubectl exec -it {logging-pod} -n logging -- df -h

# 5. 로그 스트리밍 연결 테스트
kubectl logs -f {pod-name} -n production
```

---

## 4. CSAP D-06 보고 FAQ

### Q21. 어떤 사고를 CSAP에 보고해야 하나요?

CSAP D-06은 침해사고 관리 통제항목입니다. 모든 사고가 보고 대상은 아닙니다.

**CSAP D-06 보고 의무 사고 유형**

| 사고 유형 | 보고 의무 | 보고 기한 | 보고 기관 |
|---------|---------|---------|---------|
| 개인정보 유출 (모든 규모) | 필수 | 72시간 이내 | KISA + 개인정보위 |
| 공문서 무단 접근/유출 | 필수 | 72시간 이내 | KISA + 발주기관 |
| 랜섬웨어 피해 | 필수 | 즉시 + 24시간 이내 서면 | KISA |
| 서비스 전면 중단 > 1시간 (P1) | 필수 | 사후 5영업일 이내 | 발주기관 |
| 보안 취약점 악용 | 필수 | 즉시 (구두) + 24시간 이내 서면 | KISA |
| 일반 서비스 장애 < 30분 | 선택 | 월간 보고서에 포함 | 발주기관 |

**보고 불필요한 경우**

```
- 예정된 점검으로 인한 서비스 중단 (사전 공지 완료)
- 개발/스테이징 환경 장애 (운영 데이터 무관)
- 영향 없이 탐지 및 차단된 공격 시도
- 30분 미만 단순 서비스 불안정
```

---

### Q22. 72시간 보고 기한을 어떻게 계산하나요?

```
72시간 = 3일 (달력일, 영업일 아님)

계산 기준: "인지 시점"부터 계산

예시:
  사고 인지: 2026-04-13 (월) 14:00
  72시간 후: 2026-04-16 (목) 14:00

  사고 인지: 2026-04-12 (일) 23:00
  72시간 후: 2026-04-15 (수) 23:00
  ↑ 주말/공휴일 관계없이 72시간은 72시간
```

**타임라인 관리 실천법**

```bash
# 사고 인지 직후 즉시 기록 (법적 기한 계산을 위해)
echo "사고 인지: $(date '+%Y-%m-%d %H:%M:%S')" >> incident-timeline.txt
echo "보고 기한: $(date -d '+72 hours' '+%Y-%m-%d %H:%M:%S')" >> incident-timeline.txt

# Slack 타임라인 스레드에도 기록
# "[14:00] 사고 인지. CSAP 보고 기한: 2026-04-16 14:00"
```

**기한 내 중간 보고**

72시간 이내에 최종 보고서 작성이 어려운 경우, "초기 보고서"를 먼저 제출합니다.

```
초기 보고서 (6시간 이내): 사고 발생 사실, 초기 영향 범위, 현재 대응 상태
최종 보고서 (72시간 이내): 상세 원인 분석, 피해 범위, 조치 완료 내용, 재발 방지 계획
```

---

### Q23. 보고서에 꼭 포함해야 할 항목은?

CSAP D-06 보고서는 형식이 정해져 있습니다.

**CSAP 침해사고 보고서 필수 항목 (행안부 고시)**

```
1. 기본 정보
   - 사고 발생 일시 (인지 시점, 실제 발생 추정 시점)
   - 신고 기관 (회사명, 담당자, 연락처)
   - 서비스명 및 CSAP 인증 번호

2. 사고 개요
   - 사고 유형 (개인정보유출, 서비스장애, 보안침해 등)
   - 영향 범위 (테넌트 수, 사용자 수, 영향받은 데이터 종류)
   - 피해 규모 (정량적 수치)

3. 원인 분석
   - 직접 원인 (기술적 원인)
   - 근본 원인 (프로세스/운영 원인)
   - 공격 벡터 (외부 공격인 경우)

4. 대응 조치
   - 사고 인지부터 복구까지 타임라인
   - 취한 기술적 조치 목록
   - 향후 재발 방지 계획 (구체적 Action Item)

5. 증거 자료
   - 감사 로그 스냅샷 (.claude/audit.jsonl)
   - Grafana 그래프 스크린샷
   - kubectl/DB 쿼리 결과
```

**감사 로그 증거 추출 방법**

```bash
# 사고 시간대 감사 로그 추출 (예: 2026-04-13 14:00~15:00)
cat .claude/audit.jsonl | \
  jq 'select(.timestamp >= "2026-04-13T14:00:00" and .timestamp <= "2026-04-13T15:00:00")' \
  > incident-audit-log.json

# compliance-service에서 감사 이력 API 조회
curl http://localhost:3004/audit?from=2026-04-13T14:00:00Z&to=2026-04-13T15:00:00Z \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq . > audit-report.json
```

---

### Q24. 보고 후 후속 절차는?

```
보고 후 처리 절차:

1. KISA 접수 확인 (이메일 수신 확인)
   → 보고 접수 번호 기록

2. 후속 질의에 대응 (KISA에서 추가 자료 요청 가능)
   → 요청 후 48시간 이내 제출이 관례

3. 시정 조치 이행 확인
   → 보고서에 기재한 재발 방지 Action Item 이행
   → 이행 증거 문서화 (커밋 링크, 설정 변경 등)

4. 최종 종결 보고
   → 시정 조치 완료 후 KISA에 종결 보고
   → 발주기관에도 종결 보고

5. Post-Mortem 문서 보존
   → 최소 3년 보존 (CSAP 요건)
   → docs/incidents/{YYYY}/{날짜}-{서비스명}-pm.md 저장
```

---

### Q25. 보고 누락 시 패널티는?

```
개인정보 침해 보고 누락 (개인정보보호법 제34조):
  - 과태료: 최대 3천만 원
  - 형사처벌 가능 (2년 이하 징역 또는 2천만 원 이하 벌금)

CSAP 인증 관련:
  - 보고 의무 위반 시 CSAP 인증 취소 가능
  - 재인증 심사 시 감점 (이후 1년간 이력 반영)

공공기관 정보화사업 계약:
  - 보고 누락은 계약 위반으로 손해배상 책임 발생 가능
  - 사업 참여 제한 (행안부 입찰 자격 정지)
```

**누락 방지를 위한 체크 시스템**

```bash
# Grafana 알림 규칙: P1 사고 발생 시 자동으로 CSAP 보고 체크리스트 알림
# Slack #csap-alerts 채널에 자동 메시지:
# "P1 사고 발생. CSAP D-06 72시간 보고 기한: {시간}"

# 사고 타임라인에 보고 기한 자동 기록 (audit.jsonl)
# 매시간 체크: 기한 6시간 전 재알림
```

---

## 5. 사후 처리 FAQ

### Q26. Post-Mortem을 꼭 써야 하나요?

네, 필수입니다. 단, 모든 사고가 대상은 아닙니다.

**Post-Mortem 작성 기준**

| 사고 심각도 | Post-Mortem 의무 | 배포 게이트 |
|-----------|---------------|----------|
| P1 (긴급) | 필수 | 다음 배포 전 PM 완료 필수 |
| P2 (높음) | 필수 | 1주일 이내 완료 |
| P3 (보통) | 권장 | 선택적 |
| P4 (낮음) | 선택 | 선택적 |

**Post-Mortem의 목적**

Post-Mortem은 책임 추궁이 아닙니다. "Blameless Post-Mortem" 원칙:

```
- 사람을 비난하지 않습니다
- 시스템과 프로세스의 문제를 찾습니다
- 재발 방지를 위한 구체적 개선을 도출합니다
- 팀 전체가 배우는 기회입니다
```

---

### Q27. Post-Mortem 작성 기한은?

```
P1 사고: 사고 해결 후 2영업일 이내 초안, 3영업일 이내 최종본
P2 사고: 사고 해결 후 5영업일 이내 최종본

기한 초과 시:
  - 팀 리드에게 사유 보고 필수
  - CSAP D-06 감사 시 기한 준수 여부 확인됨
```

**Post-Mortem 파일 저장 경로**

```bash
# 파일 저장 경로
docs/incidents/{YYYY}/{YYYY-MM-DD}-{서비스명}-pm.md

# 예시
docs/incidents/2026/2026-04-13-auth-service-pm.md
```

**Post-Mortem 기본 템플릿**

```markdown
# Post-Mortem: {서비스명} {날짜} 장애

## 기본 정보
- 사고 ID: INC-{YYYY-MM-DD}-{번호}
- 발생 시각: {시각}
- 복구 시각: {시각}
- 심각도: P{1~4}
- 영향: {영향받은 테넌트 수}, {영향받은 사용자 수}

## 사고 요약 (3줄 이내)

## 타임라인
| 시각 | 이벤트 |
|------|------|
| HH:MM | 사고 인지 |
| HH:MM | 원인 특정 |
| HH:MM | 복구 완료 |

## 근본 원인 분석 (5-Why)
Why 1: 왜 서비스가 중단됐는가?
Why 2: 왜 그 오류가 발생했는가?
Why 3: 왜 그 상황이 만들어졌는가?
Why 4: 왜 사전에 탐지되지 않았는가?
Why 5: 왜 예방하지 못했는가?

## 재발 방지 Action Items
| 조치 | 담당자 | 기한 | 완료 여부 |
|------|------|------|---------|
| 코드 수정 | 홍길동 | 2026-04-17 | [ ] |
| 모니터링 추가 | 이순신 | 2026-04-20 | [ ] |

## 배운 점 (팀 전체 공유)

## 잘한 점 (칭찬)
```

---

### Q28. 재발 방지 Action Item 관리 방법은?

Action Item이 흐지부지 되면 같은 사고가 반복됩니다.

**Action Item 추적 방법**

```
1. GitHub Issues로 등록 (각 Action Item마다 별도 이슈)
   - 레이블: "incident-followup", "P1-followup" 등
   - 마일스톤: "Post-Mortem Actions"
   - 담당자(Assignee) 지정 필수

2. 주간 스탠드업에서 진행 상황 확인
   - #incidents 채널: 매주 월요일 Action Item 현황 공유

3. 기한 초과 시 에스컬레이션
   - 기한 초과 1일: Slack DM으로 알림
   - 기한 초과 3일: 팀 리드 알림

4. 완료 확인 방법
   - 코드 변경: PR 링크
   - 모니터링 추가: Grafana 대시보드 패널 링크
   - 프로세스 변경: 문서 업데이트 링크
```

---

### Q29. 사고가 DORA 지표에 미치는 영향은?

DORA(DevOps Research and Assessment) 4가지 지표 중 장애와 직접 관련된 것이 2개입니다.

**MTTR (Mean Time to Restore) — 서비스 복구 시간**

```
MTTR = 복구 시각 - 사고 인지 시각

목표 (Elite 수준): < 1시간
현재 목표: P1 < 30분, P2 < 2시간

영향:
  - MTTR이 증가하면 DORA 등급 하락
  - 월간 DORA 보고서에 반영
  - 장기적으로 SLO 달성률에 영향
```

**Change Failure Rate — 배포 후 장애 비율**

```
Change Failure Rate = 장애를 유발한 배포 수 / 전체 배포 수

목표 (Elite 수준): < 5%
현재 목표: < 10%

롤백이 필요한 배포는 Change Failure Rate를 증가시킴
```

**DORA 지표 확인 방법**

```bash
# dora-exporter 패키지에서 실시간 지표 확인
curl http://localhost:9090/metrics | grep dora

# Grafana DORA 대시보드
# URL: http://grafana.내부주소/d/dora-four-keys

# 주요 패널:
# - 배포 빈도 (Deployment Frequency)
# - 리드 타임 (Lead Time for Changes)
# - MTTR (Mean Time to Restore)
# - 변경 실패율 (Change Failure Rate)
```

---

### Q30. 사고 이력은 얼마나 보존하나요?

```
법적 보존 기간:
  - CSAP D-06 요건: 최소 1년 (감사 로그)
  - 개인정보보호법: 침해사고 기록 3년
  - 공공기관 정보화사업: 5년 (국가기록원 고시)

실제 보존 정책:
  - audit.jsonl: 1년 (자동 압축 보관)
  - Post-Mortem 문서: 5년 (docs/incidents/)
  - 사고 대응 채팅 로그 (Slack): 영구 (유료 플랜)
  - Grafana 메트릭: 13개월
  - 애플리케이션 로그 (Loki): 30일 + 아카이브 1년

삭제 정책:
  - 개인정보가 포함된 로그: 보존 기간 경과 시 자동 익명화
  - audit.jsonl: append-only (수정/삭제 불가 구조)
```

---

## 6. 장애 대응 흐름도

### 6.1 사고 대응 전체 플로우차트

```mermaid
flowchart TD
    A([사고 인지\n모니터링/사용자 신고]) --> B[Slack #incidents 알림\n+ 인지 시각 기록]
    B --> C[심각도 평가\nP1/P2/P3/P4]

    C -- P1 --> D[즉시 IC 지정\n전화/Slack 동시]
    C -- P2 --> E[IC 지정\nSlack]
    C -- P3/P4 --> F[당번 On-Call 대응]

    D --> G[사고 채널 개설\n#incident-날짜-서비스]
    E --> G

    G --> H[초기 진단 시작\nGrafana + 로그]
    F --> H

    H --> I{데이터 침해\n의심?}
    I -- "예" --> J[CISO 즉시 연락\nDB 격리\n증거 보전]
    I -- "아니오" --> K[원인 분석\n5-Why 시작]

    J --> K

    K --> L{원인 특정됨?}
    L -- "예" --> M[복구 조치\n롤백/핫픽스/설정변경]
    L -- "아니오 30분 경과" --> N[에스컬레이션\n상위 담당자 호출]
    N --> K

    M --> O[복구 확인\n헬스체크 + 에러율]
    O --> P{완전 복구?}
    P -- "아니오" --> M
    P -- "예" --> Q[사고 종결 선언\n#incidents 공지]

    Q --> R[상태 페이지 업데이트\n"서비스 정상화"]
    R --> S[테넌트 복구 알림]

    S --> T{CSAP D-06\n보고 대상?}
    T -- "예" --> U[72시간 이내 보고\nKISA + 발주기관]
    T -- "아니오" --> V[Post-Mortem 작성\n2~5영업일 이내]

    U --> V
    V --> W[Action Item 등록\nGitHub Issues]
    W --> X([종결])

    style A fill:#F44336,color:#fff
    style J fill:#FF5722,color:#fff
    style U fill:#FF9800,color:#fff
    style X fill:#4CAF50,color:#fff
```

### 6.2 CSAP D-06 72시간 보고 타임라인

```mermaid
gantt
    title CSAP D-06 보고 타임라인 (사고 인지 기준)
    dateFormat HH:mm
    axisFormat %H시간

    section 즉시 (0시간)
    사고 인지 + #incidents 알림              :milestone, m0, 00:00, 0m
    CISO 구두 보고 (침해 의심 시)            :a0, 00:00, 30m

    section 6시간 이내
    초기 보고서 작성 (사고 사실 + 현재 대응)  :a1, 00:00, 6h
    KISA 초기 신고 (구두 또는 온라인)         :milestone, m1, 06:00, 0m

    section 24시간 이내
    상세 원인 분석 완료                       :a2, 06:00, 18h
    피해 범위 정확한 집계                     :a3, 06:00, 18h
    중간 보고서 제출 (원인 + 피해 범위)       :milestone, m2, 24:00, 0m

    section 72시간 이내 (기한)
    재발 방지 계획 수립                       :a4, 24:00, 48h
    최종 보고서 작성 (전체 내용)              :a5, 24:00, 48h
    KISA 최종 서면 보고                       :crit, milestone, m3, 72:00, 0m

    section 72시간 이후 (후속)
    시정 조치 이행                            :a6, 72:00, 168h
    Post-Mortem 최종본 제출 (5영업일)         :milestone, m4, 120:00, 0m
    KISA 종결 보고                            :milestone, m5, 240:00, 0m
```

**72시간 타임라인 체크리스트**

```
T+0시간 (사고 인지):
  □ Slack #incidents 알림
  □ 인지 시각 공식 기록 (audit.jsonl + 타임라인 스레드)
  □ CISO 구두 보고 (침해 의심 시)
  □ 보고 기한 계산: 인지 시각 + 72시간 = ?

T+6시간:
  □ 초기 보고서 작성 완료 (사고 사실, 초기 영향, 현재 대응)
  □ KISA 초기 신고 (온라인: https://인터넷침해대응센터.kr)

T+24시간:
  □ 상세 원인 분석 완료
  □ 피해 범위 정확한 집계
  □ 중간 보고서 발주기관 제출

T+72시간 (마감):
  □ 최종 보고서 KISA 제출
  □ 발주기관 최종 보고

T+5영업일:
  □ Post-Mortem 최종본 완료
  □ Action Item 이행 계획 확정
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-13 | 최초 작성 — 장애 관리 FAQ 30문항, 다이어그램 2개 포함 | Implementer (Sonnet) |
