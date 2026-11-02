REVOKE ALL ON public.execution_permissions, public.execution_scopes, public.execution_sessions, public.execution_commands, public.execution_audit FROM anon, authenticated;
GRANT SELECT ON public.execution_permissions, public.execution_scopes, public.execution_sessions, public.execution_commands, public.execution_audit TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.execution_audit FROM service_role;
GRANT SELECT, INSERT ON public.execution_audit TO service_role;