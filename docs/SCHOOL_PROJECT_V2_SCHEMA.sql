-- ══════════════════════════════════════════════════════════
-- SCHOOL PROJECT V2 SCHEMA — 계층형 학교 프로젝트
-- Supabase SQL Editor에서 실행하세요
-- ══════════════════════════════════════════════════════════

-- 1. classes 테이블 확장: 계층 관계 + 담당 교사
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS school_project_id  UUID REFERENCES public.school_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_class_id    UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assigned_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 인덱스 (조회 성능)
CREATE INDEX IF NOT EXISTS idx_classes_school_project_id  ON public.classes(school_project_id);
CREATE INDEX IF NOT EXISTS idx_classes_parent_class_id    ON public.classes(parent_class_id);
CREATE INDEX IF NOT EXISTS idx_classes_assigned_teacher   ON public.classes(assigned_teacher_id);

-- 2. profiles 테이블: 학교 프로젝트 기간 Pro 혜택 만료일
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS project_pro_until TIMESTAMPTZ;

-- 3. school_projects 테이블: 시작일 추가 (기존 end_date가 있으므로 start_date만 추가)
ALTER TABLE public.school_projects
  ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- 4. RLS 정책 추가: assigned_teacher_id를 통한 하위 클래스 접근
-- 기존 classes RLS가 teacher_id = auth.uid() 이므로,
-- assigned_teacher_id 조건도 SELECT에 추가

DROP POLICY IF EXISTS "assigned_teacher_read_class" ON public.classes;
CREATE POLICY "assigned_teacher_read_class"
  ON public.classes FOR SELECT
  USING (assigned_teacher_id = auth.uid());

-- 초대된 선생님이 자신의 서브클래스의 부모 클래스도 읽을 수 있음
-- weekly_plan 동기화에 필요
-- ※ classes 테이블 자기참조 서브쿼리는 RLS 재귀 루프를 유발하므로
--   SECURITY DEFINER 함수를 통해 우회

DROP FUNCTION IF EXISTS public.get_assigned_parent_class_ids();
CREATE OR REPLACE FUNCTION public.get_assigned_parent_class_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT DISTINCT parent_class_id
  FROM public.classes
  WHERE assigned_teacher_id = auth.uid()
    AND parent_class_id IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_assigned_parent_class_ids() TO authenticated;

DROP POLICY IF EXISTS "assigned_teacher_read_parent_class" ON public.classes;
CREATE POLICY "assigned_teacher_read_parent_class"
  ON public.classes FOR SELECT
  USING (
    id IN (SELECT public.get_assigned_parent_class_ids())
  );

-- assigned_teacher는 본인이 담당하는 클래스를 수정할 수 있음 (학생 관리 등)
DROP POLICY IF EXISTS "assigned_teacher_update_class" ON public.classes;
CREATE POLICY "assigned_teacher_update_class"
  ON public.classes FOR UPDATE
  USING (assigned_teacher_id = auth.uid())
  WITH CHECK (assigned_teacher_id = auth.uid());

-- 5. Pro 공유를 위한 RPC 함수: 담당 교사 지정 시 project_pro_until 업데이트
CREATE OR REPLACE FUNCTION public.assign_teacher_to_subclass(
  p_class_id      UUID,
  p_teacher_id    UUID,
  p_project_id    UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_end_date DATE;
  v_pro_until TIMESTAMPTZ;
  v_current_pro_until TIMESTAMPTZ;
BEGIN
  -- 프로젝트 종료일 조회
  SELECT end_date INTO v_end_date
  FROM public.school_projects
  WHERE id = p_project_id;

  -- classes 테이블 업데이트
  UPDATE public.classes
  SET assigned_teacher_id = p_teacher_id
  WHERE id = p_class_id;

  -- Pro 혜택 부여: 종료일이 있는 경우에만
  IF v_end_date IS NOT NULL THEN
    v_pro_until := (v_end_date + INTERVAL '1 day')::TIMESTAMPTZ;

    -- 현재 project_pro_until보다 늦은 경우에만 업데이트 (기존 혜택 단축 방지)
    SELECT project_pro_until INTO v_current_pro_until
    FROM public.profiles WHERE id = p_teacher_id;

    IF v_current_pro_until IS NULL OR v_pro_until > v_current_pro_until THEN
      UPDATE public.profiles
      SET project_pro_until = v_pro_until
      WHERE id = p_teacher_id;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_teacher_to_subclass TO authenticated;

-- 6. 담당 교사 해제 시 Pro 혜택 회수 함수
CREATE OR REPLACE FUNCTION public.remove_teacher_from_subclass(
  p_class_id   UUID,
  p_teacher_id UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_still_has_project BOOLEAN;
BEGIN
  -- 담당 해제
  UPDATE public.classes
  SET assigned_teacher_id = NULL
  WHERE id = p_class_id;

  -- 다른 학교 프로젝트에 아직 담당으로 있는지 확인
  SELECT EXISTS(
    SELECT 1 FROM public.classes
    WHERE assigned_teacher_id = p_teacher_id
      AND school_project_id IS NOT NULL
  ) INTO v_still_has_project;

  -- 다른 프로젝트가 없으면 Pro 혜택 만료
  IF NOT v_still_has_project THEN
    UPDATE public.profiles
    SET project_pro_until = NULL
    WHERE id = p_teacher_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_teacher_from_subclass TO authenticated;

SELECT 'SCHOOL_PROJECT_V2_SCHEMA 적용 완료' AS result;
