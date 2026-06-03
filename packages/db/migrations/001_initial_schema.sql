-- Initial Supabase/PostgreSQL schema for PrismGrid Module 01 Phase 1.
-- References: docs/spec/FAQ_Engine_Master_Spec_v1.0.docx Sections 1.1, 1.2, 1.3, 3, 5.1, 5.2, 5.3, 6.2.

create table if not exists jobs (
	job_id text primary key,
	status text not null check (status in (
               'Uploaded',
               'Validating',
               'Cost Estimated',
               'Queued',
               'Processing',
               'Completed',
               'Completed with Warnings',
               'Failed'
       )),
	url_count integer,
	cost_estimate numeric(12,4),
	cost_ceiling numeric(12,4),
	cost_confirmed boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);
comment on table jobs is 'Section 5.1 job lifecycle status values and cost ceiling logic from Section 5.2.';

create table if not exists intake_rows (
	row_id text primary key,
	job_id text not null,
	product_id text,
	url text not null,
	page_type text not null check (page_type in ('PDP', 'PLP', 'article', 'recipe')),
	category text not null,
	product_family text,
	variant_group_id text,
	priority text not null check (priority in ('P1', 'P2', 'P3')),
	source_language text,
	created_at timestamptz not null default now(),
	constraint intake_rows_job_fk foreign key (job_id) references jobs(job_id)
);
comment on table intake_rows is 'Section 1.1 URL Intake Row input fields persisted for Phase 1 batch tracking.';

create index if not exists intake_rows_job_idx on intake_rows (job_id);
create index if not exists intake_rows_url_idx on intake_rows (url);

create table if not exists product_knowledge_objects (
	pko_id text primary key,
	job_id text not null,
	intake_row_id text not null,
	source_url text not null,
	product_name text not null,
	category text not null,
	product_family text not null,
	source_language_detected text not null,
	source_language_confidence numeric(5,4) not null check (source_language_confidence >= 0 and source_language_confidence <= 1),
	features jsonb not null default '[]',
	fmo_mappings jsonb not null default '[]',
	benefits_explicit jsonb not null default '[]',
	benefits_missing jsonb not null default '[]',
	materials jsonb not null default '[]',
	compatibility jsonb not null default '[]',
	care_instructions jsonb not null default '[]',
	warranty_service jsonb not null default '[]',
	use_cases jsonb not null default '[]',
	claims_flagged jsonb not null default '[]',
	page_weaknesses jsonb not null default '[]',
	knowledgebase_chunks_used jsonb not null default '[]',
	pko_version text not null,
	created_at timestamptz not null default now(),
	constraint pko_job_fk foreign key (job_id) references jobs(job_id),
	constraint pko_intake_fk foreign key (intake_row_id) references intake_rows(row_id)
);
comment on table product_knowledge_objects is 'Section 1.2 PKO fields persisting extracted product knowledge. job_id and intake_row_id are stored for practical joinability.';

create index if not exists pko_job_idx on product_knowledge_objects (job_id);
create index if not exists pko_intake_idx on product_knowledge_objects (intake_row_id);

create table if not exists faq_items (
	faq_id text primary key,
	pko_id text not null,
	question text not null,
	answer text not null,
	language text not null,
	is_master boolean not null,
	purpose_tags jsonb not null default '[]',
	fmo_coverage jsonb not null,
	source_evidence jsonb not null default '[]',
	evaluator_scores jsonb not null,
	claim_risk_pass boolean not null,
	risk_flags jsonb not null default '[]',
	status text not null check (status in ('draft', 'needs-review', 'approved', 'rejected', 'cms-ready', 'exported')),
	rewrite_count integer not null check (rewrite_count >= 0 and rewrite_count <= 2),
	schema_ready boolean not null,
	version text not null,
	created_at timestamptz not null default now(),
	constraint faq_pko_fk foreign key (pko_id) references product_knowledge_objects(pko_id)
);
comment on table faq_items is 'Section 1.3 FAQ Item Object persisted exactly with JSONB for arrays and nested objects.';

create index if not exists faq_pko_idx on faq_items (pko_id);
create index if not exists faq_language_idx on faq_items (language);
create index if not exists faq_status_idx on faq_items (status);

create table if not exists evaluator_results (
	evaluator_result_id uuid primary key default gen_random_uuid(),
	faq_id text not null,
	fact_fidelity integer not null,
	fmo_benefit integer not null,
	ai_visibility integer not null,
	human_tone integer not null,
	localization integer,
	claim_risk_pass boolean not null,
	created_at timestamptz not null default now(),
	constraint evaluator_faq_fk foreign key (faq_id) references faq_items(faq_id)
);
comment on table evaluator_results is 'Section 3 evaluator score fields plus Claim Risk gate for Phase 1. Stored separately from faq_items for queryability.';

create index if not exists evaluator_results_faq_idx on evaluator_results (faq_id);

create table if not exists cost_log (
	cost_log_id uuid primary key default gen_random_uuid(),
	job_id text not null,
	url text not null,
	step text not null,
	model text not null,
	tokens integer not null,
	estimated_cost numeric(12,4) not null,
	created_at timestamptz not null default now(),
	constraint cost_log_job_fk foreign key (job_id) references jobs(job_id)
);
comment on table cost_log is 'Section 5.2/5.3 cost log entries. Includes job_id, url, step, model, tokens, and estimated_cost for the Cost Log tab.';

create index if not exists cost_log_job_idx on cost_log (job_id);
create index if not exists cost_log_url_idx on cost_log (url);
