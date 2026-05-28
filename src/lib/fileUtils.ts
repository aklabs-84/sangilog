/**
 * 파일 URL을 열거나 다운로드합니다.
 * HTML/HTM 파일은 Supabase가 text/plain으로 서빙해 코드만 보이는 문제가 있어
 * fetch → Blob(text/html) → objectURL 방식으로 강제 렌더링합니다.
 */
export const openFile = async (url: string, fileName: string): Promise<void> => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();

  if (ext === 'html' || ext === 'htm') {
    try {
      const res = await fetch(url);
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      // 새 탭이 로드된 후 메모리 해제
      if (win) setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch {
      // CORS 등 fetch 실패 시 원본 URL 그대로 열기
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
};
