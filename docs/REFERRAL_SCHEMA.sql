-- ══════════════════════════════════════════════════════════
-- 추천인(Referral) 시스템 스키마
-- Supabase SQL Editor에서 실행하세요
-- ══════════════════════════════════════════════════════════

-- 1. 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. 유니크 추천 코드 생성 헬퍼 함수
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code     TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    -- 'SANG' + 대문자 영숫자 6자
    code := 'SANG' || upper(substring(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE referral_code = code
    );
    attempts := attempts + 1;
    IF attempts > 200 THEN
      RAISE EXCEPTION 'Cannot generate unique referral code after 200 attempts';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- 3. 기존 유저 코드 일괄 채우기
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- 4. 신규 유저 INSERT 시 코드 자동 부여 트리거
CREATE OR REPLACE FUNCTION public.assign_referral_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_referral_code_trigger ON public.profiles;
CREATE TRIGGER assign_referral_code_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_referral_code_on_insert();

-- 5. apply_referral_code RPC 함수
--    추천인과 신규 가입자 양쪽에 7일 베타 지급
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_current_id   UUID := auth.uid();
  v_referrer_id  UUID;
  v_current      RECORD;
  v_bonus_days   INT  := 7;
  v_new_expires  TIMESTAMPTZ;
BEGIN
  -- 현재 사용자 프로필
  SELECT * INTO v_current FROM public.profiles WHERE id = v_current_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
  END IF;

  -- 이미 추천인 등록된 경우
  IF v_current.referred_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_USED');
  END IF;

  -- 추천 코드로 추천인 조회
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = upper(trim(p_code));

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  -- 자기 자신 추천 방지
  IF v_referrer_id = v_current_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_REFERRAL');
  END IF;

  -- 신규 가입자 베타 +7일
  v_new_expires := GREATEST(COALESCE(v_current.beta_expires_at, NOW()), NOW())
                   + (v_bonus_days || ' days')::INTERVAL;

  UPDATE public.profiles
  SET
    referred_by     = v_referrer_id,
    beta_expires_at = v_new_expires
  WHERE id = v_current_id;

  -- 추천인 베타 +7일
  UPDATE public.profiles
  SET beta_expires_at = GREATEST(COALESCE(beta_expires_at, NOW()), NOW())
                        + (v_bonus_days || ' days')::INTERVAL
  WHERE id = v_referrer_id;

  RETURN jsonb_build_object(
    'success',     true,
    'bonus_days',  v_bonus_days,
    'expires_at',  v_new_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT) TO authenticated;

-- 6. RLS: referral_code / referred_by 는 본인 프로필에만 쓰기 가능
--    (profiles RLS가 이미 활성화되어 있다고 가정 — 별도 정책 불필요)
--    referral_code는 SELECT로 누구나 읽을 수 있어야 추천 코드 검증 가능
--    → apply_referral_code 함수가 SECURITY DEFINER이므로 RLS 우회하여 검증

-- 완료
SELECT 'REFERRAL_SCHEMA 적용 완료' AS result;
