// Google Identity Services(GIS) + Google Picker 연동
// 스크립트는 실제로 필요할 때(폴더 연결 모달을 열 때)만 지연 로드한다.

import { supabase } from './supabase';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GAPI_SRC = 'https://apis.google.com/js/api.js';
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export class GoogleReconnectRequiredError extends Error {
  constructor() {
    super('GOOGLE_RECONNECT_REQUIRED');
    this.name = 'GoogleReconnectRequiredError';
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if ((existing as any)._loaded) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`${src} 로드에 실패했습니다.`)));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (script as any)._loaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error(`${src} 로드에 실패했습니다.`));
    document.head.appendChild(script);
  });
}

async function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;
  await loadScript(GIS_SRC);
}

async function loadPicker(): Promise<void> {
  if (window.google?.picker) return;
  await loadScript(GAPI_SRC);
  await new Promise<void>((resolve, reject) => {
    window.gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('Picker 로드에 실패했습니다.')) });
  });
}

async function getSupabaseAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('로그인이 필요합니다.');
  return token;
}

async function requestAuthCode(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('VITE_GOOGLE_OAUTH_CLIENT_ID가 설정되지 않았습니다.');

  await loadGis();

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      ux_mode: 'popup',
      access_type: 'offline',
      prompt: 'consent',
      callback: (response: any) => {
        if (response.error || !response.code) {
          reject(new Error('Google 인증이 취소되었거나 실패했습니다.'));
          return;
        }
        resolve(response.code);
      },
    });
    client.requestCode();
  });
}

/**
 * 저장된 연동으로 조용히 access_token을 갱신 시도하고, 실패 시 동의 팝업 → 코드 교환으로 진행한다.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const supabaseToken = await getSupabaseAccessToken();

  const silentRes = await fetch('/api/google-oauth-token', {
    headers: { Authorization: `Bearer ${supabaseToken}` },
  });
  if (silentRes.ok) {
    const data = await silentRes.json();
    return data.access_token;
  }

  const code = await requestAuthCode();

  const exchangeRes = await fetch('/api/google-oauth-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseToken}` },
    body: JSON.stringify({ code }),
  });
  const exchangeData = await exchangeRes.json();
  if (!exchangeRes.ok) {
    throw new Error(exchangeData?.error ?? 'Google 계정 연결에 실패했습니다.');
  }
  return exchangeData.access_token;
}

export interface PickedFolder {
  id: string;
  name: string;
}

/**
 * Picker를 열어 폴더 하나를 선택하게 한다. 사용자가 취소하면 null을 반환한다.
 */
export async function pickDriveFolder(accessToken: string): Promise<PickedFolder | null> {
  const developerKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;
  if (!developerKey) throw new Error('VITE_GOOGLE_PICKER_API_KEY가 설정되지 않았습니다.');

  await loadPicker();

  return new Promise((resolve, reject) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setIncludeFolders(true);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(developerKey)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          if (!doc) {
            reject(new Error('선택한 폴더 정보를 가져오지 못했습니다.'));
            return;
          }
          resolve({ id: doc.id, name: doc.name });
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
