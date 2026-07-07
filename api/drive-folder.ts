// 구글 드라이브 폴더 내 이미지/영상 목록 조회 프록시
// 서비스 계정(access_token)으로 files.list 호출 — 교사는 폴더를 서비스 계정 이메일에 뷰어로 공유해두면 됨

import { createClient } from '@supabase/supabase-js';
import { getServiceAccountAccessToken } from './_lib/googleServiceAccount.js';
import { createSignedDriveFileUrl } from './_lib/mediaSignature.js';

interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
}

export interface DriveFolderItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  createdTime: string;
  proxyUrl?: string;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = (req.headers['authorization'] ?? '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !caller) return res.status(401).json({ error: 'Unauthorized' });

  const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : null;
  if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    return res.status(400).json({ error: 'folderId is required' });
  }

  res.setHeader('Cache-Control', 'private, no-store');

  let accessToken: string;
  try {
    accessToken = await getServiceAccountAccessToken();
  } catch (err) {
    console.error('[api/drive-folder] service account auth failed:', err);
    return res.status(502).json({ error: 'Google 서비스 계정 인증에 실패했습니다.' });
  }

  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`
  );
  const fields = encodeURIComponent('files(id,name,mimeType,createdTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime desc&pageSize=100`;

  try {
    const driveRes = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await driveRes.json();

    if (!driveRes.ok) {
      return res.status(404).json({
        error: '폴더에 접근할 수 없습니다. 폴더를 서비스 계정과 공유했는지 확인해주세요.',
      });
    }

    const files: DriveApiFile[] = data.files ?? [];
    const items: DriveFolderItem[] = files.map(f => {
      const type = f.mimeType.startsWith('video/') ? 'video' : 'image';
      return {
        id: f.id,
        name: f.name,
        type,
        createdTime: f.createdTime,
        ...(type === 'image' ? { proxyUrl: createSignedDriveFileUrl(f.id) } : {}),
      };
    });

    return res.status(200).json({ items });
  } catch {
    return res.status(502).json({ error: '구글 드라이브 조회에 실패했습니다.' });
  }
}
