// SVC-AI-ADV-R42: DSPy 스타일 프롬프트 컴파일러
// Design Ref: §모듈, §인터페이스
// Plan SC: FR-R42.2

export interface Example {
  input: string
  output: string
  grade?: 'O' | 'C' | 'S'
}

export interface PromptCandidate {
  id: string
  text: string
  fewShots: Example[]
  strategy: 'baseline' | 'chain-of-thought' | 'few-shot' | 'self-ask' | 'role-prompt'
}

/**
 * DSPy 패턴을 모방한 프롬프트 컴파일러.
 * 시그니처 + 데이터셋으로부터 다양한 전략의 후보 프롬프트를 생성한다.
 */
export class DSPyCompiler {
  /**
   * 시그니처를 N개 후보 프롬프트로 컴파일.
   * @param signature 'input -> output' 형식의 작업 시그니처
   * @param dataset few-shot 풀
   */
  compile(signature: string, dataset: Example[]): PromptCandidate[] {
    this.assertNoSensitiveData(dataset)

    if (!signature || !signature.includes('->')) {
      throw new Error("signature must be in 'input -> output' format")
    }

    const [inputDesc, outputDesc] = signature.split('->').map((s) => s.trim())
    const safeInput = inputDesc ?? 'input'
    const safeOutput = outputDesc ?? 'output'

    const candidates: PromptCandidate[] = []

    // Strategy 1: Baseline
    candidates.push({
      id: 'cand-baseline',
      text: `다음 ${safeInput}을(를) 받아 ${safeOutput}을(를) 생성하라.\n\n입력: {input}\n출력:`,
      fewShots: [],
      strategy: 'baseline',
    })

    // Strategy 2: Chain of Thought
    candidates.push({
      id: 'cand-cot',
      text: `다음 ${safeInput}에 대해 단계별로 추론하여 ${safeOutput}을(를) 생성하라.\n\n입력: {input}\n\n단계별 추론:\n1)\n2)\n3)\n\n최종 출력:`,
      fewShots: [],
      strategy: 'chain-of-thought',
    })

    // Strategy 3: Few-shot (k=3)
    if (dataset.length >= 3) {
      const selected = this.selectDiverseExamples(dataset, 3)
      candidates.push({
        id: 'cand-fewshot-3',
        text: this.renderFewShot(selected, safeInput, safeOutput),
        fewShots: selected,
        strategy: 'few-shot',
      })
    }

    // Strategy 4: Few-shot (k=5)
    if (dataset.length >= 5) {
      const selected = this.selectDiverseExamples(dataset, 5)
      candidates.push({
        id: 'cand-fewshot-5',
        text: this.renderFewShot(selected, safeInput, safeOutput),
        fewShots: selected,
        strategy: 'few-shot',
      })
    }

    // Strategy 5: Role prompting
    candidates.push({
      id: 'cand-role',
      text: `당신은 공공기관 ${safeOutput} 전문가다. 다음 ${safeInput}을(를) 정확하고 간결하게 처리하라.\n\n입력: {input}\n출력:`,
      fewShots: [],
      strategy: 'role-prompt',
    })

    // Strategy 6: Self-ask
    candidates.push({
      id: 'cand-self-ask',
      text: `다음 ${safeInput}을(를) 처리하기 위해 스스로 질문하고 답하라.\n\n입력: {input}\n\n질문 1:\n답 1:\n질문 2:\n답 2:\n\n최종 ${safeOutput}:`,
      fewShots: [],
      strategy: 'self-ask',
    })

    return candidates
  }

  private renderFewShot(examples: Example[], inputDesc: string, outputDesc: string): string {
    const shots = examples
      .map((e, i) => `예시 ${i + 1}:\n${inputDesc}: ${e.input}\n${outputDesc}: ${e.output}`)
      .join('\n\n')
    return `다음은 ${examples.length}개 예시다.\n\n${shots}\n\n이제 다음 입력에 대해 동일한 형식으로 답하라.\n${inputDesc}: {input}\n${outputDesc}:`
  }

  /**
   * 데이터셋에서 다양성 기반 k개 예시 선택 (간단 구현: 길이 분포).
   */
  private selectDiverseExamples(dataset: Example[], k: number): Example[] {
    if (dataset.length <= k) return dataset.slice()
    const sorted = dataset.slice().sort((a, b) => a.input.length - b.input.length)
    const step = Math.floor(sorted.length / k)
    const picked: Example[] = []
    for (let i = 0; i < k; i += 1) {
      const idx = Math.min(i * step, sorted.length - 1)
      const item = sorted[idx]
      if (item) picked.push(item)
    }
    return picked
  }

  private assertNoSensitiveData(dataset: Example[]): void {
    for (const ex of dataset) {
      if (ex.grade === 'C' || ex.grade === 'S') {
        throw new Error('BLOCKED: C/S 등급 데이터는 프롬프트 최적화 데이터셋 사용 금지 (N2SF N-05)')
      }
      if (/\d{6}-?\d{7}/.test(ex.input) || /\d{6}-?\d{7}/.test(ex.output)) {
        throw new Error('BLOCKED: 데이터셋에 주민번호 패턴 감지')
      }
    }
  }
}

export function createDSPyCompiler(): DSPyCompiler {
  return new DSPyCompiler()
}
