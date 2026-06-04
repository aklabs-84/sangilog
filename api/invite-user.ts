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

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name || '' },
    redirectTo: `${siteUrl}/set-password`,
  });

  if (error) {
    console.error('[api/invite-user] error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
