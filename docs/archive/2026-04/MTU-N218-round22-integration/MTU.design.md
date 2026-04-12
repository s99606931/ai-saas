# MTU-N218: Round 22 통합 점검 -- 설계 문서

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## 1. 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 단일 통합 대시보드 | 모든 18개 MTU 패널을 하나에 | 단순성 | 과밀, 로딩 느림 |
| B. 카테고리별 Row 그룹핑 | 영역별 Row로 분류 + 접기 | 정보 계층화, 드릴다운 | 중간 복잡도 |
| C. 네비게이션 허브만 | 링크/상태만 표시 | 가벼움 | 직접 데이터 미확인 |

**선택: B안 (Pragmatic Balance)** -- 5개 카테고리 Row로 18개 MTU 대시보드 상태 + 주요 메트릭 + 드릴다운 링크

## 2. 상세 설계

### 2.1 통합 대시보드 구조 (FR-N218.1)

```
Row 1: API/컨트롤플레인 (MTU-N200 API서버, N201 etcd, N202 CoreDNS)
Row 2: 노드 컴포넌트 (MTU-N203 Kubelet, N204 Scheduler, N205 Controller Manager)
Row 3: 리소스 관리 (MTU-N206 리소스최적화, N207 GC, N208 디스크I/O)
Row 4: 네트워크/안정성 (MTU-N209 네트워크, N210 OOM, N211 Init컨테이너)
Row 5: 보안/고급 (MTU-N212 이미지풀, N213 SA토큰, N214 Webhook, N215 CRD, N216 스케줄링, N217 네임스페이스)
```

각 Row 내 패널: Stat(상태) + TimeSeries(트렌드) + 드릴다운 링크

### 2.2 크로스 레퍼런스 Recording Rules (FR-N218.2)

```yaml
groups:
  - name: round22_cross_reference
    interval: 60s
    rules:
      - record: round22:controlplane:health_score
        # API서버 + etcd + CoreDNS 종합 건강도
      - record: round22:node:health_score
        # Kubelet + Scheduler + Controller Manager 종합
      - record: round22:resource:efficiency_score
        # 리소스 효율성 + GC + 디스크 종합
      - record: round22:stability:risk_score
        # OOM + Init + 이미지풀 + SA토큰 위험도 종합
```

### 2.3 통합 알림 라우팅 (FR-N218.3)

```yaml
route:
  group_by: ['round22_category']
  routes:
    - match: { category: 'controlplane' }
      receiver: 'ops-critical'
    - match: { category: 'node' }
      receiver: 'ops-high'
    - match: { category: 'resource' }
      receiver: 'ops-medium'
    - match: { category: 'security' }
      receiver: 'security-team'
```

### 2.4 검증 스크립트 (FR-N218.4)

- YAML 문법 검증 (yamllint)
- Recording Rule expr 내 참조 메트릭 존재 확인
- 대시보드 JSON 패널 ID 중복 검사
- 드릴다운 링크 대상 대시보드 존재 확인
- PromQL 문법 검증

## 3. Session Guide

| 단계 | 입력 | 출력 | 검증 |
|------|------|------|------|
| 1 | 기존 N200-N217 대시보드 목록 | 통합 대시보드 JSON | 패널 수, 링크 |
| 2 | 기존 Recording Rules | 크로스 레퍼런스 Rules | expr 참조 무결성 |
| 3 | Alertmanager 설정 | 통합 라우팅 | 라우팅 정합성 |
| 4 | 전체 산출물 | 검증 스크립트 + 실행 결과 | 통과율 100% |

## 4. Design Anchor

- Plan: FR-N218.1~N218.4
- CSAP: D-06 감사 모니터링
- N2SF: O등급 운영 데이터
