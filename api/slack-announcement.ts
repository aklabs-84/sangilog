import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl    = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhookUrl     = process.env.SLACK_WEBHOOK_URL;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }
  if (!webhookUrl) {
    return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not configured' });
  }

  // 관리자 인증 검증
  const token = (req.headers['authorization'] ?? '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) return res.status(401).json({ error: 'Unauthorized' });
  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', caller.id).single();
  if (!callerProfile?.is_admin) return res.status(403).json({ error: 'Forbidden' });

  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📢 생기로그 — 공지사항', emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${title}*\n\n${content}` },
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `발송 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | 관리자가 발송한 공지사항입니다.`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Slack responded with ${response.status}`);
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[api/slack-announcement] error:', error?.message);
    return res.status(500).json({ error: error?.message });
  }
}
