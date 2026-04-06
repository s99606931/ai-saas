// N2SF 데이터 등급 검증 미들웨어
// Design Ref: DESIGN-MTU-P04
// Plan SC: FR-P04.6
// CSAP: N2SF N-05 데이터 등급

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DataGrade } from '@public-saas/types';

/**
 * N2SF 데이터 등급 검증 미들웨어
 *
 * AI 서비스로의 요청에서 데이터 등급을 검증합니다.
 * C/S 등급 데이터는 AI API 전송을 차단합니다.
 *
 * @param allowedGrades - 허용 등급 목록
 */
export function dataGradeMiddleware(allowedGrades: DataGrade[] = ['O']) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const dataGrade = request.headers['x-data-grade'] as DataGrade | undefined;

    if (!dataGrade) {
      // 등급 미지정 시 기본값 O (공개)
      return;
    }

    if (!allowedGrades.includes(dataGrade)) {
      await reply.status(403).send({
        success: false,
        error: {
          code: 'DATA_GRADE_VIOLATION',
          message: `${dataGrade} 등급 데이터는 이 서비스로 전송할 수 없습니다 (N2SF N-05). 허용 등급: ${allowedGrades.join(', ')}`,
        },
      });
      return;
    }
  };
}
