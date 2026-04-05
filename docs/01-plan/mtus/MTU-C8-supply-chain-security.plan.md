# MTU-C8: Supply Chain Security [신규]

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C8 |
| Phase | Phase 2/3 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-10.1, FR-10.2 (신규) |
| 의존 MTU | MTU-I2 (Gitea CI/CD) |
| 예상 세션 | 1 세션 |
| 중요도 | P1 |

---

## 목적

소프트웨어 공급망 보안을 SBOM + Sigstore(Cosign)로 구현합니다.

**시장조사 근거**:
- EU Cyber Resilience Act(CRA): 중견 기업 이상 SBOM 의무화
- SLSA 1.0 표준 확정 (2025), Sigstore 표준화 완성
- CSAP-D05 (서비스 공급망 관리) 4항목 자동화 가능
- 2026년 CVE 공개 수 23,667개 (전년 대비 16% ↑) → 의존성 추적 필수

---

## 산출물 파일 (2개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `05-infra/supply-chain/sbom-guide.md` | 구현 가이드형 | Syft/Trivy SBOM 생성, SPDX 포맷 |
| `05-infra/supply-chain/sigstore-signing.md` | 구현 가이드형 | Cosign 이미지 서명, Fulcio/Rekor |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-10.1 | SBOM 자동 생성 | Gitea Actions에서 빌드 시 SBOM 자동 생성 |
| FR-10.2 | 이미지 서명 검증 | Cosign으로 서명되지 않은 이미지 배포 차단 |

---

## CSAP-D05 항목별 매핑

| CSAP 항목 | 요건 내용 | 구현 방법 | 산출물 |
|---------|---------|---------|------|
| CSAP-D05-01 | 공급업체 보안 계약 | 계약서 보안 부속서 템플릿 | `D05-supply-chain.md` §1 |
| CSAP-D05-02 | 공급망 위험 평가 | SBOM 분석 + Trivy 취약점 스캔 | `sbom-guide.md` §3 |
| CSAP-D05-03 | 소프트웨어 무결성 검증 | Cosign 서명 + Rekor 투명성 로그 | `sigstore-signing.md` §2 |
| CSAP-D05-04 | 공급업체 보안 변경 알림 | CVE 알림 채널 + 패치 SLA 정의 | `sbom-guide.md` §4 |

---

## CVE 대응 프로세스

```
CVE 공개
  → Trivy 자동 스캔 (Gitea Actions: 일간)
  → CVSS 7.0+ Critical: 24시간 이내 패치 적용
  → CVSS 4.0~6.9 High: 7일 이내 패치 적용
  → CVSS 4.0 미만: 다음 정기 배포 시 반영
  → 패치 후 SBOM 재생성 + 이미지 재서명
  → audit.jsonl에 CVE-ID + 조치 일시 기록
```

| CVSS 등급 | 조치 기한 | 알림 채널 |
|---------|---------|---------|
| Critical (9.0+) | 24시간 | 즉시 보안담당자 + CISO |
| High (7.0~8.9) | 72시간 | 보안담당자 |
| Medium (4.0~6.9) | 7일 | 개발팀 주간 보고 |
| Low (0.1~3.9) | 다음 배포 | 월간 패치 노트 |

---

## 오픈소스 라이선스 준수

```bash
# 라이선스 검사 — SBOM에서 GPL 계열 라이선스 탐지
syft <image> -o spdx-json | jq '.packages[].licenseConcluded' | sort -u

# 금지 라이선스 목록 (공공기관 프로젝트 기준)
# GPL-3.0: 소스 공개 의무 → 상용 배포 시 법적 위험
# AGPL-3.0: 네트워크 서비스 포함 소스 공개 의무
# SSPL-1.0: MongoDB 계열, 서비스 전체 소스 공개
```

| 라이선스 유형 | 공공 SaaS 사용 가능 여부 | 비고 |
|------------|---------------------|------|
| MIT, Apache-2.0, BSD | ✅ 허용 | 귀속 표시 필수 |
| LGPL-2.1, LGPL-3.0 | ⚠️ 조건부 허용 | 동적 링크만, 수정 시 공개 |
| GPL-2.0, GPL-3.0 | ❌ 금지 (원칙) | 법무 검토 필요 |
| AGPL-3.0, SSPL-1.0 | ❌ 금지 | 공공 SaaS 배포 불가 |

---

## 합격 기준

1. `syft <image> -o spdx-json` 실행으로 SBOM JSON 생성 성공
2. SBOM에 모든 직접/간접 의존성 포함
3. `cosign sign` + `cosign verify` 명령으로 이미지 서명/검증 성공
4. Gitea Actions 파이프라인에 SBOM 생성 + 이미지 서명 단계 포함
5. CSAP-D05-01~04 항목별 매핑 완비 (항목별 구현 방법 명시)
6. CVE 대응 프로세스 및 CVSS 등급별 조치 기한 명시
7. 금지 라이선스 목록 및 자동 탐지 방법 포함

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — 시장조사 반영 신규 MTU | Claude Code |
| 0.2.0 | 2026-04-05 | P1: CSAP-D05 항목별(D05-01~04) 구현 매핑 테이블 추가, CVE 대응 프로세스(CVSS 등급별 SLA) 추가, 오픈소스 라이선스 준수 섹션 추가, 합격 기준 3개 항목 보강 | Claude Code |
