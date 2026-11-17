-- Commission: a rate per rep on the value of delivered orders for their dealers.
alter table sales_reps add column if not exists commission_rate numeric(5, 2);
alter table sales_reps add constraint sales_reps_commission_ck check (commission_rate is null or (commission_rate >= 0 and commission_rate <= 50));

create or replace function portal_rep_commission(p_rep text, p_on date default null)
returns table (commission_rate numeric, delivered_value numeric, commission numeric)
language sql stable as $$
  with d as (select date_trunc('month', coalesce(p_on, sales_today()))::date as m0, coalesce(p_on, sales_today()) as on_date),
  rep as (select commission_rate from sales_reps where code = p_rep),
  dv as (
    select coalesce(round(sum(l.qty * l.price), 2), 0) as v
      from sales_order_lines l
      join sales_orders o on o.id = l.order_id, d
     where o.customer_code in (select customer_code from sales_rep_customers where rep_code = p_rep)
       and o.status = 'delivered'
       and o.order_date between d.m0 and d.on_date
  )
  select (select commission_rate from rep),
         (select v from dv),
         case when (select commission_rate from rep) is null then null
              else round((select v from dv) * (select commission_rate from rep) / 100, 2) end
$$;
