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

  const { user_id, user_name, user_email, title, description, page_url } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. DB 저장
  const { error: dbError } = await supabaseAdmin.from('bug_reports').insert({
    user_id: user_id || null,
    user_name: user_name || '익명',
    user_email: user_email || '',
    title,
    description,
    page_url: page_url || '',
    status: 'open',
  });

  if (dbError) {
    console.error('[api/bug-report] db error:', dbError.message);
    return res.status(500).json({ error: dbError.message });
  }

  // 2. Slack 알림 (설정된 경우)
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: '🐛 생기로그 — 새 버그 리포트', emoji: true },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*제목*\n${title}` },
                { type: 'mrkdwn', text: `*신고자*\n${user_name || '익명'} (${user_email || '-'})` },
              ],
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `*내용*\n${description}` },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `📍 페이지: ${page_url || '-'} | ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | 관리자 패널 → 버그신고 탭에서 확인`,
                },
              ],
            },
          ],
        }),
      });
    } catch (slackErr: any) {
      console.warn('[api/bug-report] slack notify failed:', slackErr?.message);
    }
  }

  return res.status(200).json({ ok: true });
}
