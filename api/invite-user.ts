import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl    = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey        = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('[api/invite-user] Missing env variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const host     = req.headers['x-forwarded-host'] || req.headers.host || 'sangilog.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const siteUrl  = `${protocol}://${host}`;

  const supabaseAdmin  = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const supabasePublic = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 신규 사용자 초대 시도
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name || '' },
    redirectTo: `${siteUrl}/set-password`,
  });

  if (error) {
    // 이미 계정이 있는 경우 → 비밀번호 재설정 이메일 발송
    const isAlreadyRegistered =
      error.status === 422 ||
      error.message.toLowerCase().includes('already') ||
      error.message.toLowerCase().includes('registered');

    if (isAlreadyRegistered) {
      const { error: resetError } = await supabasePublic.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/set-password`,
      });
      if (resetError) {
        console.error('[api/invite-user] resetPassword error:', resetError.message);
        return res.status(500).json({ error: resetError.message });
      }
      return res.status(200).json({ ok: true, type: 'reset' });
    }

    console.error('[api/invite-user] invite error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  // 신규 유저: profiles 이름 업데이트 (트리거 기본값 '사용자' 방지)
  if (data.user && name) {
    await supabaseAdmin
      .from('profiles')
      .update({ full_name: name })
      .eq('id', data.user.id);
  }

  return res.status(200).json({ ok: true, type: 'invite' });
}
