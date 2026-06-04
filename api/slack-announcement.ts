export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not configured' });
  }

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
