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

  // ── 신규 유저: 초대 링크(토큰 포함) 생성 후 커스텀 메일 발송 ─────────────
  // generateLink 사용: 실제 토큰 링크 반환, 기본 이메일 미발송
  const { data: inviteLink, error: inviteError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { full_name: name || '', name: name || '' },
        redirectTo: `${siteUrl}/set-password`,
      },
    });

  if (!inviteError && inviteLink?.user) {
    const hashedToken = inviteLink.properties?.hashed_token;

    // hashed_token을 URL 파라미터로 직접 전달 → 앱 내 verifyOtp() 교환
    // Supabase redirect_to 경유 없이 동작하므로 URL 허용 목록 의존 없음
    const setPasswordUrl = hashedToken
      ? `${siteUrl}/set-password?token_hash=${encodeURIComponent(hashedToken)}&type=invite`
      : inviteLink.properties?.action_link ?? `${siteUrl}/set-password`;

    // 프로필: 이름 + role=teacher + email 동시 설정 (트리거 기본값 student 덮어쓰기)
    await supabaseAdmin.from('profiles')
      .update({ full_name: name || '', role: 'teacher', email })
      .eq('id', inviteLink.user.id);

    await sendCustomEmail(
      email,
      '생기로그 AI 사용 승인 안내',
      inviteEmailHtml(name, setPasswordUrl),
    );

    console.log('[api/invite-user] invite sent, setPasswordUrl:', setPasswordUrl);
    return res.status(200).json({ ok: true, type: 'invite' });
  }

  // ── 기존 유저: 비밀번호 재설정 링크 생성 후 커스텀 메일 발송 ──────────────
  const isAlreadyRegistered =
    !inviteLink ||
    (inviteError?.status === 422) ||
    (inviteError?.message?.toLowerCase().includes('already')) ||
    (inviteError?.message?.toLowerCase().includes('registered'));

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

    if (linkData.user) {
      // 기존 유저도 Display name + role 갱신
      await supabaseAdmin.auth.admin.updateUserById(linkData.user.id, {
        user_metadata: { full_name: name || '', name: name || '' },
      });
      await supabaseAdmin.from('profiles')
        .update({ full_name: name || '', role: 'teacher', email })
        .eq('id', linkData.user.id);
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
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#F59E0B 0%,#EA580C 100%);padding:36px 32px;text-align:center;position:relative;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:14px;padding:10px 18px;margin-bottom:12px;">
        <span style="color:#fff;font-size:11px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;">생기로그 AI</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:-0.5px;">사용 신청이 승인되었습니다 🎉</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.80);font-size:13px;">수업 기록부터 세특까지</p>
    </div>
    <div style="padding:40px 36px;">
      <p style="margin:0 0 28px;color:#44403C;font-size:15px;line-height:1.8;">
        안녕하세요${name ? `, <strong style="color:#92400E;">${name}</strong> 선생님` : ''}!<br>
        생기로그 AI 사용 신청이 승인되었습니다.<br>
        아래 버튼을 클릭해 비밀번호를 설정하고 바로 시작해보세요.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${siteUrl}/set-password"
           style="display:inline-block;background:linear-gradient(135deg,#F59E0B 0%,#EA580C 100%);color:#fff;font-size:15px;font-weight:900;text-decoration:none;padding:16px 44px;border-radius:14px;box-shadow:0 6px 20px rgba(245,158,11,0.40);letter-spacing:-0.2px;">
          비밀번호 설정하기 →
        </a>
      </div>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px 20px;margin-top:8px;">
        <p style="margin:0;color:#92400E;font-size:12px;line-height:1.7;text-align:center;">
          ⏱ 링크는 발송 후 24시간 동안 유효합니다.<br>
          본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.
        </p>
      </div>
    </div>
    <div style="background:linear-gradient(135deg,#FEF3C7,#FDE68A);padding:18px 36px;text-align:center;border-top:1px solid #FDE68A;">
      <p style="margin:0;color:#92400E;font-size:12px;font-weight:700;">감사합니다. AKLABS 드림 ✦</p>
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
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#F59E0B 0%,#EA580C 100%);padding:36px 32px;text-align:center;position:relative;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:14px;padding:10px 18px;margin-bottom:12px;">
        <span style="color:#fff;font-size:11px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;">생기로그 AI</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:900;letter-spacing:-0.5px;">비밀번호 재설정 안내</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.80);font-size:13px;">수업 기록부터 세특까지</p>
    </div>
    <div style="padding:40px 36px;">
      <p style="margin:0 0 28px;color:#44403C;font-size:15px;line-height:1.8;">
        안녕하세요${name ? `, <strong style="color:#92400E;">${name}</strong> 선생님` : ''}!<br>
        아래 버튼을 클릭해 비밀번호를 재설정해주세요.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#F59E0B 0%,#EA580C 100%);color:#fff;font-size:15px;font-weight:900;text-decoration:none;padding:16px 44px;border-radius:14px;box-shadow:0 6px 20px rgba(245,158,11,0.40);letter-spacing:-0.2px;">
          비밀번호 재설정하기 →
        </a>
      </div>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:16px 20px;margin-top:8px;">
        <p style="margin:0;color:#92400E;font-size:12px;line-height:1.7;text-align:center;">
          ⏱ 링크는 발송 후 1시간 동안 유효합니다.<br>
          본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.
        </p>
      </div>
    </div>
    <div style="background:linear-gradient(135deg,#FEF3C7,#FDE68A);padding:18px 36px;text-align:center;border-top:1px solid #FDE68A;">
      <p style="margin:0;color:#92400E;font-size:12px;font-weight:700;">감사합니다. AKLABS 드림 ✦</p>
    </div>
  </div>
</body>
</html>`;
}
