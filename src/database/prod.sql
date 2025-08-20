


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";













CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."export_all_tables_as_jsonb"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
  tbl         record;
  result      jsonb := '{}'::jsonb;
  table_data  jsonb;
begin
  for tbl in
    select table_name
      from information_schema.tables
     where table_schema = 'public'
       and table_type   = 'BASE TABLE'
  loop
    execute format(
      -- aggregate each row as JSONB, giving an array of objects
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb)
         from public.%I t',
      tbl.table_name
    ) into table_data;

    -- concatenate the new key/value into the result
    result := result || jsonb_build_object(tbl.table_name, table_data);
  end loop;

  return result;
end;
$$;


ALTER FUNCTION "public"."export_all_tables_as_jsonb"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."project" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "description" "text",
    "sector" "text",
    "lead_agency" "text",
    "participating_agencies" "text",
    "location_lat" double precision,
    "location_lon" double precision,
    "location_object" "json",
    "type" "text",
    "funding" "text",
    "start_date" "date",
    "current_status" "text",
    "sponsor" "text",
    "sponsor_contact" "json",
    "parent_project_id" bigint,
    "location_text" "text",
    "other" "jsonb"
);


ALTER TABLE "public"."project" OWNER TO "postgres";


COMMENT ON TABLE "public"."project" IS 'A Project represents the activity or decision requiring a NEPA review process. A project generally has a relationship with a GIS object defining its location, which is not contained in the properties below but establishes the physical footprint of the action.';



COMMENT ON COLUMN "public"."project"."id" IS 'database id';



COMMENT ON COLUMN "public"."project"."created_at" IS 'created';



COMMENT ON COLUMN "public"."project"."title" IS 'Descriptive name of the project.';



COMMENT ON COLUMN "public"."project"."description" IS 'Summary of the project’s goals and scope.';



COMMENT ON COLUMN "public"."project"."sector" IS 'High-level project category (e.g., energy, transportation, land management).';



COMMENT ON COLUMN "public"."project"."lead_agency" IS 'Federal agency that supervises preparation of the environmental documents for the project.';



COMMENT ON COLUMN "public"."project"."participating_agencies" IS 'Other involved agencies.';



COMMENT ON COLUMN "public"."project"."location_lat" IS 'Center/centroid of project (shortcut for plotting on a map - should attach GIS data object as well)';



COMMENT ON COLUMN "public"."project"."location_lon" IS 'Center/centroid of project (shortcut for plotting on a map - should attach GIS data object as well)';



COMMENT ON COLUMN "public"."project"."location_object" IS 'Container for more advanced location object if applicable or if this improves performance (should not replace gis data entity relationship)';



COMMENT ON COLUMN "public"."project"."type" IS 'Classification, a sub-type of sector (pipeline, highway, habitat restoration).';



COMMENT ON COLUMN "public"."project"."funding" IS 'Link to federal, state, local or other funding by reference (e.g., grant program, loan guarantee, appropriated funds)';



COMMENT ON COLUMN "public"."project"."start_date" IS 'Environmental review initiation date (aggregated from process status)';



COMMENT ON COLUMN "public"."project"."current_status" IS 'Current phase (pre-application, underway, paused, completed) of the NEPA, permitting, or other authorization process (aggregated from process status).';



COMMENT ON COLUMN "public"."project"."sponsor" IS 'Name of responsible entity, organization, or person.';



COMMENT ON COLUMN "public"."project"."sponsor_contact" IS 'Name of responsible entity, organization, or person (contact information json object)';



COMMENT ON COLUMN "public"."project"."parent_project_id" IS 'If nesting projects, reference to the parent project''s ID. ';



COMMENT ON COLUMN "public"."project"."location_text" IS 'Text field to specify location, eg. address. ';



COMMENT ON COLUMN "public"."project"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."project" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Project_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."case_event" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_process_id" bigint,
    "parent_event_id" bigint,
    "related_document_id" bigint,
    "name" "text",
    "description" "text",
    "source" "text",
    "type" "text",
    "public_access" boolean,
    "tier" bigint,
    "status" "text",
    "outcome" "text",
    "assigned_entity" "text",
    "datetime" timestamp with time zone,
    "following_segment_name" "text",
    "related_engagement_id" bigint,
    "other" "jsonb"
);


ALTER TABLE "public"."case_event" OWNER TO "postgres";


COMMENT ON TABLE "public"."case_event" IS 'Milestones or steps within the NEPA review, tracked in a case management system or other system, such as task management tools or reporting dashboards.';



COMMENT ON COLUMN "public"."case_event"."id" IS 'database id';



COMMENT ON COLUMN "public"."case_event"."created_at" IS 'created';



COMMENT ON COLUMN "public"."case_event"."parent_process_id" IS 'Reference to Process ID of the associated NEPA process for this event.';



COMMENT ON COLUMN "public"."case_event"."parent_event_id" IS 'If applicable, the parent ID of the event. ';



COMMENT ON COLUMN "public"."case_event"."related_document_id" IS ' Reference to Document ID of the document related to the event. Optional.';



COMMENT ON COLUMN "public"."case_event"."name" IS 'Name of event';



COMMENT ON COLUMN "public"."case_event"."description" IS 'Description of event. ';



