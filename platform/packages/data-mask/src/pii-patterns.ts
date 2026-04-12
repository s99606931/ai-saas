// PII 정규식 패턴 + Luhn
// Plan SC: FR-DM.1~FR-DM.6
// 주의: 모든 정규식은 g 플래그 없이 정의 (호출측에서 매번 새로 생성)

export function ssnPattern(): RegExp {
  return /\b(\d{6})[- ]?([1-4])(\d{6})\b/g;
}

export function cardPattern(): RegExp {
  return /\b(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})\b/g;
}

export function mobilePattern(): RegExp {
  return /\b(01[016789])[- ]?(\d{3,4})[- ]?(\d{4})\b/g;
}

export function landlinePattern(): RegExp {
  return /\b(0[2-6]\d?)[- ]?(\d{3,4})[- ]?(\d{4})\b/g;
}

export function emailPattern(): RegExp {
  return /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
}

/** 한국 계좌번호 (구분자 포함, 3-1-7 등 다양한 패턴)
 *  주의: 4-4-4-4 형태(카드)와 충돌하지 않도록 마지막 그룹 뒤 추가 숫자 거부
 */
export function accountPattern(): RegExp {
  return /(?<!\d)(\d{2,4})-(\d{2,6})-(\d{2,8})(?!-?\d)/g;
}

/**
 * Luhn 알고리즘
 */
export function isLuhnValid(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;

  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = parseInt(digits[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** 주소 마스킹 패턴 (시·도 + 시·군·구만 보존) */
const KOREAN_PROVINCES = [
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원도',
  '강원특별자치도',
  '충청북도',
  '충청남도',
  '전라북도',
  '전북특별자치도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
];

export function maskAddress(input: string): string {
  for (const prov of KOREAN_PROVINCES) {
    const idx = input.indexOf(prov);
    if (idx === -1) continue;
    // 시·도 다음 토큰 (시/군/구)까지 보존
    const after = input.slice(idx + prov.length);
    const districtMatch = after.match(/^\s*(\S+(?:시|군|구))/);
    if (districtMatch) {
      return `${prov} ${districtMatch[1]} ****`;
    }
    return `${prov} ****`;
  }
  return input;
}
