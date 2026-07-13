const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Supabase REST API 응답의 Date 헤더로 "이 기기 시계 - 서버 시계" 오프셋(ms)을 구한다.
 * 실시간 퀴즈처럼 여러 기기의 타이머를 동기화해야 하는 곳에서, 기기 시스템 시간이
 * 틀려도 이 오프셋을 Date.now()에 더하면 실제 서버 기준 시각을 계산할 수 있다.
 * HTTP Date 헤더는 초 단위 정밀도라 초 단위 타이머엔 충분하지만 ms 단위 정밀도는 아니다.
 * 네트워크 오류 등으로 조회에 실패하면 0(기기 시계를 그대로 사용)으로 폴백한다.
 */
export async function getServerTimeOffsetMs(): Promise<number> {
  try {
    const t0 = Date.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: 'no-store',
    });
    const t1 = Date.now();
    const dateHeader = res.headers.get('date');
    if (!dateHeader) return 0;
    const serverTime = new Date(dateHeader).getTime() + (t1 - t0) / 2;
    return serverTime - t1;
  } catch {
    return 0;
  }
}
