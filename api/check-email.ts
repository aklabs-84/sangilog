import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl    = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. 이미 가입된 계정인지 확인 (profiles 테이블)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profile) {
    return res.status(200).json({ status: 'registered' });
  }

  // 2. 이미 신청 기록이 있는지 확인 (access_requests 테이블)
  const { data: request } = await supabaseAdmin
    .from('access_requests')
    .select('status')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (request) {
    if (request.status === 'pending') {
      return res.status(200).json({ status: 'pending' });
    }
    if (request.status === 'approved') {
      return res.status(200).json({ status: 'approved' });
    }
    // rejected → 재신청 허용
  }

  return res.status(200).json({ status: 'available' });
}
