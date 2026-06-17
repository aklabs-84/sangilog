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

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 호출자 관리자 인증 검증
  const token = (req.headers['authorization'] ?? '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) return res.status(401).json({ error: 'Unauthorized' });
  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', caller.id).single();
  if (!callerProfile?.is_admin) return res.status(403).json({ error: 'Forbidden: admin only' });

  // 1. 이메일 조회 (access_requests 삭제에 필요)
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userData?.user?.email;

  // 2. auth.users / profiles FK 참조 테이블 정리 (ON DELETE 미설정 컬럼 전체)
  await Promise.all([
    // auth.users 직접 참조 → 삭제
    supabaseAdmin.from('ai_usage_logs').delete().eq('user_id', userId),
    supabaseAdmin.from('whiteboard_members').delete().eq('user_id', userId),
    supabaseAdmin.from('whiteboard_sessions').delete().eq('user_id', userId),
    // auth.users 직접 참조 → created_by/teacher_id NULL 처리
    supabaseAdmin.from('attendance').update({ teacher_id: null }).eq('teacher_id', userId),
    supabaseAdmin.from('student_evaluations').update({ teacher_id: null }).eq('teacher_id', userId),
    supabaseAdmin.from('units').update({ teacher_id: null }).eq('teacher_id', userId),
    supabaseAdmin.from('whiteboards').update({ created_by: null }).eq('created_by', userId),
    supabaseAdmin.from('board_objects').update({ created_by: null }).eq('created_by', userId),
    supabaseAdmin.from('class_board_sessions').update({ created_by: null }).eq('created_by', userId),
    // profiles.id 참조 → NULL 처리 (profiles CASCADE 삭제 전에 정리)
    supabaseAdmin.from('beta_coupons').update({ created_by: null }).eq('created_by', userId),
    supabaseAdmin.from('class_general_materials').update({ teacher_id: null }).eq('teacher_id', userId),
  ]);

  // 3. auth.users 삭제 → profiles(ON DELETE CASCADE) 자동 삭제
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    console.error('[api/delete-user] error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  // 3. 사용 신청 기록도 이메일 기준으로 삭제
  if (email) {
    await supabaseAdmin.from('access_requests').delete().eq('email', email);
  }

  return res.status(200).json({ ok: true });
}