COMMENT ON COLUMN "public"."case_event"."source" IS 'Link to information about the event.';



COMMENT ON COLUMN "public"."case_event"."type" IS 'Event class (e.g., NOI, ROD)';



COMMENT ON COLUMN "public"."case_event"."public_access" IS 'Indicates whether events can be displayed publicly. (Binary Y/N)';



COMMENT ON COLUMN "public"."case_event"."tier" IS 'Optional event hierarchy (e.g., Tier 1 NOI, Tier 2 Scoping Complete, Tier 3 Task assigned to Jane Doe). ';



COMMENT ON COLUMN "public"."case_event"."status" IS 'Pending, completed, in progress.';



COMMENT ON COLUMN "public"."case_event"."outcome" IS 'Result or action taken.';



COMMENT ON COLUMN "public"."case_event"."assigned_entity" IS 'Responsible individuals or agencies.';



COMMENT ON COLUMN "public"."case_event"."datetime" IS 'Date and time of event';



COMMENT ON COLUMN "public"."case_event"."following_segment_name" IS 'Name of segment following this event (e.g. if this is "start of scoping" the next segment is "scoping").';



COMMENT ON COLUMN "public"."case_event"."related_engagement_id" IS 'Related engagement event if applicable';



COMMENT ON COLUMN "public"."case_event"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."case_event" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."case_event_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comment" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_document_id" bigint,
    "commenter_entity" "text",
    "date_submitted" "date",
    "submission_method" "text",
    "content_text" "text",
    "content_json" "json",
    "response_text" "text",
    "response_json" "json",
    "public_source" boolean,
    "public_acess" boolean,
    "other" "jsonb"
);


ALTER TABLE "public"."comment" OWNER TO "postgres";


COMMENT ON TABLE "public"."comment" IS 'Feedback submitted by individuals or organizations.';



COMMENT ON COLUMN "public"."comment"."id" IS 'database id';



COMMENT ON COLUMN "public"."comment"."created_at" IS 'created';



COMMENT ON COLUMN "public"."comment"."parent_document_id" IS 'Reference to Document ID of the document to which the comment is related.';



COMMENT ON COLUMN "public"."comment"."commenter_entity" IS 'Individual or organization.';



COMMENT ON COLUMN "public"."comment"."date_submitted" IS 'Submission date.';



COMMENT ON COLUMN "public"."comment"."submission_method" IS 'Online, email, mail, in-person.';



COMMENT ON COLUMN "public"."comment"."content_text" IS 'Text of the comment.';



COMMENT ON COLUMN "public"."comment"."content_json" IS 'Text of the comment (json object if applicable)';



COMMENT ON COLUMN "public"."comment"."response_text" IS 'Formal reply, if applicable.';



COMMENT ON COLUMN "public"."comment"."response_json" IS 'Formal reply, if applicable. (json object if applicable)';



COMMENT ON COLUMN "public"."comment"."public_source" IS 'Whether comment came from member of the public';



COMMENT ON COLUMN "public"."comment"."public_acess" IS 'Whether comment should be viewed by public';



COMMENT ON COLUMN "public"."comment"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."comment" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."comment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."decision_element" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "process_model" bigint,
    "legal_structure_id" bigint,
    "title" "text",
    "description" "text",
    "measure" "text",
    "threshold" double precision,
    "spatial" boolean,
    "intersect" boolean,
    "spatial_reference" "json",
    "form_text" "text",
    "form_response_desc" "text",
    "form_data" "json",
    "evaluation_method" "text",
    "evaluation_dmn" "json",
    "category" "text",
    "process_model_internal_reference_id" "text",
    "parent_decision_element_id" bigint,
    "other" "jsonb"
);


ALTER TABLE "public"."decision_element" OWNER TO "postgres";


COMMENT ON TABLE "public"."decision_element" IS 'Objects that describe conditions for starting a process or resolving a decision tree within a process, including GIS screening.';



COMMENT ON COLUMN "public"."decision_element"."id" IS 'database id';



COMMENT ON COLUMN "public"."decision_element"."created_at" IS 'created';



COMMENT ON COLUMN "public"."decision_element"."process_model" IS 'Parent process model';



COMMENT ON COLUMN "public"."decision_element"."legal_structure_id" IS 'If applicable, legal structure related to specific criteria';



COMMENT ON COLUMN "public"."decision_element"."title" IS 'Name of element';



COMMENT ON COLUMN "public"."decision_element"."description" IS 'Plain language description of the criterion';



COMMENT ON COLUMN "public"."decision_element"."measure" IS 'A description of the type of thing being measured in the criteria (e.g. threshold of contamination)';



COMMENT ON COLUMN "public"."decision_element"."threshold" IS 'numeric value of the triggering measure (if applicable)';



COMMENT ON COLUMN "public"."decision_element"."spatial" IS 'Whether the criterion is a spatial relationship';



COMMENT ON COLUMN "public"."decision_element"."intersect" IS 'If the spatial relationship is a simple intersection (e.g. floodplain)';



COMMENT ON COLUMN "public"."decision_element"."spatial_reference" IS ' A container for reference to the screening criteria (e.g. api call for wetland data)';



COMMENT ON COLUMN "public"."decision_element"."form_text" IS 'Text data to display on a screening form for a user to input data';



