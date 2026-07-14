import { createClient } from '@supabase/supabase-js';

async function handleAnnouncement(req: any, res: any) {
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
    console.error('[api/slack?type=announcement] error:', error?.message);
    return res.status(500).json({ error: error?.message });
  }
}

async function handleNotify(req: any, res: any) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[slack?type=notify] SLACK_WEBHOOK_URL env var is not set');
    return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not configured' });
  }
  console.log('[slack?type=notify] sending to webhook, email:', req.body?.email);

  const { name, email, school_name, role, message } = req.body;

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔔 생기로그 AI — 새 사용 신청',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*이름*\n${name}` },
          { type: 'mrkdwn', text: `*직책*\n${role}` },
          { type: 'mrkdwn', text: `*학교*\n${school_name}` },
          { type: 'mrkdwn', text: `*이메일*\n${email}` },
        ],
      },
      ...(message
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*하고 싶은 말*\n${message}`,
              },
            },
          ]
        : []),
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `신청 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | 어드민 패널에서 승인/거절하세요.`,
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

    if (!response.ok) {
      throw new Error(`Slack responded with ${response.status}`);
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[api/slack?type=notify] error:', error?.message);
    return res.status(500).json({ error: error?.message });
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const type = req.query?.type;
  if (type === 'announcement') return handleAnnouncement(req, res);
  if (type === 'notify') return handleNotify(req, res);
  return res.status(400).json({ error: 'Invalid or missing type query param (announcement | notify)' });
}
