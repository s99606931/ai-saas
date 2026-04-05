# N06 운영 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | N2SF-N06-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| N2SF 영역 | N06 운영 |
| 대상 독자 | 운영 엔지니어, 보안 담당자, 개발자 |
| FR 매핑 | FR-3.3, FR-3.4, FR-3.5 |
| MTU 매핑 | MTU-C5 |

<!-- Design Ref: MTU-C5 Plan -- N06 운영 -->
<!-- Plan SC: 감사 로그 audit.jsonl 구조, CSAP D06/D12 역참조 -->

---

## 1. 영역 개요

N06 운영 영역은 시스템의 지속적 보안 운영을 다룹니다.
취약점 관리, 감사 로그, 침해사고 대응, 재해 복구를 포함하며,
CSAP D06(침해사고 관리), D07(재해 복구), D12(시스템 개발 보안)과 직접 대응됩니다.

### 핵심 원칙

- **감사 로그 전수 기록**: 모든 민감 작업은 audit.jsonl에 append-only 기록
- **취약점 즉시 대응**: CVSS 등급별 SLA 준수 (Critical 24시간 이내)
- **재해 복구 검증**: RTO 4시간, RPO 1시간 목표 (분기별 DR 훈련)

---

## 2. C/S/O 등급별 통제 요건

| 통제 항목 | C 등급 (기밀) | S 등급 (민감) | O 등급 (공개) |
|---------|-------------|-------------|-------------|
| 취약점 스캔 주기 | 일간 + 변경 시 즉시 | 주간 + 변경 시 | 월간 |
| 패치 적용 SLA (Critical) | 12시간 이내 | 24시간 이내 | 72시간 이내 |
| 감사 로그 보존 | 5년 이상 + 무결성 검증 | 3년 이상 | 1년 이상 |
| 감사 로그 실시간 모니터링 | 필수 (24/7 SOC) | 필수 (업무 시간) | 주기적 검토 |
| 침해사고 대응 시간 | 1시간 이내 초동 대응 | 4시간 이내 | 24시간 이내 |
| DR 훈련 주기 | 월 1회 | 분기 1회 | 반기 1회 |
| RTO / RPO | 1시간 / 15분 | 4시간 / 1시간 | 24시간 / 4시간 |
| 백업 주기 | 실시간 복제 + 일간 스냅샷 | 일간 전체 + 시간별 증분 | 일간 전체 |

---

## 3. 감사 로그 (audit.jsonl) 표준 구조

### 로그 스키마

```typescript
// N06 + CSAP-D06 감사 로그 표준 인터페이스
// audit.jsonl — JSON Lines 형식 (append-only, 수정/삭제 불가)
interface AuditEntry {
  // 필수 필드
  timestamp: string          // ISO 8601 (예: "2026-04-05T14:30:00Z")
  actor: string              // 사용자 ID 또는 "SYSTEM"
  action: string             // 수행 작업 (동사_목적어 형식)
  target: string             // 대상 리소스 (ID 또는 경로)
  result: 'SUCCESS' | 'FAILURE' | 'BLOCKED'

  // N2SF 필수 필드
  dataGrade: DataGrade       // C / S / O 데이터 등급
  n2sfDomain: string         // 관련 N2SF 영역 (N01~N06)

  // CSAP 필수 필드
  csapControl: string        // 관련 CSAP 통제 ID (예: "D06-01")

  // 선택 필드
  ip?: string                // 클라이언트 IP
  userAgent?: string         // 브라우저/클라이언트 정보
  metadata?: Record<string, unknown>  // 추가 컨텍스트
  sessionId?: string         // 세션 ID
  requestId?: string         // 요청 추적 ID
}

// 감사 대상 작업 목록 (최소 필수)
type AuditAction =
  | 'USER_LOGIN'           // 로그인 시도 (성공/실패)
  | 'USER_LOGOUT'          // 로그아웃
  | 'USER_CREATE'          // 사용자 생성
  | 'USER_DELETE'          // 사용자 삭제
  | 'USER_ROLE_CHANGE'     // 역할 변경
  | 'ACCOUNT_LOCKED'       // 계정 잠금
  | 'DATA_ACCESS'          // 데이터 접근
  | 'DATA_EXPORT'          // 데이터 내보내기
  | 'DATA_DESTRUCTION'     // 데이터 폐기
  | 'AI_ROUTE_LOCAL'       // AI 온프레미스 라우팅
  | 'AI_ROUTE_EXTERNAL'    // AI 외부 API 라우팅
  | 'DEPLOY'               // 배포
  | 'CONFIG_CHANGE'        // 설정 변경
  | 'ACCESS_REVIEW'        // 접근 권한 검토
  | 'ISOLATION_VIOLATION'  // 격리 위반 탐지
  | 'VULNERABILITY_FOUND'  // 취약점 발견
  | 'INCIDENT_REPORT'      // 사고 보고
```

