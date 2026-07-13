// 구글 드라이브 폴더 내 이미지/영상 목록 조회 프록시
// 서비스 계정(access_token)으로 files.list 호출 — 교사는 폴더를 서비스 계정 이메일에 뷰어로 공유해두면 됨
//
// 두 가지 호출 경로를 지원한다:
//  1) 교사 대시보드(인증됨): Authorization Bearer + folderId
//     → folderId가 실제로 이 교사가 연결한 폴더인지 DB로 확인 후 조회
//       (서비스 계정은 여러 교사의 폴더를 동시에 공유받으므로, 소유 확인 없이
//        임의 folderId를 조회하게 하면 다른 교사의 폴더를 엿볼 수 있음)
//  2) 공개 공유 페이지(비인증): classId
//     → 학급이 공유 상태(share_enabled / school_project)인지 확인 후,
//       클라이언트가 folderId를 넘기지 않고 서버가 DB에서 직접 조회해 신뢰 경계를 지킨다

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
  week_number?: number | null;
}

// 폴더 내 파일이 100개를 넘으면 한 번의 호출로는 전부 가져올 수 없으므로
// nextPageToken을 따라가며 이어받는다. 비정상적으로 큰 폴더에서 함수가
// 무한정 오래 걸리지 않도록 총 개수는 MAX_FILES로 제한한다.
const MAX_FILES = 1000;

async function listDriveFiles(folderId: string, accessToken: string): Promise<DriveFolderItem[]> {
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`
  );
  const fields = encodeURIComponent('nextPageToken, files(id,name,mimeType,createdTime)');

  const files: DriveApiFile[] = [];
  let pageToken: string | undefined;
  do {
    const pageTokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime desc&pageSize=1000${pageTokenParam}`;

    const driveRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await driveRes.json();
    if (!driveRes.ok) throw new Error('폴더에 접근할 수 없습니다.');

    files.push(...((data.files ?? []) as DriveApiFile[]));
    pageToken = data.nextPageToken;
  } while (pageToken && files.length < MAX_FILES);

  return files.slice(0, MAX_FILES).map(f => {
    const type: 'image' | 'video' = f.mimeType.startsWith('video/') ? 'video' : 'image';
    return {
      id: f.id,
      name: f.name,
      type,
      createdTime: f.createdTime,
      ...(type === 'image' ? { proxyUrl: createSignedDriveFileUrl(f.id) } : {}),
    };
  });
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

  res.setHeader('Cache-Control', 'private, no-store');

  let accessToken: string;
  try {
    accessToken = await getServiceAccountAccessToken();
  } catch (err) {
    console.error('[api/drive-folder] service account auth failed:', err);
    return res.status(502).json({ error: 'Google 서비스 계정 인증에 실패했습니다.' });
  }

  const bearerToken = (req.headers['authorization'] ?? '').replace('Bearer ', '');

  // ── 경로 1: 교사 대시보드 (인증) ──────────────────────────────────────────
  if (bearerToken) {
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(bearerToken);
    if (authError || !caller) return res.status(401).json({ error: 'Unauthorized' });

    const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : null;
    if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId)) {
      return res.status(400).json({ error: 'folderId is required' });
    }

    const { data: owned } = await supabaseAdmin
      .from('class_gallery_drive_folders')
      .select('id')
      .eq('folder_id', folderId)
      .eq('teacher_id', caller.id)
      .limit(1)
      .maybeSingle();
    if (!owned) return res.status(403).json({ error: '연결되지 않은 폴더입니다.' });

    try {
      const items = await listDriveFiles(folderId, accessToken);
      return res.status(200).json({ items });
    } catch {
      return res.status(502).json({ error: '구글 드라이브 조회에 실패했습니다.' });
    }
  }

  // ── 경로 2: 공개 공유 페이지 (비인증) ──────────────────────────────────────
  const classId = typeof req.query.classId === 'string' ? req.query.classId : null;
  if (!classId || !/^[a-zA-Z0-9-]+$/.test(classId)) {
    return res.status(400).json({ error: 'classId is required' });
  }

  const { data: cls } = await supabaseAdmin
    .from('classes')
    .select('id, share_enabled, school_project_id')
    .eq('id', classId)
    .maybeSingle();

  let isShared = !!cls && (cls.share_enabled === true || cls.school_project_id != null);
  if (cls && !isShared) {
    const { data: spc } = await supabaseAdmin
      .from('school_project_classes')
      .select('class_id')
      .eq('class_id', classId)
      .limit(1)
      .maybeSingle();
    isShared = !!spc;
  }
  if (!isShared) return res.status(403).json({ error: '공유되지 않은 학급입니다.' });

  const { data: folders } = await supabaseAdmin
    .from('class_gallery_drive_folders')
    .select('folder_id, week_number')
    .eq('class_id', classId);

  if (!folders || folders.length === 0) {
    return res.status(200).json({ items: [] });
  }

  try {
    const perFolder = await Promise.all(
      folders.map(async f => {
        const items = await listDriveFiles(f.folder_id, accessToken);
        return items.map(item => ({ ...item, week_number: f.week_number }));
      })
    );
    return res.status(200).json({ items: perFolder.flat() });
  } catch (err) {
    console.error('[api/drive-folder] public listing failed:', err);
    return res.status(502).json({ error: '구글 드라이브 조회에 실패했습니다.' });
  }
}