COMMENT ON COLUMN "public"."decision_element"."form_response_desc" IS 'A description of the type of response expected on the form (e.g. text, select from list, number)';



COMMENT ON COLUMN "public"."decision_element"."form_data" IS 'Formatted response for a formbuilder application (e.g. likert scale, number, etc)';



COMMENT ON COLUMN "public"."decision_element"."evaluation_method" IS 'A description of how the response is matched against the condition and what the results could be. ';



COMMENT ON COLUMN "public"."decision_element"."evaluation_dmn" IS 'Decision Model Notation description of evaluation of decision element.';



COMMENT ON COLUMN "public"."decision_element"."category" IS 'The category of the process decision element, such as limitation, condition, core, or extraordinary circumstances.';



COMMENT ON COLUMN "public"."decision_element"."process_model_internal_reference_id" IS 'Process models may have complex decision trees - this string can reference the specific piece of the process model that this decision element applies to. ';



COMMENT ON COLUMN "public"."decision_element"."parent_decision_element_id" IS 'If this decision element depends on another decision element (e.g. if answer a is yes, ask question b), this field can be used to reference the parent decision element. ';



COMMENT ON COLUMN "public"."decision_element"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



CREATE TABLE IF NOT EXISTS "public"."document" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_process_id" bigint,
    "related_document_id" bigint,
    "title" "text",
    "volume_title" "text",
    "document_revision" "text",
    "revision_no" bigint,
    "supplement_no" bigint,
    "publish_date" "date",
    "prepared_by" "text",
    "status" "text",
    "public_access" boolean,
    "url" "text",
    "notes" "text",
    "document_summary" "json",
    "document_toc" "json",
    "document_type" "text",
    "other" "jsonb"
);


ALTER TABLE "public"."document" OWNER TO "postgres";


COMMENT ON TABLE "public"."document" IS 'The document object includes both metadata identifying the document and its context (below) and a container for summary information that lays out, at a minimum, the table of contents (or heading structure) of the document. See Document Structure section below.  
Documents are also likely to have many GIS objects associated with them, usually in the past flattened to images but potentially represented as data in future systems.';



COMMENT ON COLUMN "public"."document"."id" IS 'database id';



COMMENT ON COLUMN "public"."document"."created_at" IS 'creation date';



COMMENT ON COLUMN "public"."document"."parent_process_id" IS 'Reference to Process ID of parent process for the document';



COMMENT ON COLUMN "public"."document"."related_document_id" IS 'Unique identification number for related document (if applicable)';



COMMENT ON COLUMN "public"."document"."title" IS 'Document title.';



COMMENT ON COLUMN "public"."document"."volume_title" IS 'Volume title (e.g., Appendix)';



COMMENT ON COLUMN "public"."document"."document_revision" IS 'Indicates which revision of the document (e.g., first revised Draft EIS).';



COMMENT ON COLUMN "public"."document"."revision_no" IS 'Indicates which revision of the document (e.g., first revised Draft EIS) - numeric form';



COMMENT ON COLUMN "public"."document"."supplement_no" IS 'Indicates supplement number';



COMMENT ON COLUMN "public"."document"."publish_date" IS 'Publication or submission date.';



COMMENT ON COLUMN "public"."document"."prepared_by" IS 'Responsible entity.';



COMMENT ON COLUMN "public"."document"."status" IS 'Document production phase. ';



COMMENT ON COLUMN "public"."document"."public_access" IS 'Public or restricted.';



COMMENT ON COLUMN "public"."document"."url" IS 'Online link if available.';



COMMENT ON COLUMN "public"."document"."notes" IS 'Miscellaneous notes.';



COMMENT ON COLUMN "public"."document"."document_summary" IS 'container for summary information';



COMMENT ON COLUMN "public"."document"."document_toc" IS 'the table of contents (or heading structure) of the document.';



COMMENT ON COLUMN "public"."document"."document_type" IS 'Document category, such as EIS, EA, etc. ';



COMMENT ON COLUMN "public"."document"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."document" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."document_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."engagement" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_process_id" bigint,
    "type" "text",
    "location" "text",
    "related_document_id" bigint,
    "attendance" bigint,
    "participation" "json",
    "notes" "text",
    "start_datetime" timestamp with time zone,
    "end_datetime" timestamp with time zone,
    "other" "jsonb"
);


ALTER TABLE "public"."engagement" OWNER TO "postgres";


COMMENT ON TABLE "public"."engagement" IS 'Opportunities for interaction in the NEPA process, including formal consultation.';



COMMENT ON COLUMN "public"."engagement"."id" IS 'database id';



COMMENT ON COLUMN "public"."engagement"."created_at" IS 'created';



COMMENT ON COLUMN "public"."engagement"."parent_process_id" IS 'If associated with a process, the related process ID';



COMMENT ON COLUMN "public"."engagement"."type" IS 'Optional category or other classification for the type of event (e.g. public meeting, comment period, consultation period)';



COMMENT ON COLUMN "public"."engagement"."location" IS 'Physical, virtual, hybrid. (Note that this may also be attached as a relationship with a GIS object). ';



COMMENT ON COLUMN "public"."engagement"."related_document_id" IS 'Reference to Document ID of the documents released or referenced for this event.';



