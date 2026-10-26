revoke execute on function public.is_org_member(uuid, text[]) from public, anon;
grant execute on function public.is_org_member(uuid, text[]) to authenticated;
