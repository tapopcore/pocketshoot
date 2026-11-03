alter table public.product_assets drop constraint product_assets_view_type_check;
alter table public.product_assets add constraint product_assets_view_type_check check (view_type in ('front','angle','side','back','detail','other'));