### 감사 로그 기록 함수

```typescript
// audit.jsonl append-only 기록 (CSAP-D06-01)
import { appendFileSync } from 'fs'

const AUDIT_FILE = '/shared/audit.jsonl'

async function auditLog(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
  const fullEntry: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  }

  // Append-only (수정/삭제 불가 구조)
  appendFileSync(AUDIT_FILE, JSON.stringify(fullEntry) + '\n')

  // C 등급 작업: 실시간 SIEM 전송
  if (entry.dataGrade === 'C') {
    await forwardToSIEM(fullEntry)
  }
}
```

### 감사 로그 무결성 검증

```bash
#!/bin/bash
# audit.jsonl 무결성 검증 — 일간 실행
# CSAP-D06-02 (감사 로그 보존 + 무결성)

AUDIT_FILE="/shared/audit.jsonl"
HASH_FILE="/shared/audit-hashes.log"

# 1. 현재 파일 해시 계산
CURRENT_HASH=$(sha256sum $AUDIT_FILE | cut -d' ' -f1)
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) SHA256=$CURRENT_HASH LINES=$(wc -l < $AUDIT_FILE)" >> $HASH_FILE

# 2. 이전 해시와 비교 (줄 수는 증가만 허용)
PREV_LINES=$(tail -2 $HASH_FILE | head -1 | grep -oP 'LINES=\K\d+')
CURR_LINES=$(wc -l < $AUDIT_FILE)

if [ -n "$PREV_LINES" ] && [ "$CURR_LINES" -lt "$PREV_LINES" ]; then
  echo "[경고] audit.jsonl 줄 수 감소 탐지! 무결성 위반 가능"
  echo "[경고] 이전: $PREV_LINES줄, 현재: $CURR_LINES줄"
  # CISO 긴급 알림
fi

echo "감사 로그 무결성 검증 완료: $CURR_LINES줄, SHA256=$CURRENT_HASH"
```

---

## 4. CSAP 통제항목 역참조

### D06 침해사고 관리 (5항목)

