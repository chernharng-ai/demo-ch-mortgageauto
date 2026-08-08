-- The officer's real standard template (the WhatsApp form sent to property
-- agents) becomes the active tally template. The original 15-field demo
-- template stays for existing submissions but is deactivated.
alter table template_fields add column if not exists section text;

insert into templates (id, name, description, is_active) values
  ('a1000000-0000-0000-0000-000000000002', 'Agent Loan Application Request v1', 'Officer''s standard WhatsApp form sent to property agents — raw agent info is converted into this template, missing fields flagged', false)
on conflict (id) do nothing;

insert into template_fields (id, template_id, field_key, field_label, field_type, is_required, sort_order, section) values
  ('b2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'name', 'Name', 'text', true, 1, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'nric', 'NRIC', 'text', true, 2, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'contact_no', 'Contact No.', 'text', true, 3, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'email', 'Email', 'text', true, 4, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'height', 'Height', 'text', false, 5, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'weight', 'Weight', 'text', false, 6, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 'mother_name', 'Mother''s Full Name', 'text', false, 7, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'residence_address', 'Residence Address', 'text', false, 8, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 'own_or_rental', 'Own or Rental', 'text', false, 9, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', 'years_of_residence', 'Years of Residence', 'text', false, 10, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000002', 'highest_education', 'Highest education', 'text', false, 11, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000002', 'race', 'Race', 'text', false, 12, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000002', 'religion', 'Religion', 'text', false, 13, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000014', 'a1000000-0000-0000-0000-000000000002', 'bumiputera', 'Bumiputera (Yes / No)', 'text', false, 14, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000015', 'a1000000-0000-0000-0000-000000000002', 'marital_status', 'Marital Status', 'text', true, 15, 'PERSONAL INFO'),
  ('b2000000-0000-0000-0000-000000000016', 'a1000000-0000-0000-0000-000000000002', 'spouse_name', 'Spouse Name', 'text', false, 16, 'SPOUSE INFO'),
  ('b2000000-0000-0000-0000-000000000017', 'a1000000-0000-0000-0000-000000000002', 'spouse_nric', 'Spouse NRIC', 'text', false, 17, 'SPOUSE INFO'),
  ('b2000000-0000-0000-0000-000000000018', 'a1000000-0000-0000-0000-000000000002', 'spouse_contact', 'Spouse Contact No', 'text', false, 18, 'SPOUSE INFO'),
  ('b2000000-0000-0000-0000-000000000019', 'a1000000-0000-0000-0000-000000000002', 'spouse_email', 'Spouse Email', 'text', false, 19, 'SPOUSE INFO'),
  ('b2000000-0000-0000-0000-000000000020', 'a1000000-0000-0000-0000-000000000002', 'spouse_occupation', 'Spouse Occupation', 'text', false, 20, 'SPOUSE INFO'),
  ('b2000000-0000-0000-0000-000000000021', 'a1000000-0000-0000-0000-000000000002', 'no_of_children', 'No. of Children', 'text', false, 21, 'SPOUSE INFO'),
  ('b2000000-0000-0000-0000-000000000022', 'a1000000-0000-0000-0000-000000000002', 'emergency_name', 'Emergency Contact Name', 'text', false, 22, 'EMERGENCY CONTACT'),
  ('b2000000-0000-0000-0000-000000000023', 'a1000000-0000-0000-0000-000000000002', 'emergency_phone', 'Emergency Phone No.', 'text', false, 23, 'EMERGENCY CONTACT'),
  ('b2000000-0000-0000-0000-000000000024', 'a1000000-0000-0000-0000-000000000002', 'emergency_address', 'Emergency Address', 'text', false, 24, 'EMERGENCY CONTACT'),
  ('b2000000-0000-0000-0000-000000000025', 'a1000000-0000-0000-0000-000000000002', 'emergency_relationship', 'Emergency Relationship', 'text', false, 25, 'EMERGENCY CONTACT'),
  ('b2000000-0000-0000-0000-000000000026', 'a1000000-0000-0000-0000-000000000002', 'company_name', 'Company Name', 'text', true, 26, 'EMPLOYMENT DETAILS'),
  ('b2000000-0000-0000-0000-000000000027', 'a1000000-0000-0000-0000-000000000002', 'company_address', 'Company Address', 'text', false, 27, 'EMPLOYMENT DETAILS'),
  ('b2000000-0000-0000-0000-000000000028', 'a1000000-0000-0000-0000-000000000002', 'occupation', 'Occupation', 'text', true, 28, 'EMPLOYMENT DETAILS'),
  ('b2000000-0000-0000-0000-000000000029', 'a1000000-0000-0000-0000-000000000002', 'office_tel', 'Office Tel (LANDLINE)', 'text', false, 29, 'EMPLOYMENT DETAILS'),
  ('b2000000-0000-0000-0000-000000000030', 'a1000000-0000-0000-0000-000000000002', 'hr_email', 'HR Company Email', 'text', false, 30, 'EMPLOYMENT DETAILS'),
  ('b2000000-0000-0000-0000-000000000031', 'a1000000-0000-0000-0000-000000000002', 'date_of_joining', 'Date of Joining', 'text', false, 31, 'EMPLOYMENT DETAILS'),
  ('b2000000-0000-0000-0000-000000000032', 'a1000000-0000-0000-0000-000000000002', 'length_of_service', 'Length of Service', 'text', false, 32, 'EMPLOYMENT DETAILS'),
  ('b2000000-0000-0000-0000-000000000033', 'a1000000-0000-0000-0000-000000000002', 'nature_of_business', 'Nature of Business', 'text', false, 33, 'EMPLOYMENT DETAILS'),
  ('b2000000-0000-0000-0000-000000000034', 'a1000000-0000-0000-0000-000000000002', 'prev_company_name', 'Previous Company Name', 'text', false, 34, 'PREVIOUS EMPLOYMENT'),
  ('b2000000-0000-0000-0000-000000000035', 'a1000000-0000-0000-0000-000000000002', 'prev_occupation', 'Previous Occupation', 'text', false, 35, 'PREVIOUS EMPLOYMENT'),
  ('b2000000-0000-0000-0000-000000000036', 'a1000000-0000-0000-0000-000000000002', 'prev_nature_of_business', 'Previous Nature of Business', 'text', false, 36, 'PREVIOUS EMPLOYMENT'),
  ('b2000000-0000-0000-0000-000000000037', 'a1000000-0000-0000-0000-000000000002', 'prev_length_of_service', 'Previous Length in Service', 'text', false, 37, 'PREVIOUS EMPLOYMENT')
on conflict (id) do nothing;

update templates set is_active = false where id = 'a1000000-0000-0000-0000-000000000001';
update templates set is_active = true  where id = 'a1000000-0000-0000-0000-000000000002';
