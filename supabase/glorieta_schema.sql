-- GLORIETA V1 — ejecutar exclusivamente en un proyecto Supabase nuevo.
create extension if not exists pgcrypto;
create table if not exists public.glorieta_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (length(trim(name)) between 1 and 100),
  quantity numeric(12,2) not null default 0 check(quantity >= 0),
  unit text not null default 'unidades',
  color text,
  package_size text,
  expiration_date date,
  location text,
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.glorieta_movements (
  id bigint generated always as identity primary key,
  product_id uuid references public.glorieta_products(id) on delete set null,
  product_name text not null,
  kind text not null check (kind in ('entrada','salida','ajuste','creacion','eliminacion')),
  delta numeric(12,2) not null,
  previous_qty numeric(12,2) not null,
  new_qty numeric(12,2) not null,
  operator_name text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists glorieta_movements_created on public.glorieta_movements(created_at desc);
create index if not exists glorieta_products_name on public.glorieta_products(name);
alter table public.glorieta_products enable row level security;
alter table public.glorieta_movements enable row level security;
revoke all on table public.glorieta_products, public.glorieta_movements from anon, authenticated;
revoke all on sequence public.glorieta_movements_id_seq from anon, authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('glorieta-photos','glorieta-photos',false,1048576,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Atomic stock change. Called only by service_role from trusted Edge Function.
create or replace function public.glorieta_stock_change(
 p_id uuid, p_kind text, p_amount numeric, p_operator text, p_note text default null
) returns public.glorieta_products
language plpgsql
security invoker
set search_path = ''
as $$
declare p public.glorieta_products;
begin
 if p_kind not in ('entrada','salida') or p_amount <= 0 or p_amount > 1000000
 or length(trim(p_operator)) < 1 or length(p_operator) > 100 then
   raise exception 'Movimiento inválido';
 end if;
 select * into p from public.glorieta_products where id=p_id for update;
 if not found then raise exception 'Producto inexistente'; end if;
 if p_kind='salida' and p.quantity < p_amount then raise exception 'Stock insuficiente'; end if;
 update public.glorieta_products
   set quantity=quantity+case when p_kind='entrada' then p_amount else -p_amount end,
       updated_at=now()
   where id=p_id returning * into p;
 insert into public.glorieta_movements(product_id,product_name,kind,delta,previous_qty,new_qty,operator_name,note)
 values(p_id,p.name,p_kind,case when p_kind='entrada' then p_amount else -p_amount end,
 p.quantity-case when p_kind='entrada' then p_amount else -p_amount end,p.quantity,p_operator,left(p_note,200));
 return p;
end $$;
revoke all on function public.glorieta_stock_change(uuid,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.glorieta_stock_change(uuid,text,numeric,text,text) to service_role;

create or replace function public.glorieta_create_product(
 p_code text, p_name text, p_qty numeric, p_unit text,
 p_operator text, p_color text default null, p_package text default null,
 p_expiration date default null, p_location text default null, p_notes text default null,
 p_photo_path text default null
) returns public.glorieta_products
language plpgsql security invoker set search_path=''
as $$
declare p public.glorieta_products;
begin
 if p_qty < 0 or p_qty > 1000000 or length(trim(p_name))=0 then raise exception 'Producto inválido'; end if;
 insert into public.glorieta_products(code,name,quantity,unit,color,package_size,expiration_date,location,notes,photo_path)
 values(p_code,trim(p_name),p_qty,p_unit,p_color,p_package,p_expiration,p_location,p_notes,p_photo_path)
 returning * into p;
 insert into public.glorieta_movements(product_id,product_name,kind,delta,previous_qty,new_qty,operator_name,note)
 values(p.id,p.name,'creacion',p_qty,0,p_qty,p_operator,'Carga inicial');
 return p;
end $$;
revoke all on function public.glorieta_create_product(text,text,numeric,text,text,text,text,date,text,text,text) from public, anon, authenticated;
grant execute on function public.glorieta_create_product(text,text,numeric,text,text,text,text,date,text,text,text) to service_role;

create or replace function public.glorieta_update_product(
 p_id uuid, p_code text, p_name text, p_unit text, p_operator text,
 p_color text default null, p_package text default null, p_expiration date default null,
 p_location text default null, p_notes text default null, p_photo_path text default null
) returns public.glorieta_products
language plpgsql security invoker set search_path=''
as $$
declare p public.glorieta_products;
begin
 update public.glorieta_products
 set code=p_code,name=trim(p_name),unit=p_unit,color=p_color,package_size=p_package,
 expiration_date=p_expiration,location=p_location,notes=p_notes,
 photo_path=coalesce(p_photo_path,photo_path),updated_at=now()
 where id=p_id returning * into p;
 if not found then raise exception 'Producto inexistente'; end if;
 return p;
end $$;
revoke all on function public.glorieta_update_product(uuid,text,text,text,text,text,text,date,text,text,text) from public, anon, authenticated;
grant execute on function public.glorieta_update_product(uuid,text,text,text,text,text,text,date,text,text,text) to service_role;
