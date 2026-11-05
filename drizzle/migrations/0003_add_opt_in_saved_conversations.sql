ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS save_conversations boolean NOT NULL DEFAULT false;

CREATE TABLE public.saved_conversations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  agent text NOT NULL DEFAULT 'XPLO Security Core',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_conversations_title_len CHECK (char_length(title) <= 120),
  CONSTRAINT saved_conversations_agent_len CHECK (char_length(agent) <= 80),
  CONSTRAINT saved_conversations_messages_array CHECK (jsonb_typeof(messages) = 'array' AND jsonb_array_length(messages) <= 40)
);

CREATE INDEX saved_conversations_user_updated_idx ON public.saved_conversations (user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_conversations TO authenticated;
GRANT ALL ON public.saved_conversations TO service_role;

ALTER TABLE public.saved_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own saved conversations" ON public.saved_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own saved conversations" ON public.saved_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own saved conversations" ON public.saved_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own saved conversations" ON public.saved_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);