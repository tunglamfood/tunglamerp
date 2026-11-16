-- Demo logins for the dealer portal (demo OTP 123123 while PORTAL_DEMO_OTP is set).
-- Obviously fake phone numbers (+60 11-0000 000x) so no real dealer can be reached.
-- Turn them off (active = false) or delete them before go-live.
begin;
insert into sales_reps (code, name, phone) values ('DEMO-REP', 'Demo Sales Rep', '+601100000009')
on conflict (code) do nothing;

insert into sales_rep_customers (rep_code, customer_code)
select 'DEMO-REP', code from sales_customers where code in ('3030/0003', '3030/0084', '3030/0103')
on conflict do nothing;

insert into portal_accounts (phone, name, role, customer_code, rep_code) values
  ('+601100000001', 'Demo · Four Three Three', 'dealer', '3030/0003', null),
  ('+601100000002', 'Demo · Poon Lee',         'dealer', '3030/0084', null),
  ('+601100000003', 'Demo · Guan Hing',        'dealer', '3030/0103', null),
  ('+601100000009', 'Demo Sales Rep',          'rep',    null,        'DEMO-REP')
on conflict (phone) do nothing;
commit;
