-- ══════════════════════════════════════════════════════════
-- 조(Group) 기능 스키마
-- Supabase SQL Editor에서 실행하세요
-- ══════════════════════════════════════════════════════════

-- 1. 클래스별 조 테이블
CREATE TABLE IF NOT EXISTS public.class_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366F1',
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, name)
);

-- 2. 조 멤버 테이블
CREATE TABLE IF NOT EXISTS public.class_group_members (
  group_id   UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id)     ON DELETE CASCADE,
  PRIMARY KEY (group_id, student_id)
);

-- 3. student_results에 조별 제출 컬럼 추가
ALTER TABLE public.student_results
  ADD COLUMN IF NOT EXISTS group_id          UUID    REFERENCES public.class_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_group_submission BOOLEAN DEFAULT FALSE;

-- 4. RLS 활성화
ALTER TABLE public.class_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_group_members ENABLE ROW LEVEL SECURITY;

-- 5. class_groups RLS
--    선생님: 자신의 클래스에 대해 CRUD
--    모두: SELECT (학생 제출 시 조 정보 조회 필요)
DROP POLICY IF EXISTS "teacher_manage_class_groups"  ON public.class_groups;
DROP POLICY IF EXISTS "public_read_class_groups"     ON public.class_groups;

CREATE POLICY "teacher_manage_class_groups"
  ON public.class_groups
  FOR ALL
  USING (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE teacher_id = auth.uid())
  );

CREATE POLICY "public_read_class_groups"
  ON public.class_groups
  FOR SELECT
  USING (true);

-- 6. class_group_members RLS
DROP POLICY IF EXISTS "teacher_manage_group_members" ON public.class_group_members;
DROP POLICY IF EXISTS "public_read_group_members"    ON public.class_group_members;

CREATE POLICY "teacher_manage_group_members"
  ON public.class_group_members
  FOR ALL
  USING (
    group_id IN (
      SELECT cg.id FROM public.class_groups cg
      JOIN public.classes c ON c.id = cg.class_id
      WHERE c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT cg.id FROM public.class_groups cg
      JOIN public.classes c ON c.id = cg.class_id
      WHERE c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "public_read_group_members"
  ON public.class_group_members
  FOR SELECT
  USING (true);

-- 7. 조별 일괄 제출 RPC
--    대표 학생이 제출하면 같은 조 모든 멤버에게 동일 내용 복사
CREATE OR REPLACE FUNCTION public.submit_as_group(
  p_group_id    UUID,
  p_class_id    UUID,
  p_week_number INT,
  p_title       TEXT,
  p_text_content TEXT DEFAULT NULL,
  p_link_url    TEXT DEFAULT NULL,
  p_result_type TEXT DEFAULT 'text'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_member    RECORD;
  v_base      RECORD;
  v_inserted  INT := 0;
BEGIN
  -- 조 멤버 순회하며 각자에게 결과 삽입 (중복 시 업데이트)
  FOR v_member IN
    SELECT cgm.student_id
    FROM public.class_group_members cgm
    WHERE cgm.group_id = p_group_id
  LOOP
    -- 기존 결과 삭제 후 재삽입 (주차+학생 기준)
    DELETE FROM public.student_results
    WHERE student_id    = v_member.student_id
      AND class_id      = p_class_id
      AND week_number   = p_week_number
      AND result_type   = p_result_type
      AND is_group_submission = TRUE;

    INSERT INTO public.student_results
      (student_id, class_id, week_number, title, text_content, link_url,
       result_type, group_id, is_group_submission)
    VALUES
      (v_member.student_id, p_class_id, p_week_number, p_title,
       p_text_content, p_link_url, p_result_type, p_group_id, TRUE);

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'inserted', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_as_group TO anon, authenticated;

SELECT 'GROUP_SCHEMA 적용 완료' AS result;
