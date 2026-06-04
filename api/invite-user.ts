import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl    = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gmailUser      = process.env.GMAIL_USER;
  const gmailPassword  = process.env.GMAIL_APP_PASSWORD;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[api/invite-user] Missing Supabase env variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const host     = req.headers['x-forwarded-host'] || req.headers.host || 'sangilog.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const siteUrl  = `${protocol}://${host}`;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Gmail 트랜스포터 (설정된 경우에만 사용)
  const transporter = gmailUser && gmailPassword
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPassword },
      })
    : null;

  const sendCustomEmail = async (to: string, subject: string, html: string) => {
    if (!transporter) return false;
    try {
      await transporter.sendMail({ from: `AKLABS <${gmailUser}>`, to, subject, html });
      return true;
    } catch (err: any) {
      console.error('[api/invite-user] Gmail send error:', err.message);
      return false;
    }
  };

  // ── 신규 유저: 초대 링크 생성 후 커스텀 메일 발송 ──────────────────────────
  const { data: inviteData, error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name || '' },
      redirectTo: `${siteUrl}/set-password`,
    });

  if (!inviteError) {
    // 프로필 이름 업데이트
    if (inviteData.user && name) {
      await supabaseAdmin.from('profiles').update({ full_name: name }).eq('id', inviteData.user.id);
    }

    // 커스텀 초대 메일 발송 (Gmail 설정 있을 때)
    await sendCustomEmail(
      email,
      '생기로그 AI 사용 승인 안내',
      inviteEmailHtml(name, siteUrl),
    );

    return res.status(200).json({ ok: true, type: 'invite' });
  }

  // ── 기존 유저: 비밀번호 재설정 링크 생성 후 커스텀 메일 발송 ──────────────
  const isAlreadyRegistered =
    inviteError.status === 422 ||
    inviteError.message.toLowerCase().includes('already') ||
    inviteError.message.toLowerCase().includes('registered');

  if (isAlreadyRegistered) {
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${siteUrl}/set-password` },
      });

    if (linkError) {
      console.error('[api/invite-user] generateLink error:', linkError.message);
      return res.status(500).json({ error: linkError.message });
    }

    const resetUrl = linkData.properties?.action_link;
    if (!resetUrl) {
      return res.status(500).json({ error: 'Failed to generate reset link' });
    }

    const sent = await sendCustomEmail(
      email,
      '생기로그 AI 비밀번호 재설정 안내',
      resetEmailHtml(name, resetUrl),
    );

    if (!sent) {
      // Gmail 미설정 시 Supabase 기본 메일로 폴백
      const { error: resetError } = await (createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })).auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/set-password` });

      if (resetError) return res.status(500).json({ error: resetError.message });
    }

    return res.status(200).json({ ok: true, type: 'reset' });
  }

  console.error('[api/invite-user] invite error:', inviteError.message);
  return res.status(500).json({ error: inviteError.message });
}

// ── 이메일 HTML 템플릿 ────────────────────────────────────────────────────────

function inviteEmailHtml(name: string, siteUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FFFBF5;font-family:'Apple SD Gothic Neo',AppleGothic,'Malgun Gothic',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#F59E0B,#EA580C);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:900;">생기로그 AI</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">수업 기록부터 세특까지</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;color:#92400E;font-size:18px;font-weight:900;">사용 신청이 승인되었습니다 🎉</h2>
      <p style="margin:0 0 24px;color:#78350F;font-size:15px;line-height:1.7;">
        안녕하세요${name ? `, <strong>${name}</strong> 선생님` : ''}!<br>
        생기로그 AI 사용 신청이 승인되었습니다.<br>
        아래 버튼을 클릭해 비밀번호를 설정하고 바로 시작해보세요.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${siteUrl}/set-password"
           style="display:inline-block;background:linear-gradient(135deg,#F59E0B,#EA580C);color:#fff;font-size:15px;font-weight:900;text-decoration:none;padding:14px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(245,158,11,0.35);">
          비밀번호 설정하기
        </a>
      </div>
      <p style="margin:0;color:#B45309;font-size:12px;text-align:center;line-height:1.6;">
        링크는 발송 후 24시간 동안 유효합니다.<br>
        본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.
      </p>
    </div>
    <div style="background:#FEF3C7;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#92400E;font-size:12px;">감사합니다. AKLABS 드림</p>
    </div>
  </div>
</body>
</html>`;
}

function resetEmailHtml(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#FFFBF5;font-family:'Apple SD Gothic Neo',AppleGothic,'Malgun Gothic',sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#F59E0B,#EA580C);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:900;">생기로그 AI</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">수업 기록부터 세특까지</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;color:#92400E;font-size:18px;font-weight:900;">비밀번호 재설정 안내</h2>
      <p style="margin:0 0 24px;color:#78350F;font-size:15px;line-height:1.7;">
        안녕하세요${name ? `, <strong>${name}</strong> 선생님` : ''}!<br>
        아래 버튼을 클릭해 비밀번호를 재설정해주세요.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#F59E0B,#EA580C);color:#fff;font-size:15px;font-weight:900;text-decoration:none;padding:14px 36px;border-radius:12px;box-shadow:0 4px 12px rgba(245,158,11,0.35);">
          비밀번호 재설정하기
        </a>
      </div>
      <p style="margin:0;color:#B45309;font-size:12px;text-align:center;line-height:1.6;">
        링크는 발송 후 1시간 동안 유효합니다.<br>
        본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.
      </p>
    </div>
    <div style="background:#FEF3C7;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#92400E;font-size:12px;">감사합니다. AKLABS 드림</p>
    </div>
  </div>
</body>
</html>`;
}
