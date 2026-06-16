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

  // 1. 이메일 조회 (access_requests 삭제에 필요)
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userData?.user?.email;

  // 2. auth.users FK 참조 테이블 정리 (ON DELETE 미설정 컬럼)
  await supabaseAdmin.from('whiteboard_participants').delete().eq('user_id', userId);
  await supabaseAdmin.from('whiteboard_pointers').delete().eq('user_id', userId);
  await supabaseAdmin.from('whiteboards').update({ created_by: null }).eq('created_by', userId);
  await supabaseAdmin.from('whiteboard_elements').update({ created_by: null }).eq('created_by', userId);
  await supabaseAdmin.from('class_board_sessions').update({ created_by: null }).eq('created_by', userId);

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
