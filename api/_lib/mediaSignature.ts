// /api/drive-file 프록시 URL 서명/검증
// <img src>는 Authorization 헤더를 못 실으므로, 만료시간+HMAC 서명을 쿼리에 담아 검증
// 별도 비밀키를 새로 만들지 않고 기존 SUPABASE_SERVICE_ROLE_KEY를 서명 키로 재사용

import crypto from 'crypto';

function getSigningSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured on server');
  return secret;
}

function sign(fileId: string, exp: number): string {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(`${fileId}.${exp}`)
    .digest('hex');
}

export function createSignedDriveFileUrl(fileId: string, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(fileId, exp);
  return `/api/drive-file?id=${encodeURIComponent(fileId)}&exp=${exp}&sig=${sig}`;
}

export function verifySignedDriveFileParams(fileId: string, exp: number, sig: string): boolean {
  if (!fileId || !exp || !sig) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;
  const expected = sign(fileId, exp);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
