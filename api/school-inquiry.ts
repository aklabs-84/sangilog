export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not configured' });
  }

  const { org_type, org_name, contact_name, email, phone, member_count, message } = req.body;

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🏫 생기로그 AI — ${org_type} 도입 문의`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*기관 유형*\n${org_type}` },
          { type: 'mrkdwn', text: `*기관명*\n${org_name}` },
          { type: 'mrkdwn', text: `*담당자*\n${contact_name}` },
          { type: 'mrkdwn', text: `*이메일*\n${email}` },
          { type: 'mrkdwn', text: `*연락처*\n${phone || '미입력'}` },
          { type: 'mrkdwn', text: `*교사·강사 수*\n${member_count}명` },
        ],
      },
      ...(message
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*문의 내용*\n${message}`,
              },
            },
          ]
        : []),
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `문의 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} | School 플랜 도입 문의`,
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
    console.error('[api/school-inquiry] error:', error?.message);
    return res.status(500).json({ error: error?.message });
  }
}
