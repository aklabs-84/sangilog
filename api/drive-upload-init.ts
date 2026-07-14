// 공유 페이지에서 연동된 구글 드라이브 폴더로 파일을 직접 업로드하기 위한 세션 발급
//
// 영상처럼 큰 파일은 이 서버리스 함수를 거치지 않고 브라우저가 구글로 직접
// PUT하도록, 구글의 resumable upload 세션 URL만 발급해서 클라이언트에 돌려준다.
// (Vercel 서버리스 함수의 요청 본문 크기 제한을 피하기 위함)
//
// 인증: classId + entryCode를 verify_class_entry_code RPC로 서버에서 재검증한다
// (ShareClassView의 입장 코드 검증과 동일한 RPC 재사용 — 클라이언트가 이미
// 인증된 세션이라고 주장하는 것을 그대로 믿지 않는다)

import { createClient } from '@supabase/supabase-js';
import { getServiceAccountAccessToken } from './_lib/googleServiceAccount.js';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10분
const RATE_LIMIT_MAX = 20;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { classId, entryCode, weekNumber, fileName, mimeType, fileSize } = req.body ?? {};

  if (typeof classId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(classId)) {
    return res.status(400).json({ error: 'classId가 올바르지 않습니다.' });
  }
  if (typeof entryCode !== 'string' || !entryCode.trim()) {
    return res.status(400).json({ error: '입장 코드가 필요합니다.' });
  }
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return res.status(400).json({ error: 'fileName이 필요합니다.' });
  }
  if (typeof mimeType !== 'string' || !(mimeType.startsWith('image/') || mimeType.startsWith('video/'))) {
    return res.status(400).json({ error: '이미지 또는 영상 파일만 업로드할 수 있습니다.' });
  }
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) {
    return res.status(400).json({ error: 'fileSize가 올바르지 않습니다.' });
  }
  const isVideo = mimeType.startsWith('video/');
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (size > maxBytes) {
    return res.status(400).json({
      error: isVideo
        ? '영상은 500MB를 초과할 수 없습니다.'
        : '이미지는 20MB를 초과할 수 없습니다.',
    });
  }
  const weekNum = weekNumber == null ? null : Number(weekNumber);
  if (weekNumber != null && !Number.isFinite(weekNum)) {
    return res.status(400).json({ error: 'weekNumber가 올바르지 않습니다.' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. 입장 코드 서버 재검증 (공유 페이지에서 이미 인증했다는 클라이언트 주장을 그대로 믿지 않음)
  const { data: isValidCode, error: rpcError } = await supabaseAdmin.rpc('verify_class_entry_code', {
    p_class_id: classId,
    p_code: entryCode.trim(),
  });
  if (rpcError || !isValidCode) {
    return res.status(403).json({ error: '입장 코드가 올바르지 않습니다.' });
  }

  // 2. 도배 방지: 최근 10분간 같은 학급의 업로드 시도 횟수 확인
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCount } = await supabaseAdmin
    .from('class_gallery_drive_upload_log')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', classId)
    .gte('created_at', since);
  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    return res.status(429).json({ error: '업로드 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' });
  }

  // 3. 업로드 대상 폴더 결정
  const { data: folders } = await supabaseAdmin
    .from('class_gallery_drive_folders')
    .select('folder_id, week_number')
    .eq('class_id', classId);

  if (!folders || folders.length === 0) {
    return res.status(400).json({ error: '연결된 구글 드라이브 폴더가 없습니다.' });
  }

  let targetFolderId: string | null = null;
  if (weekNum != null) {
    targetFolderId = folders.find((f) => f.week_number === weekNum)?.folder_id ?? null;
  } else if (folders.length === 1) {
    targetFolderId = folders[0].folder_id;
  }

  if (!targetFolderId) {
    return res.status(400).json({
      error: '업로드할 폴더(주차)를 선택해주세요.',
      availableWeeks: folders.map((f) => f.week_number),
    });
  }

  // 4. 구글 resumable upload 세션 발급
  let accessToken: string;
  try {
    accessToken = await getServiceAccountAccessToken();
  } catch (err) {
    console.error('[api/drive-upload-init] service account auth failed:', err);
    return res.status(502).json({ error: 'Google 서비스 계정 인증에 실패했습니다.' });
  }

  try {
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(size),
        },
        body: JSON.stringify({ name: fileName, parents: [targetFolderId] }),
      }
    );

    if (initRes.status === 403) {
      return res.status(403).json({
        error: 'permission_denied',
        message: '이 폴더에 파일을 업로드할 권한이 없습니다. 담당 선생님께 폴더를 "편집자" 권한으로 재공유해달라고 요청해주세요.',
      });
    }
    if (!initRes.ok) {
      const errBody = await initRes.text().catch(() => '');
      console.error('[api/drive-upload-init] drive resumable init failed:', initRes.status, errBody);
      return res.status(502).json({ error: '구글 드라이브 업로드 세션 발급에 실패했습니다.' });
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      return res.status(502).json({ error: '구글 드라이브 업로드 세션 발급에 실패했습니다.' });
    }

    // 시도 기록 (rate limit용, 실패해도 업로드 자체는 계속 진행)
    try {
      await supabaseAdmin.from('class_gallery_drive_upload_log').insert({ class_id: classId });
    } catch {
      // 로그 기록 실패는 무시
    }

    return res.status(200).json({ uploadUrl });
  } catch (err) {
    console.error('[api/drive-upload-init] unexpected error:', err);
    return res.status(502).json({ error: '구글 드라이브 업로드 세션 발급에 실패했습니다.' });
  }
}