COMMENT ON COLUMN "public"."engagement"."attendance" IS 'Participant count.';



COMMENT ON COLUMN "public"."engagement"."participation" IS 'Container for participation data';



COMMENT ON COLUMN "public"."engagement"."notes" IS 'additional notes. ';



COMMENT ON COLUMN "public"."engagement"."start_datetime" IS 'Engagement start date/time';



COMMENT ON COLUMN "public"."engagement"."end_datetime" IS 'Engagement end date/time';



COMMENT ON COLUMN "public"."engagement"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."engagement" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."engagement_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."gis_data" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_project_id" bigint,
    "parent_process_id" bigint,
    "parent_document_id" bigint,
    "parent_case_event_id" bigint,
    "parent_comment_id" bigint,
    "parent_engagement_id" bigint,
    "description" "text",
    "extent" "text",
    "centroid_lat" double precision,
    "centroid_lon" double precision,
    "creator" "text",
    "creator_contact" "jsonb",
    "notes" "text",
    "container_inventory" "jsonb",
    "map_image" "jsonb",
    "data_container" "jsonb",
    "address" "text",
    "updated_last" timestamp with time zone,
    "other" "jsonb"
);


ALTER TABLE "public"."gis_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."gis_data" IS 'A container for location-based information, ranging from simple points to complex polygons, as well as maps and “collapsed” geospatial information';



COMMENT ON COLUMN "public"."gis_data"."id" IS 'database id';



COMMENT ON COLUMN "public"."gis_data"."created_at" IS 'created date';



COMMENT ON COLUMN "public"."gis_data"."parent_project_id" IS 'Reference to Foreign object attached to GIS object (one for each other entity table - expected architecture is that there is one foreign key among all these, not all possible relationships filled in)';



COMMENT ON COLUMN "public"."gis_data"."parent_process_id" IS 'Reference to Foreign object attached to GIS object (one for each other entity table - expected architecture is that there is one foreign key among all these, not all possible relationships filled in)';



COMMENT ON COLUMN "public"."gis_data"."parent_document_id" IS 'Reference to Foreign object attached to GIS object (one for each other entity table - expected architecture is that there is one foreign key among all these, not all possible relationships filled in)';



COMMENT ON COLUMN "public"."gis_data"."parent_case_event_id" IS 'Reference to Foreign object attached to GIS object (one for each other entity table - expected architecture is that there is one foreign key among all these, not all possible relationships filled in)';



COMMENT ON COLUMN "public"."gis_data"."parent_comment_id" IS 'Reference to Foreign object attached to GIS object (one for each other entity table - expected architecture is that there is one foreign key among all these, not all possible relationships filled in)';



COMMENT ON COLUMN "public"."gis_data"."parent_engagement_id" IS 'Reference to Foreign object attached to GIS object (one for each other entity table - expected architecture is that there is one foreign key among all these, not all possible relationships filled in)';



COMMENT ON COLUMN "public"."gis_data"."description" IS 'Optional description';



COMMENT ON COLUMN "public"."gis_data"."extent" IS 'Optional. ';



COMMENT ON COLUMN "public"."gis_data"."centroid_lat" IS 'Option to specify single point or centroid for rapid plotting';



COMMENT ON COLUMN "public"."gis_data"."centroid_lon" IS 'Option to specify single point or centroid for rapid plotting';



COMMENT ON COLUMN "public"."gis_data"."creator" IS 'Organization or individual.';



COMMENT ON COLUMN "public"."gis_data"."creator_contact" IS 'Contact card-type data for creator.';



COMMENT ON COLUMN "public"."gis_data"."notes" IS 'Miscellaneous notes.';



COMMENT ON COLUMN "public"."gis_data"."container_inventory" IS 'Inventory of map image container and GIS data container in json format (note inventory should be attached through gis_data_element objects, which may include a list of:
-	Format: GeoJSON, Shapefile, KML.
-	Access Method: URL, API, direct upload.
-	Coordinate System: Spatial reference system.
-	Bounding Box: Geographic extent.
-	Purpose: Bespoke, analysis, or base map.
-	Reference to database: Whether this object references an identified GIS analysis in an official inventory.';



COMMENT ON COLUMN "public"."gis_data"."map_image" IS 'map image data ';



COMMENT ON COLUMN "public"."gis_data"."data_container" IS 'json container for any attached GIS data';



COMMENT ON COLUMN "public"."gis_data"."address" IS 'address of centroid (if applicable)';



COMMENT ON COLUMN "public"."gis_data"."updated_last" IS 'Timestamp of last update to this dataset';



COMMENT ON COLUMN "public"."gis_data"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



CREATE TABLE IF NOT EXISTS "public"."gis_data_element" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_gis" bigint,
    "container_reference" "text",
    "format" "text",
    "access_method" "text",
    "coordinate_system" "text",
    "top_left_lat" double precision,
    "top_left_lon" double precision,
    "bot_right_lat" double precision,
    "bot_right_lon" double precision,
    "purpose" "text",
    "data_match" "text",
    "access_info" "json",
    "other" "jsonb"
);


ALTER TABLE "public"."gis_data_element" OWNER TO "postgres";


