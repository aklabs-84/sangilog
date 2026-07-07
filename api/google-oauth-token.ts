// 이미 연결된 교사의 access_token을 조용히(팝업 없이) 재발급

import { createClient } from '@supabase/supabase-js';
import { refreshGoogleAccessToken, GoogleReconnectRequiredError } from './_lib/googleToken.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = (req.headers['authorization'] ?? '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) return res.status(401).json({ error: 'Unauthorized' });

  const { data: connection } = await supabaseAdmin
    .from('teacher_google_connections')
    .select('refresh_token, google_email')
    .eq('teacher_id', caller.id)
    .maybeSingle();

  if (!connection) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(401).json({ error: 'GOOGLE_RECONNECT_REQUIRED' });
  }

  try {
    const { accessToken, expiresIn } = await refreshGoogleAccessToken(connection.refresh_token);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      access_token: accessToken,
      expires_in: expiresIn,
      google_email: connection.google_email ?? null,
    });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    if (err instanceof GoogleReconnectRequiredError) {
      await supabaseAdmin.from('teacher_google_connections').delete().eq('teacher_id', caller.id);
      return res.status(401).json({ error: 'GOOGLE_RECONNECT_REQUIRED' });
    }
    console.error('[api/google-oauth-token] refresh failed:', err);
    return res.status(502).json({ error: 'Google 인증 갱신에 실패했습니다.' });
  }
}
