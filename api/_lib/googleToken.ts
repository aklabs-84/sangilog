// refresh_token으로 access_token을 갱신하는 공통 헬퍼 (라우트 아님, Vercel이 무시)

export interface GoogleTokenRefreshResult {
  accessToken: string;
  expiresIn: number;
}

export class GoogleReconnectRequiredError extends Error {
  constructor() {
    super('GOOGLE_RECONNECT_REQUIRED');
    this.name = 'GoogleReconnectRequiredError';
  }
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenRefreshResult> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID/SECRET not configured on server');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    if (data?.error === 'invalid_grant') {
      throw new GoogleReconnectRequiredError();
    }
    throw new Error(data?.error_description ?? 'Google 토큰 갱신에 실패했습니다.');
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}
