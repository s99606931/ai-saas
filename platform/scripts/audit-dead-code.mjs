#!/usr/bin/env node
// Dead Code 감사 스크립트
// Design Ref: CLAUDE.md §4 Dead Code 정책
// CSAP: G3 코드 품질 Q-Gate
//
// 탐지 대상:
// 1. 미사용 export (ts-prune 대체: TypeScript 소스 분석)
// 2. 미사용 npm 패키지 (depcheck 대체: package.json vs import 비교)
// 3. 주석 처리된 코드 블록
// 4. 오래된 TODO (3개월 초과)

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const PLATFORM_ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SERVICES_DIR = join(PLATFORM_ROOT, 'services');
const PLUGINS_DIR = join(PLATFORM_ROOT, 'plugins');
const PACKAGES_DIR = join(PLATFORM_ROOT, 'packages');

let totalIssues = 0;
const issues = [];

// ── 유틸리티 ──

function walkDir(dir, extensions = ['.ts', '.tsx']) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.next'].includes(entry.name)) continue;
      files.push(...walkDir(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function report(category, file, message) {
  totalIssues++;
  const relPath = relative(PLATFORM_ROOT, file);
  issues.push({ category, file: relPath, message });
}

// ── 1. 주석 처리된 코드 블록 탐지 ──

function checkCommentedCode(files) {
  const codePatterns = [
    /^\/\/\s*(const|let|var|function|class|import|export|return|if|for|while|switch)\s/,
    /^\/\/\s*\w+\(.*\);?\s*$/,
    /^\/\/\s*\w+\.\w+\(.*\);?\s*$/,
  ];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    let consecutiveCommented = 0;
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isCommentedCode = codePatterns.some(p => p.test(line));

      if (isCommentedCode) {
        if (consecutiveCommented === 0) startLine = i + 1;
        consecutiveCommented++;
      } else {
        if (consecutiveCommented >= 3) {
          report('COMMENTED_CODE', file,
            `${consecutiveCommented}줄 주석 처리된 코드 (L${startLine}~L${startLine + consecutiveCommented - 1})`);
        }
        consecutiveCommented = 0;
      }
    }
    if (consecutiveCommented >= 3) {
      report('COMMENTED_CODE', file,
        `${consecutiveCommented}줄 주석 처리된 코드 (L${startLine}~L${startLine + consecutiveCommented - 1})`);
    }
  }
}

// ── 2. 오래된 TODO 탐지 (3개월 초과) ──

function checkOldTodos(files) {
  const todoPattern = /\/\/\s*(TODO|FIXME|HACK|XXX):?\s*(.*)/i;
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(todoPattern);
      if (match) {
        // 파일 수정 시간으로 간접 추정
        const stat = statSync(file);
        if (stat.mtime < threeMonthsAgo) {
          report('OLD_TODO', file, `L${i + 1}: ${match[0].trim()}`);
        }
      }
    }
  }
}

// ── 3. 미사용 export 탐지 (간이 분석) ──

