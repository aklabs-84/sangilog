// 구글 OAuth 동의 팝업에서 받은 code를 access_token/refresh_token으로 교환
// 최초 연결 시 refresh_token을 teacher_google_connections에 저장

import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 호출자 인증 검증
  const token = (req.headers['authorization'] ?? '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) return res.status(401).json({ error: 'Unauthorized' });

  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('[api/google-oauth-exchange] token exchange failed:', tokenData);
      return res.status(502).json({ error: 'Google 인증 교환에 실패했습니다.' });
    }

    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userinfo = await userinfoRes.json();

    // 구글은 최초 동의(또는 재동의) 시에만 refresh_token을 내려준다.
    // 이미 저장된 연동이 있는데 이번에 refresh_token이 안 왔다면 기존 값을 유지한다.
    if (tokenData.refresh_token) {
      const { error: upsertError } = await supabaseAdmin.from('teacher_google_connections').upsert(
        {
          teacher_id: caller.id,
          refresh_token: tokenData.refresh_token,
          google_email: userinfo?.email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'teacher_id' }
      );
      if (upsertError) {
        console.error('[api/google-oauth-exchange] upsert failed:', upsertError.message);
        return res.status(500).json({ error: '연결 정보를 저장하는데 실패했습니다.' });
      }
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      google_email: userinfo?.email ?? null,
    });
  } catch (err) {
    console.error('[api/google-oauth-exchange] unexpected error:', err);
    return res.status(502).json({ error: 'Google 인증 처리 중 오류가 발생했습니다.' });
  }
}
