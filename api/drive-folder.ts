// 구글 드라이브 폴더 내 이미지/영상 목록 조회 프록시
// 교사 본인의 OAuth refresh_token으로 access_token을 갱신해 files.list 호출 (Bearer 인증)

import { createClient } from '@supabase/supabase-js';
import { refreshGoogleAccessToken, GoogleReconnectRequiredError } from './_lib/googleToken';

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

  const { data: connection } = await supabaseAdmin
    .from('teacher_google_connections')
    .select('refresh_token')
    .eq('teacher_id', caller.id)
    .maybeSingle();

  if (!connection) {
    return res.status(401).json({ error: 'GOOGLE_RECONNECT_REQUIRED' });
  }

  let accessToken: string;
  try {
    const result = await refreshGoogleAccessToken(connection.refresh_token);
    accessToken = result.accessToken;
  } catch (err) {
    if (err instanceof GoogleReconnectRequiredError) {
      await supabaseAdmin.from('teacher_google_connections').delete().eq('teacher_id', caller.id);
      return res.status(401).json({ error: 'GOOGLE_RECONNECT_REQUIRED' });
    }
    console.error('[api/drive-folder] token refresh failed:', err);
    return res.status(502).json({ error: 'Google 인증 갱신에 실패했습니다.' });
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
      return res.status(404).json({ error: '폴더에 접근할 수 없습니다. 폴더를 다시 선택해주세요.' });
    }

    const files: DriveApiFile[] = data.files ?? [];
    const items: DriveFolderItem[] = files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.mimeType.startsWith('video/') ? 'video' : 'image',
      createdTime: f.createdTime,
    }));

    return res.status(200).json({ items });
  } catch {
    return res.status(502).json({ error: '구글 드라이브 조회에 실패했습니다.' });
  }
}