COMMENT ON TABLE "public"."gis_data_element" IS 'Inventory description for individual gis data elements.';



COMMENT ON COLUMN "public"."gis_data_element"."id" IS 'database id';



COMMENT ON COLUMN "public"."gis_data_element"."created_at" IS 'created date';



COMMENT ON COLUMN "public"."gis_data_element"."parent_gis" IS 'Parent GIS data entity';



COMMENT ON COLUMN "public"."gis_data_element"."container_reference" IS 'Reference to header or other information in GIS data container to locate this particular data element';



COMMENT ON COLUMN "public"."gis_data_element"."format" IS 'GeoJSON, Shapefile, KML.';



COMMENT ON COLUMN "public"."gis_data_element"."access_method" IS 'URL, API, direct upload.';



COMMENT ON COLUMN "public"."gis_data_element"."coordinate_system" IS 'Spatial reference system.';



COMMENT ON COLUMN "public"."gis_data_element"."top_left_lat" IS 'Geographic extent.';



COMMENT ON COLUMN "public"."gis_data_element"."top_left_lon" IS 'Geographic extent.';



COMMENT ON COLUMN "public"."gis_data_element"."bot_right_lat" IS 'Geographic extent.';



COMMENT ON COLUMN "public"."gis_data_element"."bot_right_lon" IS 'Geographic extent.';



COMMENT ON COLUMN "public"."gis_data_element"."purpose" IS '1.	Bespoke GIS Data: Project-specific (boundaries, analysis areas).
2.	Analysis GIS Data: Data layers used for analysis (e.g., wetlands inventory).
3.	Base Map Data: Foundational layers (streets, elevation).
';



COMMENT ON COLUMN "public"."gis_data_element"."data_match" IS 'Whether this object references an identified GIS analysis in an official inventory.';



COMMENT ON COLUMN "public"."gis_data_element"."access_info" IS 'instructions for access to data';



COMMENT ON COLUMN "public"."gis_data_element"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."gis_data_element" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."gis_data_element_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."gis_data" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."gis_data_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."legal_structure" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "citation" "text",
    "description" "text",
    "context" "text",
    "issuing_authority" "text",
    "effective_date" "date",
    "compliance_data" "json",
    "url" "text",
    "other" "jsonb"
);


ALTER TABLE "public"."legal_structure" OWNER TO "postgres";


COMMENT ON TABLE "public"."legal_structure" IS 'Legal, policy, or process data guiding the NEPA process, including thresholds and conditions for level of reviews or other decision criteria.';



COMMENT ON COLUMN "public"."legal_structure"."id" IS 'database id';



COMMENT ON COLUMN "public"."legal_structure"."created_at" IS 'created ';



COMMENT ON COLUMN "public"."legal_structure"."title" IS 'Official name.';



COMMENT ON COLUMN "public"."legal_structure"."citation" IS 'Legal reference.';



COMMENT ON COLUMN "public"."legal_structure"."description" IS 'Summary and relevance.';



COMMENT ON COLUMN "public"."legal_structure"."context" IS 'Full text or excerpt.';



COMMENT ON COLUMN "public"."legal_structure"."issuing_authority" IS 'Government body.';



COMMENT ON COLUMN "public"."legal_structure"."effective_date" IS 'Implementation date.';



COMMENT ON COLUMN "public"."legal_structure"."compliance_data" IS 'Procedural mandates, ideally structured as data using an ontology that includes facts (such as thresholds triggering processes), duties, and actors (e.g., FLINT frames). ';



COMMENT ON COLUMN "public"."legal_structure"."url" IS 'URL of legal reference (e.g. eCFR)';



COMMENT ON COLUMN "public"."legal_structure"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."legal_structure" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."legal_structure_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."decision_element" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."process_decision_element_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."process_decision_payload" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "process_decision_element" bigint,
    "process" bigint,
    "project" bigint,
    "data_description" "text",
    "evaluation_data" "jsonb",
    "response" "text",
    "result" "text",
    "result_bool" boolean,
    "result_notes" "text",
    "result_data" "json",
    "result_source" "text",
    "parent_payload" bigint,
    "other" "jsonb",
    "data_annotation" "text",
    "evaluation_data_annotation" "jsonb"
);


ALTER TABLE "public"."process_decision_payload" OWNER TO "postgres";


COMMENT ON TABLE "public"."process_decision_payload" IS 'Objects that deliver responses and/or results of the evaluation criteria in the process decision elements.';



COMMENT ON COLUMN "public"."process_decision_payload"."id" IS 'database id';



COMMENT ON COLUMN "public"."process_decision_payload"."created_at" IS 'created';



COMMENT ON COLUMN "public"."process_decision_payload"."process_decision_element" IS 'Relationship with process decision element ';



COMMENT ON COLUMN "public"."process_decision_payload"."process" IS 'Identifier of related process (if applicable)';



COMMENT ON COLUMN "public"."process_decision_payload"."project" IS 'Identifier of project the data is associated with. ';



COMMENT ON COLUMN "public"."process_decision_payload"."data_description" IS 'Text of the data about the project in response to the evaluation condition';



COMMENT ON COLUMN "public"."process_decision_payload"."evaluation_data" IS 'Text of the data about the project in response to the evaluation condition (json object)';



