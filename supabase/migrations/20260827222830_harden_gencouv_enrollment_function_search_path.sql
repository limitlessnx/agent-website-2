alter function public.gencouv_prepare_daily_enrollments(uuid, text, integer)
  set search_path = public, pg_temp;

alter function public.gencouv_mark_enrollment_send_result(uuid, boolean, text, text)
  set search_path = public, pg_temp;
