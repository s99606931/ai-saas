#!/usr/bin/env python3
"""
OpenSSF Scorecard SARIF → JSON 요약 변환
Design Ref: DS-N115.3
Plan SC: FR-N115.3, FR-N115.4
CSAP: D-05 공급망 보안
"""
import json
import sys
from pathlib import Path

# 항목별 보안 개선 제안 (FR-N115.4)
REMEDIATION_GUIDE = {
    "Branch-Protection": "main/stg 브랜치에 보호 규칙을 설정하세요: 최소 1명 리뷰 필수, 강제 푸시 금지, 상태 검사 필수",
    "Code-Review": "모든 PR에 최소 1명 이상의 코드 리뷰어를 지정하세요",
    "CI-Tests": "CI 파이프라인에 자동화된 테스트를 추가하세요 (단위, 통합, E2E)",
    "Dependency-Update-Tool": "Renovate Bot 또는 Dependabot을 설정하여 의존성 자동 업데이트를 활성화하세요",
    "Pinned-Dependencies": "CI 워크플로우의 Actions 버전을 SHA 해시로 고정하세요 (예: actions/checkout@SHA)",
    "Binary-Artifacts": "바이너리 파일을 리포지토리에서 제거하고 빌드 시 생성하세요",
    "Vulnerabilities": "알려진 취약점을 패치하세요. Trivy/Grype로 정기 스캔 권장",
    "SAST": "정적 분석 도구(SonarQube, Semgrep)를 CI에 통합하세요",
    "Signed-Releases": "Cosign으로 릴리스 아티팩트에 서명하세요",
    "Token-Permissions": "GitHub/Gitea Actions 토큰에 최소 권한을 설정하세요 (read-only 기본)",
    "Security-Policy": "SECURITY.md 파일을 추가하여 취약점 보고 절차를 안내하세요",
    "Dangerous-Workflow": "PR 이벤트에서 위험한 명령(eval, exec) 사용을 제거하세요",
    "Fuzzing": "퍼징 테스트(OSS-Fuzz 등)를 CI에 통합하세요",
    "License": "프로젝트에 명확한 라이선스 파일(LICENSE)을 추가하세요",
    "Maintained": "최근 90일 이내 커밋 활동을 유지하세요",
}


def parse_sarif(sarif_path: str) -> dict:
    """SARIF 파일을 파싱하여 JSON 요약을 생성합니다."""
    with open(sarif_path, "r") as f:
        sarif = json.load(f)

    checks = []
    total_score = 0.0
    check_count = 0

    for run in sarif.get("runs", []):
        for result in run.get("results", []):
            rule_id = result.get("ruleId", "")
            message = result.get("message", {}).get("text", "")
            level = result.get("level", "note")

            # 점수 추출 (메시지에서)
            score = 0
            if "score is " in message.lower():
                try:
                    score_str = message.lower().split("score is ")[1].split("/")[0].strip()
                    score = int(score_str)
                except (IndexError, ValueError):
                    score = 0

            check = {
                "name": rule_id,
                "score": score,
                "maxScore": 10,
                "reason": message,
                "level": level,
                "remediation": REMEDIATION_GUIDE.get(rule_id, "문서를 참조하세요"),
            }
            checks.append(check)
            total_score += score
            check_count += 1

    avg_score = round(total_score / max(check_count, 1), 1)

    summary = {
        "totalScore": avg_score,
        "maxScore": 10.0,
        "checkCount": check_count,
        "checks": checks,
        "passed": [c for c in checks if c["score"] >= 7],
        "warnings": [c for c in checks if 5 <= c["score"] < 7],
        "failed": [c for c in checks if c["score"] < 5],
    }

    return summary


def generate_pr_comment(summary: dict) -> str:
    """PR 코멘트 Markdown을 생성합니다."""
    lines = [
        "## OpenSSF Scorecard 결과",
        "",
        f"**총점: {summary['totalScore']}/{summary['maxScore']}**",
        "",
        "| 항목 | 점수 | 상태 |",
        "|------|------|------|",
    ]

    for check in sorted(summary["checks"], key=lambda c: c["score"]):
        status = "PASS" if check["score"] >= 7 else ("WARN" if check["score"] >= 5 else "FAIL")
        emoji = {"PASS": "O", "WARN": "!", "FAIL": "X"}[status]
        lines.append(f"| {check['name']} | {check['score']}/10 | {emoji} {status} |")

    if summary["failed"]:
        lines.extend(["", "### 개선 필요 항목", ""])
        for check in summary["failed"]:
            lines.append(f"- **{check['name']}** ({check['score']}/10): {check['remediation']}")

    lines.extend(["", "---", "_CSAP D-05 공급망 보안 자동 검증 (OpenSSF Scorecard CI)_"])

    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        # 설정 파일 기반 기본 출력 (SARIF 없을 때)
        default_summary = {
            "totalScore": 0,
            "maxScore": 10.0,
            "checkCount": 0,
            "checks": [],
            "passed": [],
            "warnings": [],
            "failed": [],
        }
        print(json.dumps(default_summary, indent=2))
        sys.exit(0)

    sarif_path = sys.argv[1]
    summary = parse_sarif(sarif_path)
    print(json.dumps(summary, indent=2, ensure_ascii=False))

    # PR 코멘트 파일 생성
    comment = generate_pr_comment(summary)
    comment_path = Path(sarif_path).parent / "scorecard-comment.md"
    comment_path.write_text(comment)
