// 구글 드라이브 연동 해제: 구글 쪽 토큰 revoke + DB 행 삭제
// revoke를 먼저 해야 재연결 시 구글이 항상 새 refresh_token을 내려준다.

import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
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
    .select('refresh_token')
    .eq('teacher_id', caller.id)
    .maybeSingle();

  if (connection?.refresh_token) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: connection.refresh_token }),
      });
    } catch (err) {
      console.error('[api/google-oauth-disconnect] revoke failed:', err);
      // revoke 실패해도 DB 행은 삭제 진행 (구글 쪽 토큰은 만료되면 자연 소멸)
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from('teacher_google_connections')
    .delete()
    .eq('teacher_id', caller.id);

  if (deleteError) {
    console.error('[api/google-oauth-disconnect] delete failed:', deleteError.message);
    return res.status(500).json({ error: '연동 해제에 실패했습니다.' });
  }

  return res.status(200).json({ ok: true });
}
