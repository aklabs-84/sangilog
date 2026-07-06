// 구글 드라이브 폴더 내 이미지/영상 목록 조회 프록시
// GOOGLE_DRIVE_API_KEY는 서버 전용 (프론트 노출 금지)

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

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_DRIVE_API_KEY not configured on server' });
  }

  const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : null;
  if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    return res.status(400).json({ error: 'folderId is required' });
  }

  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`
  );
  const fields = encodeURIComponent('files(id,name,mimeType,createdTime)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime desc&pageSize=100&key=${apiKey}`;

  try {
    const driveRes = await fetch(url);
    const data = await driveRes.json();

    if (!driveRes.ok) {
      return res.status(404).json({ error: '폴더에 접근할 수 없습니다. 공유 설정을 확인하세요.' });
    }

    const files: DriveApiFile[] = data.files ?? [];
    const items: DriveFolderItem[] = files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.mimeType.startsWith('video/') ? 'video' : 'image',
      createdTime: f.createdTime,
    }));

    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');
    return res.status(200).json({ items });
  } catch {
    return res.status(502).json({ error: '구글 드라이브 조회에 실패했습니다.' });
  }
}