COMMENT ON COLUMN "public"."process_decision_payload"."response" IS 'Text of the response of the evaluation (if applicable)';



COMMENT ON COLUMN "public"."process_decision_payload"."result" IS 'Text of the response of the evaluation (if applicable)';



COMMENT ON COLUMN "public"."process_decision_payload"."result_bool" IS 'Whether response is included in this payload';



COMMENT ON COLUMN "public"."process_decision_payload"."result_notes" IS 'Miscellaneous notes on response';



COMMENT ON COLUMN "public"."process_decision_payload"."result_data" IS 'Text of the response of the evaluation (if applicable - json object)';



COMMENT ON COLUMN "public"."process_decision_payload"."result_source" IS 'Origin of the response';



COMMENT ON COLUMN "public"."process_decision_payload"."parent_payload" IS 'Parent payload ID (e.g. if this is a response to a submission, this would be the submission ID)';



COMMENT ON COLUMN "public"."process_decision_payload"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



COMMENT ON COLUMN "public"."process_decision_payload"."evaluation_data_annotation" IS 'Jsonb field for additional data annotations (e.g. if the response is "yes," may contain additional context or notes. ';



ALTER TABLE "public"."process_decision_payload" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."process_decision_payload_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."process_instance" (
    "id" bigint NOT NULL,
    "parent_project_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_process_id" bigint,
    "agency_id" "text",
    "federal_id" "text",
    "type" "text",
    "status" "text",
    "stage" "text",
    "start_date" "date",
    "complete_date" "date",
    "outcome" "text",
    "comment_start" "date",
    "comment_end" "date",
    "lead_agency" "text",
    "joint_lead_agency" "text",
    "cooperating_agencies" "text",
    "participating_agencies" "text",
    "notes" "text",
    "process_model" bigint,
    "other" "jsonb",
    "purpose_need" "text",
    "description" "text"
);


ALTER TABLE "public"."process_instance" OWNER TO "postgres";


COMMENT ON TABLE "public"."process_instance" IS 'The Process refers to the specific type of environmental review, permit, or authorization. A process is associated with or nested beneath a project. A process will also have documents associated and nested beneath it.';



COMMENT ON COLUMN "public"."process_instance"."id" IS 'database id';



COMMENT ON COLUMN "public"."process_instance"."parent_project_id" IS 'Reference to Project ID of parent project. ';



COMMENT ON COLUMN "public"."process_instance"."created_at" IS 'created';



COMMENT ON COLUMN "public"."process_instance"."parent_process_id" IS 'If applicable, reference to Process ID of parent process';



COMMENT ON COLUMN "public"."process_instance"."agency_id" IS 'Process-specific ID assigned by agency, if assigned.';



COMMENT ON COLUMN "public"."process_instance"."federal_id" IS 'Unique identification number (*not* database ID)';



COMMENT ON COLUMN "public"."process_instance"."type" IS 'Level of NEPA review or other permit or authorization (see Permitting Council Federal Environmental Review and Authorization Inventory).';



COMMENT ON COLUMN "public"."process_instance"."status" IS 'Indicates status of process (planned, underway, paused, completed).';



COMMENT ON COLUMN "public"."process_instance"."stage" IS 'Current state of process, may be derived from the last case event with this Process ID.';



COMMENT ON COLUMN "public"."process_instance"."start_date" IS 'Initiation date.';



COMMENT ON COLUMN "public"."process_instance"."complete_date" IS 'Conclusion date.';



COMMENT ON COLUMN "public"."process_instance"."outcome" IS 'Result (e.g., Record of Decision, permit issuance).';



COMMENT ON COLUMN "public"."process_instance"."comment_start" IS 'Time frame for public input.';



COMMENT ON COLUMN "public"."process_instance"."comment_end" IS 'Time frame for public input.';



COMMENT ON COLUMN "public"."process_instance"."lead_agency" IS 'Federal agency that supervises preparation of the environmental documents for the project';



COMMENT ON COLUMN "public"."process_instance"."joint_lead_agency" IS 'If applicable.';



COMMENT ON COLUMN "public"."process_instance"."cooperating_agencies" IS 'Cooperating agencies. ';



COMMENT ON COLUMN "public"."process_instance"."participating_agencies" IS 'Other involved agencies.';



COMMENT ON COLUMN "public"."process_instance"."notes" IS 'Miscellaneous notes.';



COMMENT ON COLUMN "public"."process_instance"."process_model" IS 'Relationship with process model data that describes the process (if available/applicable)';



COMMENT ON COLUMN "public"."process_instance"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."process_instance" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."process_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."process_model" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "description" "text",
    "notes" "text",
    "bpmn_model" "json",
    "legal_structure_id" bigint,
    "legal_structure_text" "text",
    "screening_description" "text",
    "screening_desc_json" "json",
    "agency" "text",
    "parent_model" bigint,
    "DMN_model" "jsonb",
    "other" "jsonb"
);


ALTER TABLE "public"."process_model" OWNER TO "postgres";


COMMENT ON TABLE "public"."process_model" IS 'A process model is a coded representation of a generic process, ideally in business process model notation, and/or screening criteria that define when or if the process is relevant to a project';



COMMENT ON COLUMN "public"."process_model"."id" IS 'database id';



