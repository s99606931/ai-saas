import { describe, it, expect, beforeEach } from 'vitest';
import { ElectionAnomalyDetectorAI } from '../election-anomaly-detector-ai';

describe('ElectionAnomalyDetectorAI', () => {
  let ai: ElectionAnomalyDetectorAI;

  beforeEach(() => {
    ai = new ElectionAnomalyDetectorAI();
  });

  it('투표소를 등록한다', () => {
    ai.registerStation({
      stationId: 's1',
      region: '서울',
      eligibleVoters: 1000,
      totalVotes: 700,
      candidateVotes: { A: 400, B: 300 },
    });
    expect(ai.turnoutPct('s1')).toBe(70);
  });

  it('지역 평균 투표율을 계산한다', () => {
    ai.registerStation({
      stationId: 's1',
      region: '부산',
      eligibleVoters: 1000,
      totalVotes: 600,
      candidateVotes: { A: 300, B: 300 },
    });
    ai.registerStation({
      stationId: 's2',
      region: '부산',
      eligibleVoters: 1000,
      totalVotes: 800,
      candidateVotes: { A: 400, B: 400 },
    });
    expect(ai.regionalAverageTurnout('부산')).toBe(70);
  });

  it('정상 투표를 감지한다', () => {
    ai.registerStation({
      stationId: 's1',
      region: '대전',
      eligibleVoters: 1000,
      totalVotes: 700,
      candidateVotes: { A: 400, B: 300 },
    });
    expect(ai.detect('s1').severity).toBe('normal');
  });

  it('압도적 득표를 이상으로 감지한다', () => {
    ai.registerStation({
      stationId: 's1',
      region: '광주',
      eligibleVoters: 1000,
      totalVotes: 700,
      candidateVotes: { A: 690, B: 10 },
    });
    const r = ai.detect('s1');
    expect(r.reasons).toContain('EXTREME_CANDIDATE_DOMINANCE');
  });

  it('총 투표 수 초과 등록을 거부한다', () => {
    expect(() =>
      ai.registerStation({
        stationId: 's1',
        region: '인천',
        eligibleVoters: 100,
        totalVotes: 200,
        candidateVotes: { A: 100 },
      }),
    ).toThrow('투표 수');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerStation(
        {
          stationId: 's1',
          region: '서울',
          eligibleVoters: 100,
          totalVotes: 50,
          candidateVotes: { A: 50 },
        },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
