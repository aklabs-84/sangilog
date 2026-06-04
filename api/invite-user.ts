import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl      = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[api/invite-user] Missing env: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 요청 origin에서 사이트 URL 추출 (로컬/프로덕션 자동 대응)
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'sangilog.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const siteUrl = `${protocol}://${host}`;

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name || '' },
    redirectTo: `${siteUrl}/set-password`,
  });

  if (error) {
    console.error('[api/invite-user] error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  // 트리거가 생성한 profiles 행에 이름을 직접 덮어씀 (트리거 기본값 '사용자' 방지)
  if (data.user && name) {
    await supabaseAdmin
      .from('profiles')
      .update({ full_name: name })
      .eq('id', data.user.id);
  }

  return res.status(200).json({ ok: true });
}