COMMENT ON COLUMN "public"."process_model"."created_at" IS 'created';



COMMENT ON COLUMN "public"."process_model"."title" IS 'Name of process model ';



COMMENT ON COLUMN "public"."process_model"."description" IS 'Plain language description of the process model ';



COMMENT ON COLUMN "public"."process_model"."notes" IS 'Miscellaneous notes on process model';



COMMENT ON COLUMN "public"."process_model"."bpmn_model" IS 'Object containing the BPMN representation of the process';



COMMENT ON COLUMN "public"."process_model"."legal_structure_id" IS 'Reference to legal structure entity that defines the process';



COMMENT ON COLUMN "public"."process_model"."legal_structure_text" IS 'Reference to legal structure that defines the process (text, cfr reference, etc)';



COMMENT ON COLUMN "public"."process_model"."screening_description" IS 'Plain language description of the screening criteria that would lead to starting the process for an individual project. ';



COMMENT ON COLUMN "public"."process_model"."screening_desc_json" IS 'Plain language description of the screening criteria that would lead to starting the process for an individual project.  (json object option - this should not replace the decision element relationships)';



COMMENT ON COLUMN "public"."process_model"."agency" IS 'Agency responsible for carrying out this process';



COMMENT ON COLUMN "public"."process_model"."parent_model" IS 'Reference to parent model, if applicable (i.e. if this is a subprocess or flows from a previous process)';



COMMENT ON COLUMN "public"."process_model"."DMN_model" IS 'Decision model notation (in json wrapper) to structure logic for how to evaluate responses to decision elements. Optionally, each decision element may have individual DMN models.  ';



COMMENT ON COLUMN "public"."process_model"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."process_model" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."process_model_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_role" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "description" "text",
    "access_policy" "json",
    "permission_descriptions" "text",
    "public" boolean,
    "other" "jsonb"
);


ALTER TABLE "public"."user_role" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_role" IS 'Defines stakeholders interacting with the NEPA IT system.';



COMMENT ON COLUMN "public"."user_role"."id" IS 'database id';



COMMENT ON COLUMN "public"."user_role"."created_at" IS 'created';



COMMENT ON COLUMN "public"."user_role"."name" IS 'Title of the role (Agency Staff, Public Commenter).';



COMMENT ON COLUMN "public"."user_role"."description" IS 'Responsibilities and access rights.';



COMMENT ON COLUMN "public"."user_role"."access_policy" IS 'access policy json object';



COMMENT ON COLUMN "public"."user_role"."permission_descriptions" IS 'System access levels description';



COMMENT ON COLUMN "public"."user_role"."public" IS 'role is a member of the broader class of public users/stakeholders';



COMMENT ON COLUMN "public"."user_role"."other" IS 'This jsonb field should be used for additional data structures as needed. ';



ALTER TABLE "public"."user_role" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_role_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_event"
    ADD CONSTRAINT "case_event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment"
    ADD CONSTRAINT "comment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document"
    ADD CONSTRAINT "document_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engagement"
    ADD CONSTRAINT "engagement_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gis_data_element"
    ADD CONSTRAINT "gis_data_element_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gis_data"
    ADD CONSTRAINT "gis_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_structure"
    ADD CONSTRAINT "legal_structure_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decision_element"
    ADD CONSTRAINT "process_decision_element_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."process_decision_payload"
    ADD CONSTRAINT "process_decision_payload_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."process_model"
    ADD CONSTRAINT "process_model_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."process_instance"
    ADD CONSTRAINT "process_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_role"
    ADD CONSTRAINT "user_role_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_event"
    ADD CONSTRAINT "case_event_parent_process_id_fkey" FOREIGN KEY ("parent_process_id") REFERENCES "public"."process_instance"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_event"
    ADD CONSTRAINT "case_event_related_document_fkey" FOREIGN KEY ("related_document_id") REFERENCES "public"."document"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_event"
    ADD CONSTRAINT "case_event_related_engagement_id_fkey" FOREIGN KEY ("related_engagement_id") REFERENCES "public"."engagement"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comment"
    ADD CONSTRAINT "comment_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "public"."document"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."decision_element"
    ADD CONSTRAINT "decision_element_legal_structure_id_fkey" FOREIGN KEY ("legal_structure_id") REFERENCES "public"."legal_structure"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document"
    ADD CONSTRAINT "document_parent_process_id_fkey" FOREIGN KEY ("parent_process_id") REFERENCES "public"."process_instance"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."engagement"
    ADD CONSTRAINT "engagement_parent_process_id_fkey" FOREIGN KEY ("parent_process_id") REFERENCES "public"."process_instance"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."engagement"
    ADD CONSTRAINT "engagement_related_document_id_fkey" FOREIGN KEY ("related_document_id") REFERENCES "public"."document"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gis_data_element"
    ADD CONSTRAINT "gis_data_element_parent_gis_fkey" FOREIGN KEY ("parent_gis") REFERENCES "public"."gis_data"("id");



