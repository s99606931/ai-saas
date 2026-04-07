#!/usr/bin/env node
// Dead Code 감사 스크립트
// Design Ref: CLAUDE.md 4 (Dead Code 정책)
// Plan SC: deadcode-policy.md
//
// 사용법: node scripts/audit-dead-code.mjs
//
// TypeScript/JavaScript 코드베이스에서 미사용 export를 탐지합니다.
// 외부 도구(ts-prune, depcheck) 없이 간단한 정적 분석을 수행합니다.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';

const PROJECT_ROOT = new URL('..', import.meta.url).pathname;
const PLATFORM_DIR = join(PROJECT_ROOT, 'platform');

// 검사 대상 디렉토리
const SCAN_DIRS = [
  'platform/services',
  'platform/packages',
  'platform/plugins',
];

// 제외 패턴
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  '.next',
  'tests',
  'test',
  '__tests__',
  'fixtures',
  'migrations',
];

// 감사 결과
let totalFiles = 0;
let unusedImportsFound = 0;
let commentedCodeFound = 0;
let oldTodosFound = 0;
const issues = [];

/**
 * 디렉토리 재귀 탐색
 */
function walkDir(dir, callback) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (EXCLUDE_PATTERNS.some((p) => entry === p || entry.startsWith('.'))) continue;

    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry)) {
      callback(fullPath);
    }
  }
}

/**
 * 주석 처리된 코드 블록 탐지
 */
function checkCommentedCode(filePath, content) {
  const lines = content.split('\n');
  let commentBlock = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // 여러 줄 연속 주석 = 주석 처리된 코드 가능성
    if (line.startsWith('//') && /[{};=()]/.test(line)) {
      commentBlock++;
    } else {
      if (commentBlock >= 3) {
        issues.push({
          type: 'COMMENTED_CODE',
          file: relative(PROJECT_ROOT, filePath),
          line: i - commentBlock + 1,
          message: `${commentBlock}줄 연속 주석 처리된 코드 블록`,
        });
        commentedCodeFound++;
      }
      commentBlock = 0;
    }
  }
}

/**
 * 오래된 TODO 탐지 (3개월 이상)
 */
function checkOldTodos(filePath, content) {
  const lines = content.split('\n');
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const todoMatch = line.match(/\/\/\s*TODO[\s:]/i);
    if (todoMatch) {
      // 날짜가 포함된 TODO 확인
      const dateMatch = line.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const todoDate = new Date(dateMatch[0]);
        if (todoDate < threeMonthsAgo) {
          issues.push({
            type: 'OLD_TODO',
            file: relative(PROJECT_ROOT, filePath),
            line: i + 1,
            message: `3개월 이상된 TODO (${dateMatch[0]})`,
          });
          oldTodosFound++;
        }
      }
    }
  }
}

/**
 * 미사용 import 간이 탐지
 */
function checkUnusedImports(filePath, content) {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // import { X } from '...' 패턴
    const importMatch = line.match(/^import\s+\{([^}]+)\}\s+from/);
    if (importMatch) {
      const imports = importMatch[1].split(',').map((s) => {
        let name = s.trim();
        // type import 제거 (e.g., "type KeyLike" -> "KeyLike")
        if (name.startsWith('type ')) {
          name = name.slice(5).trim();
        }
        // alias 처리 (e.g., "X as Y" -> "Y")
        if (name.includes(' as ')) {
          name = name.split(' as ').pop().trim();
        }
        return name;
      });

      for (const imp of imports) {
        if (!imp || imp === 'type') continue;

        // import 줄 이후의 코드에서 사용 여부 확인
        const restOfFile = lines.slice(i + 1).join('\n');
        // 정확한 단어 경계 매칭 (단순 contains보다 정밀)
        const regex = new RegExp(`\\b${imp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (!regex.test(restOfFile)) {
          issues.push({
            type: 'UNUSED_IMPORT',
            file: relative(PROJECT_ROOT, filePath),
            line: i + 1,
            message: `미사용 import: ${imp}`,
          });
          unusedImportsFound++;
        }
      }
    }
  }
}

// ── 메인 실행 ──

console.log('============================================');
console.log('  Dead Code 감사 스크립트');
console.log(`  대상: ${SCAN_DIRS.join(', ')}`);
console.log(`  일시: ${new Date().toISOString()}`);
console.log('============================================');
console.log('');

for (const dir of SCAN_DIRS) {
  const fullDir = join(PROJECT_ROOT, dir);
  walkDir(fullDir, (filePath) => {
    totalFiles++;
    const content = readFileSync(filePath, 'utf-8');
    checkUnusedImports(filePath, content);
    checkCommentedCode(filePath, content);
    checkOldTodos(filePath, content);
  });
}

// ── 결과 출력 ──

console.log(`검사 파일: ${totalFiles}개`);
console.log('');

if (issues.length === 0) {
  console.log('Dead code 0건 -- PASS');
} else {
  console.log(`발견된 이슈: ${issues.length}건`);
  console.log('');

  // 유형별 그룹
  const byType = {};
  for (const issue of issues) {
    if (!byType[issue.type]) byType[issue.type] = [];
    byType[issue.type].push(issue);
  }

  for (const [type, typeIssues] of Object.entries(byType)) {
    console.log(`[${type}] ${typeIssues.length}건:`);
    for (const issue of typeIssues) {
      console.log(`  ${issue.file}:${issue.line} -- ${issue.message}`);
    }
    console.log('');
  }
}

console.log('============================================');
console.log(`  미사용 import: ${unusedImportsFound}건`);
console.log(`  주석 코드 블록: ${commentedCodeFound}건`);
console.log(`  오래된 TODO: ${oldTodosFound}건`);
console.log(`  합계: ${issues.length}건`);
console.log('============================================');

// 이슈가 있으면 종료 코드 1
if (issues.length > 0) {
  process.exit(1);
}