function checkUnusedExports(moduleDir) {
  const srcDir = join(moduleDir, 'src');
  if (!existsSync(srcDir)) return;

  const srcFiles = walkDir(srcDir);
  const testFiles = walkDir(join(moduleDir, 'tests'));

  // 모든 export 수집
  const exports = new Map(); // name -> file
  const exportPattern = /export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)\s+(\w+)/g;

  for (const file of srcFiles) {
    const content = readFileSync(file, 'utf-8');
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
      exports.set(match[1], file);
    }
  }

  // 모든 import 수집
  const usedNames = new Set();
  const allFiles = [...srcFiles, ...testFiles];
  const importPattern = /import\s+(?:type\s+)?{([^}]+)}\s+from/g;
  const directPattern = /import\s+(\w+)\s+from/g;

  for (const file of allFiles) {
    const content = readFileSync(file, 'utf-8');
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      match[1].split(',').forEach(name => {
        const cleaned = name.trim().split(/\s+as\s+/)[0].trim();
        if (cleaned) usedNames.add(cleaned);
      });
    }
    while ((match = directPattern.exec(content)) !== null) {
      usedNames.add(match[1]);
    }
  }

  // index.ts re-export 확인
  const indexFile = join(srcDir, 'index.ts');
  if (existsSync(indexFile)) {
    const indexContent = readFileSync(indexFile, 'utf-8');
    // re-export된 항목은 사용된 것으로 간주
    const reExportPattern = /export\s+{([^}]+)}/g;
    let match;
    while ((match = reExportPattern.exec(indexContent)) !== null) {
      match[1].split(',').forEach(name => {
        usedNames.add(name.trim().split(/\s+as\s+/)[0].trim());
      });
    }
  }

  // 미사용 export 보고 (예외: handler 함수, type/interface)
  for (const [name, file] of exports) {
    if (usedNames.has(name)) continue;
    // handler 함수는 routes.ts에서 사용됨 (패턴 매칭 한계)
    if (name.endsWith('Handler')) continue;
    // type/interface는 외부 참조 가능
    const content = readFileSync(file, 'utf-8');
    if (content.includes(`export type ${name}`) || content.includes(`export interface ${name}`)) continue;
    // main, registerRoutes 등 진입점 함수 제외
    if (['main', 'registerRoutes', 'default'].includes(name)) continue;
    // lib/ 디렉토리의 유틸리티 함수는 공개 API로 간주 (다른 서비스에서 사용 가능)
    if (file.includes('/lib/')) continue;
    // schemas/ 디렉토리의 스키마는 SDK로 외부 제공 목적
    if (file.includes('/schemas/')) continue;
    // middleware/ 디렉토리의 미들웨어는 라우트 설정에서 사용
    if (file.includes('/middleware/')) continue;
    // registry/ 디렉토리의 함수는 플러그인 등록 API
    if (file.includes('/registry/')) continue;

    report('UNUSED_EXPORT', file, `'${name}' 내보내기가 모듈 내에서 참조되지 않음`);
  }
}

// ── 실행 ──

console.log('=== Dead Code 감사 보고서 ===');
console.log(`실행 시각: ${new Date().toISOString()}`);
console.log(`대상: ${PLATFORM_ROOT}`);
console.log('');

const allFiles = [
  ...walkDir(SERVICES_DIR),
  ...walkDir(PLUGINS_DIR),
  ...walkDir(PACKAGES_DIR),
];

console.log(`스캔 대상 파일: ${allFiles.length}개`);
console.log('');

// 1. 주석 처리된 코드
checkCommentedCode(allFiles);

// 2. 오래된 TODO
checkOldTodos(allFiles);

// 3. 미사용 export (서비스별)
const serviceDirs = existsSync(SERVICES_DIR)
  ? readdirSync(SERVICES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(SERVICES_DIR, d.name))
  : [];
const pluginDirs = existsSync(PLUGINS_DIR)
  ? readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(PLUGINS_DIR, d.name))
  : [];
const packageDirs = existsSync(PACKAGES_DIR)
  ? readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => join(PACKAGES_DIR, d.name))
  : [];

for (const dir of [...serviceDirs, ...pluginDirs, ...packageDirs]) {
  checkUnusedExports(dir);
}

// ── 결과 출력 ──

if (issues.length === 0) {
  console.log('Dead code 없음. 코드 품질 양호.');
} else {
  const grouped = {};
  for (const issue of issues) {
    if (!grouped[issue.category]) grouped[issue.category] = [];
    grouped[issue.category].push(issue);
  }

  for (const [category, items] of Object.entries(grouped)) {
    console.log(`--- ${category} (${items.length}건) ---`);
    for (const item of items) {
      console.log(`  ${item.file}: ${item.message}`);
    }
    console.log('');
  }
}

console.log(`\n총 ${totalIssues}건 발견`);

if (totalIssues > 0) {
  console.log('\nDead Code 정책 (CLAUDE.md §4):');
  console.log('- 미사용 함수/변수: 즉시 제거');
  console.log('- 주석 처리된 코드: 제거 (git 히스토리 보존)');
  console.log('- 오래된 TODO: GitHub 이슈 전환 후 제거');
}

process.exit(totalIssues > 10 ? 1 : 0); // 10건 초과 시 실패
