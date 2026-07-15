// 서비스 계정 키(GOOGLE_SERVICE_ACCOUNT_KEY_BASE64)로 Drive API용 access_token 발급
// JWT Bearer 흐름을 Node crypto만으로 직접 구현(googleapis 등 별도 라이브러리 불필요)

import crypto from 'crypto';

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

let cachedKey: ServiceAccountKey | null = null;

function getServiceAccountKey(): ServiceAccountKey {
  if (cachedKey) return cachedKey;
  const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!base64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 not configured on server');
  const json = Buffer.from(base64, 'base64').toString('utf-8');
  cachedKey = JSON.parse(json);
  return cachedKey!;
}

function base64url(input: Buffer | string): string {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 같은 서버리스 인스턴스가 재사용되는 동안(warm) 토큰을 캐시해 매 요청마다 재발급하지 않음
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getServiceAccountAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.accessToken;
  }

  const { client_email, private_key } = getServiceAccountKey();

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(data?.error_description ?? 'Google 서비스 계정 인증에 실패했습니다.');
  }

  cachedToken = { accessToken: data.access_token, expiresAt: now + data.expires_in };
  return cachedToken.accessToken;
}
