/**
 * 파일을 다운로드합니다.
 * cross-origin URL은 download 속성이 무시되므로
 * fetch → Blob → objectURL 방식으로 강제 다운로드합니다.
 */
export const downloadFile = async (url: string, fileName: string): Promise<void> => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch {
    // fetch 실패 시 직접 링크 다운로드 시도
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

/**
 * 파일 URL을 새 탭에서 엽니다 (교사 게시물 첨부파일용).
 * HTML/HTM 파일은 Supabase가 text/plain으로 서빙해 코드만 보이는 문제가 있어
 * fetch → Blob(text/html; charset=utf-8) → objectURL 방식으로 강제 렌더링합니다.
 */
export const openFile = async (url: string, fileName: string): Promise<void> => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();

  if (ext === 'html' || ext === 'htm') {
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (win) setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch {
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
};