ALTER TABLE ONLY "public"."gis_data"
    ADD CONSTRAINT "gis_data_parent_comment_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comment"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gis_data"
    ADD CONSTRAINT "gis_data_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "public"."document"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gis_data"
    ADD CONSTRAINT "gis_data_parent_engagement_fkey" FOREIGN KEY ("parent_engagement_id") REFERENCES "public"."engagement"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gis_data"
    ADD CONSTRAINT "gis_data_parent_event_fkey" FOREIGN KEY ("parent_case_event_id") REFERENCES "public"."case_event"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gis_data"
    ADD CONSTRAINT "gis_data_parent_process_fkey" FOREIGN KEY ("parent_process_id") REFERENCES "public"."process_instance"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gis_data"
    ADD CONSTRAINT "gis_data_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "public"."project"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."decision_element"
    ADD CONSTRAINT "process_decision_element_process_model_fkey" FOREIGN KEY ("process_model") REFERENCES "public"."process_model"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."process_decision_payload"
    ADD CONSTRAINT "process_decision_payload_process_decision_element_fkey" FOREIGN KEY ("process_decision_element") REFERENCES "public"."decision_element"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."process_decision_payload"
    ADD CONSTRAINT "process_decision_payload_process_fkey" FOREIGN KEY ("process") REFERENCES "public"."process_instance"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."process_decision_payload"
    ADD CONSTRAINT "process_decision_payload_project_fkey" FOREIGN KEY ("project") REFERENCES "public"."project"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."process_model"
    ADD CONSTRAINT "process_model_legal_structure_id_fkey" FOREIGN KEY ("legal_structure_id") REFERENCES "public"."legal_structure"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."process_instance"
    ADD CONSTRAINT "process_parent_project_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "public"."project"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."process_instance"
    ADD CONSTRAINT "process_process_model_fkey" FOREIGN KEY ("process_model") REFERENCES "public"."process_model"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE "public"."engagement" ENABLE ROW LEVEL SECURITY;







GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."export_all_tables_as_jsonb"() TO "anon";
GRANT ALL ON FUNCTION "public"."export_all_tables_as_jsonb"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."export_all_tables_as_jsonb"() TO "service_role";


















GRANT ALL ON TABLE "public"."project" TO "anon";
GRANT ALL ON TABLE "public"."project" TO "authenticated";
GRANT ALL ON TABLE "public"."project" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Project_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Project_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Project_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."case_event" TO "anon";
GRANT ALL ON TABLE "public"."case_event" TO "authenticated";
GRANT ALL ON TABLE "public"."case_event" TO "service_role";



GRANT ALL ON SEQUENCE "public"."case_event_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."case_event_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."case_event_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comment" TO "anon";
GRANT ALL ON TABLE "public"."comment" TO "authenticated";
GRANT ALL ON TABLE "public"."comment" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comment_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comment_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."decision_element" TO "anon";
GRANT ALL ON TABLE "public"."decision_element" TO "authenticated";
GRANT ALL ON TABLE "public"."decision_element" TO "service_role";



GRANT ALL ON TABLE "public"."document" TO "anon";
GRANT ALL ON TABLE "public"."document" TO "authenticated";
GRANT ALL ON TABLE "public"."document" TO "service_role";



GRANT ALL ON SEQUENCE "public"."document_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."document_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."document_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."engagement" TO "anon";
GRANT ALL ON TABLE "public"."engagement" TO "authenticated";
GRANT ALL ON TABLE "public"."engagement" TO "service_role";



GRANT ALL ON SEQUENCE "public"."engagement_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."engagement_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."engagement_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."gis_data" TO "anon";
GRANT ALL ON TABLE "public"."gis_data" TO "authenticated";
GRANT ALL ON TABLE "public"."gis_data" TO "service_role";



GRANT ALL ON TABLE "public"."gis_data_element" TO "anon";
GRANT ALL ON TABLE "public"."gis_data_element" TO "authenticated";
GRANT ALL ON TABLE "public"."gis_data_element" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gis_data_element_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gis_data_element_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gis_data_element_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."gis_data_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."gis_data_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."gis_data_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."legal_structure" TO "anon";
GRANT ALL ON TABLE "public"."legal_structure" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_structure" TO "service_role";



GRANT ALL ON SEQUENCE "public"."legal_structure_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."legal_structure_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."legal_structure_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."process_decision_element_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."process_decision_element_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."process_decision_element_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."process_decision_payload" TO "anon";
GRANT ALL ON TABLE "public"."process_decision_payload" TO "authenticated";
GRANT ALL ON TABLE "public"."process_decision_payload" TO "service_role";



GRANT ALL ON SEQUENCE "public"."process_decision_payload_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."process_decision_payload_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."process_decision_payload_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."process_instance" TO "anon";
GRANT ALL ON TABLE "public"."process_instance" TO "authenticated";
GRANT ALL ON TABLE "public"."process_instance" TO "service_role";



GRANT ALL ON SEQUENCE "public"."process_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."process_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."process_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."process_model" TO "anon";
GRANT ALL ON TABLE "public"."process_model" TO "authenticated";
GRANT ALL ON TABLE "public"."process_model" TO "service_role";



GRANT ALL ON SEQUENCE "public"."process_model_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."process_model_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."process_model_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_role" TO "anon";
GRANT ALL ON TABLE "public"."user_role" TO "authenticated";
GRANT ALL ON TABLE "public"."user_role" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_role_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_role_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_role_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
