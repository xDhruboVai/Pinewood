-- Repair schema drift in projects where the initial menu item columns were absent.
alter table public.menu_items
  add column if not exists price_label_en text,
  add column if not exists price_label_bn text;
