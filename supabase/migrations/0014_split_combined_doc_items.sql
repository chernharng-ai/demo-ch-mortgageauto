-- "EA Form / Income Tax (BE Form)" and "Offer Letter / SPA" were single
-- checklist items, but per the officer these are four different documents
-- that must be collected and ticked separately.

-- 1. Bank requirements (drives the checklist for new cases).
update banks
set doc_requirements = (doc_requirements - 'EA Form / Income Tax (BE Form)' - 'Offer Letter / SPA')
  || '["EA Form", "Income Tax (BE Form)", "Offer Letter", "SPA"]'::jsonb
where doc_requirements ? 'EA Form / Income Tax (BE Form)' or doc_requirements ? 'Offer Letter / SPA';

-- 2. Existing cases: split each combined row into its two documents,
--    keeping the bank linkage and status, then remove the combined rows.
insert into document_items (case_id, user_id, bank_id, doc_name, status, received_at)
select case_id, user_id, bank_id, 'EA Form', status, received_at
from document_items where doc_name = 'EA Form / Income Tax (BE Form)';

insert into document_items (case_id, user_id, bank_id, doc_name, status, received_at)
select case_id, user_id, bank_id, 'Income Tax (BE Form)', status, received_at
from document_items where doc_name = 'EA Form / Income Tax (BE Form)';

insert into document_items (case_id, user_id, bank_id, doc_name, status, received_at)
select case_id, user_id, bank_id, 'Offer Letter', status, received_at
from document_items where doc_name = 'Offer Letter / SPA';

insert into document_items (case_id, user_id, bank_id, doc_name, status, received_at)
select case_id, user_id, bank_id, 'SPA', status, received_at
from document_items where doc_name = 'Offer Letter / SPA';

delete from document_items where doc_name in ('EA Form / Income Tax (BE Form)', 'Offer Letter / SPA');

-- 3. Documents filed under a combined name go back to unmatched so the
--    officer (or a re-read) files them under the right split item.
update case_documents set matched_doc_name = null
where matched_doc_name in ('EA Form / Income Tax (BE Form)', 'Offer Letter / SPA');

-- 4. Orphaned sub-item chips under the combined names.
delete from document_sub_items where doc_name in ('EA Form / Income Tax (BE Form)', 'Offer Letter / SPA');
