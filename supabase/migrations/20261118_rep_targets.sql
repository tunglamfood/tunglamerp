-- A standing monthly sales target per rep, and their progress this month.
alter table sales_reps add column if not exists monthly_target numeric(12, 2);

-- A rep's month so far: the value of orders for the dealers they look after
-- (any source, not cancelled or draft), against their monthly target.
create or replace function portal_rep_progress(p_rep text, p_on date default null)
returns table (target numeric, value numeric, orders integer, unpriced_lines integer, month_start date)
language sql stable as $$
  with d as (select date_trunc('month', coalesce(p_on, sales_today()))::date as m0, coalesce(p_on, sales_today()) as on_date),
  mine as (
    select o.id from sales_orders o, d
     where o.customer_code in (select customer_code from sales_rep_customers where rep_code = p_rep)
       and o.status not in ('cancelled', 'draft')
       and o.order_date between d.m0 and d.on_date
  )
  select (select monthly_target from sales_reps where code = p_rep),
         coalesce((select round(sum(l.qty * l.price), 2) from sales_order_lines l where l.order_id in (select id from mine)), 0),
         (select count(*)::int from mine),
         (select count(*)::int from sales_order_lines l where l.order_id in (select id from mine) and not (l.price > 0)),
         (select m0 from d)
$$;