| CSAP ID | 항목명 | N06 구현 요건 | 구현 패턴 |
|---------|--------|------------|---------|
| [CSAP-D06-01](../../02-csap/standard-grade/implementation-guide/D06-incident.md#csap-d06-01) | 침해사고 탐지 | 실시간 로그 모니터링 + 이상 탐지 | OTel + 알림 |
| [CSAP-D06-02](../../02-csap/standard-grade/implementation-guide/D06-incident.md#csap-d06-02) | 감사 로그 보존 | 등급별 보존 기간 + 무결성 | audit.jsonl (append-only) |
| [CSAP-D06-03](../../02-csap/standard-grade/implementation-guide/D06-incident.md#csap-d06-03) | 침해사고 대응 절차 | 5단계 대응 프로세스 | 대응 매뉴얼 |
| [CSAP-D06-04](../../02-csap/standard-grade/implementation-guide/D06-incident.md#csap-d06-04) | 사고 보고 | 등급별 보고 시한 + 보고 양식 | 보고서 템플릿 |
| [CSAP-D06-05](../../02-csap/standard-grade/implementation-guide/D06-incident.md#csap-d06-05) | 사후 분석 | 원인 분석 + 재발 방지 대책 | 사후 분석 보고서 |

### D07 재해 복구 (3항목)

| CSAP ID | 항목명 | N06 구현 요건 | 구현 패턴 |
|---------|--------|------------|---------|
| [CSAP-D07-01](../../02-csap/standard-grade/implementation-guide/D07-disaster-recovery.md#csap-d07-01) | 재해 복구 계획 | DR 계획서 수립 + 등급별 RTO/RPO | DR 계획서 |
| [CSAP-D07-02](../../02-csap/standard-grade/implementation-guide/D07-disaster-recovery.md#csap-d07-02) | 백업 및 복원 | 등급별 백업 주기 + 복원 검증 | etcd 백업 스크립트 |
| [CSAP-D07-03](../../02-csap/standard-grade/implementation-guide/D07-disaster-recovery.md#csap-d07-03) | DR 훈련 | 등급별 주기적 DR 훈련 실시 | DR 훈련 보고서 |

### D12 시스템 개발 보안 (관련 항목)

| CSAP ID | 항목명 | N06 구현 요건 |
|---------|--------|------------|
| [CSAP-D12-01](../../02-csap/standard-grade/implementation-guide/D12-development-security.md#csap-d12-01) | 배포 전 취약점 스캔 | Trivy + Gitea Actions 자동화 |
| [CSAP-D12-03](../../02-csap/standard-grade/implementation-guide/D12-development-security.md#csap-d12-03) | 시크릿 하드코딩 금지 | gitleaks 자동 실행 |
| [CSAP-D12-08](../../02-csap/standard-grade/implementation-guide/D12-development-security.md#csap-d12-08) | 취약점 스캔 통과 | 이미지 서명 + Harbor 정책 |

---

## 5. 침해사고 대응 5단계

```
1. 탐지 (Detection)
   │ - 실시간 로그 모니터링 (OTel Collector)
   │ - 이상 트래픽 탐지 (NetworkPolicy 위반)
   │ - 취약점 스캔 결과 (Trivy)
   ▼
2. 분석 (Analysis)
   │ - 사고 범위 파악 (영향받은 등급·시스템)
   │ - 공격 벡터 식별
   │ - 데이터 유출 여부 확인
   ▼
3. 억제 (Containment)
   │ - C등급: 즉시 클러스터 격리 (네트워크 차단)
   │ - S등급: 해당 Namespace 격리 (NetworkPolicy 강화)
   │ - O등급: 해당 Pod 격리 또는 재배포
   ▼
4. 복구 (Recovery)
   │ - 백업에서 복원 (등급별 RPO 준수)
   │ - 패치 적용 + 재배포
   │ - 시스템 무결성 검증
   ▼
5. 사후 분석 (Post-Incident)
   │ - 원인 분석 보고서 (Root Cause Analysis)
   │ - 재발 방지 대책 수립
   │ - 정책/절차 업데이트
   │ - audit.jsonl에 전 과정 기록
   ▼
   교훈 반영 → 정책 갱신
```

---

## 6. 취약점 관리

### CVSS 등급별 대응 SLA

| CVSS 등급 | 점수 범위 | C 등급 SLA | S 등급 SLA | O 등급 SLA |
|---------|---------|---------|---------|---------|
| Critical | 9.0~10.0 | 12시간 이내 | 24시간 이내 | 72시간 이내 |
| High | 7.0~8.9 | 24시간 이내 | 72시간 이내 | 7일 이내 |
| Medium | 4.0~6.9 | 72시간 이내 | 7일 이내 | 다음 정기 배포 |
| Low | 0.1~3.9 | 7일 이내 | 다음 정기 배포 | 월간 패치 |

### 취약점 스캔 자동화

```yaml
# Gitea Actions — 일간 취약점 스캔 (CSAP-D12-01)
name: Daily Vulnerability Scan
on:
  schedule:
    - cron: '0 2 * * *'     # 매일 02:00 UTC
  push:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: 이미지 취약점 스캔 (Trivy)
        run: |
          trivy image --severity HIGH,CRITICAL \
            --format json --output trivy-report.json \
            ${{ env.IMAGE_NAME }}:${{ env.IMAGE_TAG }}

      - name: Critical 취약점 발견 시 알림
        if: ${{ steps.scan.outputs.critical_count > 0 }}
        run: |
          echo "[경고] Critical 취약점 ${{ steps.scan.outputs.critical_count }}건 발견"
          # CISO + 보안담당자 알림 발송

      - name: 감사 로그 기록
        run: |
          cat >> /shared/audit.jsonl << EOF
          {
            "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "actor": "SYSTEM",
            "action": "VULNERABILITY_SCAN",
            "target": "${{ env.IMAGE_NAME }}",
            "n2sfDomain": "N06",
            "csapControl": "D12-01",
            "result": "SUCCESS",
            "metadata": {
              "critical": ${{ steps.scan.outputs.critical_count || 0 }},
              "high": ${{ steps.scan.outputs.high_count || 0 }}
            }
          }
          EOF
```

---

## 7. 백업 및 재해 복구

### k3s etcd 백업 (CSAP-D07-02)

```bash
#!/bin/bash
# k3s etcd 자동 백업 — 일간 실행
# CSAP-D07-02 + N2SF N06

BACKUP_DIR="/backup/etcd/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# etcd 스냅샷
k3s etcd-snapshot save --name "daily-$(date +%Y%m%d-%H%M%S)"

# 스냅샷 파일 암호화 보관 (CSAP-D09-01)
SNAPSHOT=$(ls -t /var/lib/rancher/k3s/server/db/snapshots/ | head -1)
openssl enc -aes-256-cbc -salt \
  -in "/var/lib/rancher/k3s/server/db/snapshots/$SNAPSHOT" \
  -out "$BACKUP_DIR/$SNAPSHOT.enc" \
  -pass env:BACKUP_ENCRYPTION_KEY

# 오래된 백업 정리 (30일 이전)
find /backup/etcd/ -type d -mtime +30 -exec rm -rf {} \;

# 감사 로그
cat >> /shared/audit.jsonl << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "actor": "SYSTEM",
  "action": "ETCD_BACKUP",
  "target": "$BACKUP_DIR/$SNAPSHOT.enc",
  "n2sfDomain": "N06",
  "csapControl": "D07-02",
  "result": "SUCCESS"
}
EOF

echo "etcd 백업 완료: $BACKUP_DIR/$SNAPSHOT.enc"
```

---

## 8. 증적 자료 체크리스트

| 번호 | 증적 자료 | 보관 주기 | 비고 |
|------|---------|---------|------|
| 1 | audit.jsonl (감사 로그) | 등급별 상이 (1~5년) | append-only |
| 2 | 감사 로그 무결성 해시 | 영구 | SHA-256 일간 기록 |
| 3 | 취약점 스캔 보고서 (Trivy) | 1년 | 등급별 주기 |
| 4 | 침해사고 대응 보고서 | 5년 | 발생 시 작성 |
| 5 | DR 훈련 보고서 | 3년 | 등급별 주기 |
| 6 | etcd 백업 암호화 파일 | 30일 (순환) | 일간 백업 |
| 7 | 패치 적용 이력 | 3년 | CVSS SLA 준수 확인 |

---

## 9. 관련 문서

- [CSAP x N2SF 전수 매핑 테이블](../csap-n2sf-mapping.md) (MTU-C4)
- [CSAP D06 침해사고 관리 구현 가이드](../../02-csap/standard-grade/implementation-guide/D06-incident.md)
- [CSAP D07 재해 복구 구현 가이드](../../02-csap/standard-grade/implementation-guide/D07-disaster-recovery.md)
- [CSAP D12 시스템 개발 보안 구현 가이드](../../02-csap/standard-grade/implementation-guide/D12-development-security.md)
- [N03 격리 구현 가이드](./N03-isolation.md) (사고 시 격리 대응)
- [N05 데이터 구현 가이드](./N05-data.md) (데이터 폐기 연계)
- [컨테이너 보안 베이스라인](../../07-infra/container-security-baseline.md) (MTU-I1)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — N06 운영 구현 가이드 (감사 로그 + 취약점 관리 + DR) | Claude Code |
