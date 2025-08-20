alter table "public"."case_event" add column "data_record_version" text;

alter table "public"."case_event" add column "data_source_agency" text;

alter table "public"."case_event" add column "data_source_system" text;

alter table "public"."case_event" add column "last_updated" timestamp with time zone;

alter table "public"."case_event" add column "record_owner_agency" text;

alter table "public"."case_event" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."comment" add column "data_record_version" text;

alter table "public"."comment" add column "data_source_agency" text;

alter table "public"."comment" add column "data_source_system" text;

alter table "public"."comment" add column "last_updated" timestamp with time zone;

alter table "public"."comment" add column "record_owner_agency" text;

alter table "public"."comment" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."decision_element" add column "data_record_version" text;

alter table "public"."decision_element" add column "data_source_agency" text;

alter table "public"."decision_element" add column "data_source_system" text;

alter table "public"."decision_element" add column "expected_evaluation_data" jsonb;

alter table "public"."decision_element" add column "last_updated" timestamp with time zone;

alter table "public"."decision_element" add column "record_owner_agency" text;

alter table "public"."decision_element" add column "response_data" jsonb;

alter table "public"."decision_element" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."document" add column "data_record_version" text;

alter table "public"."document" add column "data_source_agency" text;

alter table "public"."document" add column "data_source_system" text;

alter table "public"."document" add column "document_files" jsonb;

alter table "public"."document" add column "last_updated" timestamp with time zone;

alter table "public"."document" add column "record_owner_agency" text;

alter table "public"."document" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."document" alter column "document_summary" set data type jsonb using "document_summary"::jsonb;

alter table "public"."document" alter column "document_toc" set data type jsonb using "document_toc"::jsonb;

alter table "public"."engagement" add column "data_record_version" text;

alter table "public"."engagement" add column "data_source_agency" text;

alter table "public"."engagement" add column "data_source_system" text;

alter table "public"."engagement" add column "last_updated" timestamp with time zone;

alter table "public"."engagement" add column "record_owner_agency" text;

alter table "public"."engagement" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."gis_data" add column "data_record_version" text;

alter table "public"."gis_data" add column "data_source_agency" text;

alter table "public"."gis_data" add column "data_source_system" text;

alter table "public"."gis_data" add column "last_updated" timestamp with time zone;

alter table "public"."gis_data" add column "record_owner_agency" text;

alter table "public"."gis_data" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."gis_data_element" add column "data_record_version" text;

alter table "public"."gis_data_element" add column "data_source_agency" text;

alter table "public"."gis_data_element" add column "data_source_system" text;

alter table "public"."gis_data_element" add column "last_updated" timestamp with time zone;

alter table "public"."gis_data_element" add column "record_owner_agency" text;

alter table "public"."gis_data_element" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."legal_structure" add column "data_record_version" text;

alter table "public"."legal_structure" add column "data_source_agency" text;

alter table "public"."legal_structure" add column "data_source_system" text;

alter table "public"."legal_structure" add column "last_updated" timestamp with time zone;

alter table "public"."legal_structure" add column "record_owner_agency" text;

alter table "public"."legal_structure" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."process_decision_payload" add column "data_record_version" text;

alter table "public"."process_decision_payload" add column "data_source_agency" text;

alter table "public"."process_decision_payload" add column "data_source_system" text;

alter table "public"."process_decision_payload" add column "last_updated" timestamp with time zone;

alter table "public"."process_decision_payload" add column "record_owner_agency" text;

alter table "public"."process_decision_payload" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."process_decision_payload" alter column "result_data" set data type jsonb using "result_data"::jsonb;

alter table "public"."process_instance" add column "data_record_version" text;

alter table "public"."process_instance" add column "data_source_agency" text;

alter table "public"."process_instance" add column "data_source_system" text;

alter table "public"."process_instance" add column "last_updated" timestamp with time zone;

alter table "public"."process_instance" add column "process_code" text;

alter table "public"."process_instance" add column "record_owner_agency" text;

alter table "public"."process_instance" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."process_model" add column "data_record_version" text;

alter table "public"."process_model" add column "data_source_agency" text;

alter table "public"."process_model" add column "data_source_system" text;

alter table "public"."process_model" add column "last_updated" timestamp with time zone;

alter table "public"."process_model" add column "record_owner_agency" text;

alter table "public"."process_model" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."project" add column "data_record_version" text;

alter table "public"."project" add column "data_source_agency" text;

alter table "public"."project" add column "data_source_system" text;

alter table "public"."project" add column "last_updated" timestamp with time zone;

alter table "public"."project" add column "record_owner_agency" text;

alter table "public"."project" add column "retrieved_timestamp" timestamp with time zone;

alter table "public"."user_role" add column "data_record_version" text;

alter table "public"."user_role" add column "data_source_agency" text;

alter table "public"."user_role" add column "data_source_system" text;

alter table "public"."user_role" add column "last_updated" timestamp with time zone;

alter table "public"."user_role" add column "record_owner_agency" text;

alter table "public"."user_role" add column "retrieved_timestamp" timestamp with time zone;


