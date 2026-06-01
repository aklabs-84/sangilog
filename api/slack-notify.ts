export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not configured' });
  }

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
    console.error('[api/slack-notify] error:', error?.message);
    return res.status(500).json({ error: error?.message });
  }
}
