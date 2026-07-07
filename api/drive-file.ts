// 구글 드라이브 이미지 파일을 서버가 대신 받아와 스트리밍하는 프록시
// <img src>는 Authorization 헤더를 못 실으므로, 서명된 단기 URL(id/exp/sig)로 접근 제어
// 폴더를 "링크가 있는 모든 사용자에게 공개"하지 않고도 이미지를 화면에 표시하기 위함

import { getServiceAccountAccessToken } from './_lib/googleServiceAccount.js';
import { verifySignedDriveFileParams } from './_lib/mediaSignature.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fileId = typeof req.query.id === 'string' ? req.query.id : '';
  const exp = Number(req.query.exp);
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';

  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId) || !exp || !sig) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  if (!verifySignedDriveFileParams(fileId, exp, sig)) {
    return res.status(403).json({ error: 'URL이 만료되었거나 유효하지 않습니다.' });
  }

  let accessToken: string;
  try {
    accessToken = await getServiceAccountAccessToken();
  } catch (err) {
    console.error('[api/drive-file] service account auth failed:', err);
    return res.status(502).json({ error: 'Google 서비스 계정 인증에 실패했습니다.' });
  }

  try {
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!driveRes.ok || !driveRes.body) {
      return res.status(404).json({ error: '파일을 가져올 수 없습니다.' });
    }

    res.setHeader('Content-Type', driveRes.headers.get('content-type') ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const reader = driveRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error('[api/drive-file] proxy failed:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: '이미지를 불러오지 못했습니다.' });
    } else {
      res.end();
    }
  }
}
