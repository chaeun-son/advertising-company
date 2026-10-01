-- Empty the shop board. Keep company, staff, and the manual price list.

delete from documents;
delete from messages;
delete from drafts;
delete from order_items;
delete from orders;
delete from clients;

select setval('documents_id_seq', 1, false);
select setval('messages_id_seq', 1, false);
select setval('drafts_id_seq', 1, false);
select setval('order_items_id_seq', 1, false);
select setval('orders_id_seq', 1, false);
select setval('clients_id_seq', 1, false);
