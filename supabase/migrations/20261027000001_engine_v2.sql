-- Engine v2: per-image scene and AI shot direction, multi-scene jobs, GPT Image 2.5 defaults.
alter table public.generation_items add column if not exists style text;
alter table public.generation_items add column if not exists params jsonb not null default '{}';

update public.app_settings
set value = value
  || jsonb_build_object('generation', 'openai')
  || jsonb_build_object('openai', jsonb_build_object(
       'model', 'gpt-image-2.5-sunburst',
       'models', jsonb_build_array('gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2'),
       'quality', 'high',
       'legacyQuality', 'medium'))
  || jsonb_build_object('costUsdPerImage', coalesce(value->'costUsdPerImage', '{}'::jsonb) || '{"openai":0.06}'::jsonb),
    updated_at = now()
where key = 'providers';
