// 텍스트 청킹 유틸리티 — FR-AI26.1 RAG 엔진
// Design Ref: SVC-AI-2026 DESIGN §1
// 한국어 최적화: 단락 → 문장 → 문자 순서로 청킹

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  startChar: number;
  endChar: number;
}

/**
 * 한국어 텍스트를 LLM 처리에 적합한 청크로 분할합니다.
 * 전략: 단락 우선 → 문장 분리 → 크기 기준 강제 분할
 * @param text 원본 텍스트
 * @param maxTokens 청크당 최대 토큰 수 (기본 512)
 * @param overlapTokens 오버랩 토큰 수 (기본 50)
 */
export function chunkText(text: string, maxTokens = 512, overlapTokens = 50): TextChunk[] {
  const maxChars = maxTokens * 2; // 한국어 기준 토큰당 약 2자
  const overlapChars = overlapTokens * 2;

  // 단락으로 1차 분할
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);

  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let startChar = 0;
  let chunkIndex = 0;
  let currentPos = 0;

  for (const paragraph of paragraphs) {
    // 현재 청크에 추가했을 때 최대 크기 초과 여부 확인
    if (currentChunk.length + paragraph.length + 1 > maxChars && currentChunk.length > 0) {
      // 현재 청크 저장
      chunks.push({
        content: currentChunk.trim(),
        chunkIndex: chunkIndex++,
        tokenCount: Math.ceil(currentChunk.length / 2),
        startChar,
        endChar: startChar + currentChunk.length,
      });
      // 오버랩: 이전 청크 끝 부분 유지
      const overlapText = currentChunk.slice(-overlapChars);
      startChar = startChar + currentChunk.length - overlapChars;
      currentChunk = overlapText + '\n\n';
    }

    // 단락 자체가 최대 크기보다 큰 경우 문장 단위로 분할
    if (paragraph.length > maxChars) {
      const sentences = splitIntoSentences(paragraph);
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 1 > maxChars && currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            chunkIndex: chunkIndex++,
            tokenCount: Math.ceil(currentChunk.length / 2),
            startChar,
            endChar: startChar + currentChunk.length,
          });
          const overlapText = currentChunk.slice(-overlapChars);
          startChar = startChar + currentChunk.length - overlapChars;
          currentChunk = overlapText + ' ';
        }
        currentChunk += sentence + ' ';
      }
    } else {
      currentChunk += paragraph + '\n\n';
    }
    currentPos += paragraph.length + 2;
  }

  // 마지막 청크 저장
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      chunkIndex: chunkIndex,
      tokenCount: Math.ceil(currentChunk.length / 2),
      startChar,
      endChar: startChar + currentChunk.length,
    });
  }

  // 빈 청크 제거
  return chunks.filter((c) => c.content.length > 10);
}

/**
 * 한국어 + 영어 문장 분리
 */
function splitIntoSentences(text: string): string[] {
  // 한국어 문장 종결어미 + 영어 마침표
  return text
    .split(/(?<=[.!?。！？\n])\s+|(?<=다\.|다!\|다\?|요\.|요!\|요\?|니다\.|습니다\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 토큰 수 추정 (한국어 기준)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

// ── 부모-자식 계층적 청킹 ──────────────────────────────────────────────────
// Design Ref: SVC-AI-ADV-R1 DESIGN §5
// Plan SC: FR-ADV1.6

export interface HierarchicalChunk {
  /** 부모 청크 (컨텍스트 전달용, 1024 토큰) */
  parent: TextChunk;
  /** 자식 청크 배열 (검색 인덱싱용, 256 토큰) */
  children: TextChunk[];
  /** 부모 청크 ID (parentIndex 기반) */
  parentIndex: number;
}

/**
 * 계층적 청킹: 세분화 청크(256토큰)로 검색 → 부모 청크(1024토큰) 반환
 * Plan SC: FR-ADV1.6
 *
 * 전략:
 * 1. 부모 청크로 먼저 분할 (1024 토큰, 오버랩 100 토큰)
 * 2. 각 부모 청크를 자식 청크로 세분화 (256 토큰, 오버랩 25 토큰)
 * 3. 검색 시 자식 청크 매칭 → 부모 청크 컨텍스트 반환
 *
 * @param text 원본 텍스트
 * @param parentMaxTokens 부모 청크 최대 토큰 수 (기본 1024)
 * @param childMaxTokens 자식 청크 최대 토큰 수 (기본 256)
 */
export function hierarchicalChunk(
  text: string,
  parentMaxTokens = 1024,
  childMaxTokens = 256,
): HierarchicalChunk[] {
  // 1. 부모 청크 생성
  const parentOverlap = Math.floor(parentMaxTokens * 0.1); // 10% 오버랩
  const parentChunks = chunkText(text, parentMaxTokens, parentOverlap);

  // 2. 각 부모 청크를 자식 청크로 세분화
  const hierarchical: HierarchicalChunk[] = [];
  let globalChildIndex = 0;

  for (let pIdx = 0; pIdx < parentChunks.length; pIdx++) {
    const parent = parentChunks[pIdx];
    if (!parent) continue;

    const childOverlap = Math.floor(childMaxTokens * 0.1); // 10% 오버랩
    const childChunks = chunkText(parent.content, childMaxTokens, childOverlap);

    // 자식 청크의 글로벌 인덱스 재할당
    const indexedChildren = childChunks.map((child) => ({
      ...child,
      chunkIndex: globalChildIndex++,
      // 부모 대비 상대 오프셋을 원본 대비 절대 오프셋으로 변환
      startChar: parent.startChar + child.startChar,
      endChar: parent.startChar + child.endChar,
    }));

    hierarchical.push({
      parent,
      children: indexedChildren,
      parentIndex: pIdx,
    });
  }

  return hierarchical;
}

/**
 * 자식 청크 ID에서 부모 청크를 조회하는 매핑 테이블 생성
 * 검색 시 자식→부모 역참조에 사용
 */
export function buildChildToParentMap(
  hierarchical: HierarchicalChunk[],
): Map<number, TextChunk> {
  const map = new Map<number, TextChunk>();
  for (const group of hierarchical) {
    for (const child of group.children) {
      map.set(child.chunkIndex, group.parent);
    }
  }
  return map;
}
