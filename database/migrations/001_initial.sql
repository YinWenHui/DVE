SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'dve') EXEC('CREATE SCHEMA dve');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'dve_data') EXEC('CREATE SCHEMA dve_data');
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'dve_audit') EXEC('CREATE SCHEMA dve_audit');

CREATE TABLE dve.roles (
  role_id uniqueidentifier NOT NULL CONSTRAINT PK_roles PRIMARY KEY DEFAULT NEWID(),
  code varchar(40) NOT NULL CONSTRAINT UQ_roles_code UNIQUE,
  name nvarchar(100) NOT NULL,
  description nvarchar(500) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_roles_created DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dve.users (
  user_id uniqueidentifier NOT NULL CONSTRAINT PK_users PRIMARY KEY DEFAULT NEWID(),
  username nvarchar(100) NOT NULL CONSTRAINT UQ_users_username UNIQUE,
  email nvarchar(254) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
  display_name nvarchar(150) NOT NULL,
  password_hash nvarchar(255) NOT NULL,
  is_active bit NOT NULL CONSTRAINT DF_users_active DEFAULT 1,
  failed_login_count int NOT NULL CONSTRAINT DF_users_failures DEFAULT 0,
  locked_until datetime2(3) NULL,
  last_login_at datetime2(3) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_users_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dve.user_roles (
  user_id uniqueidentifier NOT NULL,
  role_id uniqueidentifier NOT NULL,
  scope_type varchar(40) NULL,
  scope_id uniqueidentifier NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_user_roles_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_user_roles PRIMARY KEY (user_id, role_id),
  CONSTRAINT FK_user_roles_user FOREIGN KEY (user_id) REFERENCES dve.users(user_id) ON DELETE CASCADE,
  CONSTRAINT FK_user_roles_role FOREIGN KEY (role_id) REFERENCES dve.roles(role_id)
);

CREATE TABLE dve.sessions (
  session_id uniqueidentifier NOT NULL CONSTRAINT PK_sessions PRIMARY KEY DEFAULT NEWID(),
  user_id uniqueidentifier NOT NULL,
  token_hash char(64) NOT NULL CONSTRAINT UQ_sessions_token UNIQUE,
  expires_at datetime2(3) NOT NULL,
  revoked_at datetime2(3) NULL,
  ip_address varchar(45) NULL,
  user_agent nvarchar(500) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_sessions_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_sessions_user FOREIGN KEY (user_id) REFERENCES dve.users(user_id) ON DELETE CASCADE
);
CREATE INDEX IX_sessions_user_expiry ON dve.sessions(user_id, expires_at) INCLUDE (revoked_at);

CREATE TABLE dve.data_sources (
  source_id uniqueidentifier NOT NULL CONSTRAINT PK_data_sources PRIMARY KEY DEFAULT NEWID(),
  name nvarchar(150) NOT NULL,
  source_type varchar(40) NOT NULL,
  configuration_json nvarchar(max) NOT NULL CONSTRAINT CK_data_sources_config_json CHECK (ISJSON(configuration_json) = 1),
  encrypted_secret nvarchar(max) NULL,
  is_active bit NOT NULL CONSTRAINT DF_data_sources_active DEFAULT 1,
  created_by uniqueidentifier NOT NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_data_sources_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_data_sources_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_data_sources_creator FOREIGN KEY (created_by) REFERENCES dve.users(user_id)
);

CREATE TABLE dve.datasets (
  dataset_id uniqueidentifier NOT NULL CONSTRAINT PK_datasets PRIMARY KEY DEFAULT NEWID(),
  source_id uniqueidentifier NULL,
  name nvarchar(150) NOT NULL,
  slug varchar(150) NOT NULL CONSTRAINT UQ_datasets_slug UNIQUE,
  description nvarchar(1000) NULL,
  storage_mode varchar(30) NOT NULL,
  physical_schema sysname NULL,
  physical_object_name sysname NULL,
  status varchar(30) NOT NULL,
  refresh_policy_json nvarchar(max) NOT NULL CONSTRAINT CK_datasets_refresh_json CHECK (ISJSON(refresh_policy_json) = 1),
  retention_policy_json nvarchar(max) NOT NULL CONSTRAINT CK_datasets_retention_json CHECK (ISJSON(retention_policy_json) = 1),
  created_by uniqueidentifier NOT NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_datasets_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_datasets_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_datasets_source FOREIGN KEY (source_id) REFERENCES dve.data_sources(source_id),
  CONSTRAINT FK_datasets_creator FOREIGN KEY (created_by) REFERENCES dve.users(user_id)
);
CREATE INDEX IX_datasets_status ON dve.datasets(status, updated_at DESC);

CREATE TABLE dve.dataset_fields (
  field_id uniqueidentifier NOT NULL CONSTRAINT PK_dataset_fields PRIMARY KEY DEFAULT NEWID(),
  dataset_id uniqueidentifier NOT NULL,
  source_name nvarchar(128) NOT NULL,
  field_key varchar(128) NOT NULL,
  display_name nvarchar(128) NOT NULL,
  data_type varchar(30) NOT NULL,
  semantic_type varchar(30) NOT NULL,
  default_aggregation varchar(30) NOT NULL,
  format_string nvarchar(50) NULL,
  ordinal int NOT NULL,
  is_hidden bit NOT NULL CONSTRAINT DF_dataset_fields_hidden DEFAULT 0,
  is_filterable bit NOT NULL CONSTRAINT DF_dataset_fields_filterable DEFAULT 1,
  is_sortable bit NOT NULL CONSTRAINT DF_dataset_fields_sortable DEFAULT 1,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_dataset_fields_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_dataset_fields_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_dataset_fields_key UNIQUE (dataset_id, field_key),
  CONSTRAINT UQ_dataset_fields_ordinal UNIQUE (dataset_id, ordinal),
  CONSTRAINT FK_dataset_fields_dataset FOREIGN KEY (dataset_id) REFERENCES dve.datasets(dataset_id) ON DELETE CASCADE
);

CREATE TABLE dve.dataset_versions (
  version_id uniqueidentifier NOT NULL CONSTRAINT PK_dataset_versions PRIMARY KEY DEFAULT NEWID(),
  dataset_id uniqueidentifier NOT NULL,
  version_number int NOT NULL,
  schema_hash char(64) NOT NULL,
  row_count bigint NOT NULL,
  physical_object_name sysname NOT NULL,
  source_modified_at datetime2(3) NULL,
  imported_at datetime2(3) NOT NULL CONSTRAINT DF_dataset_versions_imported DEFAULT SYSUTCDATETIME(),
  is_active bit NOT NULL CONSTRAINT DF_dataset_versions_active DEFAULT 0,
  CONSTRAINT UQ_dataset_versions_number UNIQUE (dataset_id, version_number),
  CONSTRAINT FK_dataset_versions_dataset FOREIGN KEY (dataset_id) REFERENCES dve.datasets(dataset_id)
);
CREATE UNIQUE INDEX UX_dataset_versions_active ON dve.dataset_versions(dataset_id) WHERE is_active = 1;

CREATE TABLE dve.measures (
  measure_id uniqueidentifier NOT NULL CONSTRAINT PK_measures PRIMARY KEY DEFAULT NEWID(),
  dataset_id uniqueidentifier NOT NULL,
  name nvarchar(150) NOT NULL,
  expression_type varchar(50) NOT NULL,
  expression_json nvarchar(max) NOT NULL CONSTRAINT CK_measures_expression_json CHECK (ISJSON(expression_json) = 1),
  data_type varchar(30) NOT NULL,
  format_string nvarchar(50) NULL,
  status varchar(30) NOT NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_measures_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_measures_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_measures_name UNIQUE (dataset_id, name),
  CONSTRAINT FK_measures_dataset FOREIGN KEY (dataset_id) REFERENCES dve.datasets(dataset_id) ON DELETE CASCADE
);

CREATE TABLE dve.reports (
  report_id uniqueidentifier NOT NULL CONSTRAINT PK_reports PRIMARY KEY DEFAULT NEWID(),
  dataset_id uniqueidentifier NOT NULL,
  name nvarchar(150) NOT NULL,
  slug varchar(150) NOT NULL CONSTRAINT UQ_reports_slug UNIQUE,
  description nvarchar(1000) NULL,
  status varchar(30) NOT NULL,
  minimum_role_code varchar(40) NOT NULL CONSTRAINT DF_reports_role DEFAULT 'VIEWER',
  created_by uniqueidentifier NOT NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_reports_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_reports_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_reports_dataset FOREIGN KEY (dataset_id) REFERENCES dve.datasets(dataset_id),
  CONSTRAINT FK_reports_creator FOREIGN KEY (created_by) REFERENCES dve.users(user_id)
);

CREATE TABLE dve.report_pages (
  page_id uniqueidentifier NOT NULL CONSTRAINT PK_report_pages PRIMARY KEY DEFAULT NEWID(),
  report_id uniqueidentifier NOT NULL,
  name nvarchar(150) NOT NULL,
  ordinal int NOT NULL,
  canvas_width int NOT NULL CONSTRAINT DF_report_pages_width DEFAULT 1320,
  canvas_height int NOT NULL CONSTRAINT DF_report_pages_height DEFAULT 900,
  background_json nvarchar(max) NOT NULL CONSTRAINT DF_report_pages_background DEFAULT '{}',
  page_filters_json nvarchar(max) NOT NULL CONSTRAINT DF_report_pages_filters DEFAULT '[]',
  CONSTRAINT CK_report_pages_background_json CHECK (ISJSON(background_json) = 1),
  CONSTRAINT CK_report_pages_filters_json CHECK (ISJSON(page_filters_json) = 1),
  CONSTRAINT UQ_report_pages_ordinal UNIQUE (report_id, ordinal),
  CONSTRAINT FK_report_pages_report FOREIGN KEY (report_id) REFERENCES dve.reports(report_id) ON DELETE CASCADE
);

CREATE TABLE dve.visuals (
  visual_id uniqueidentifier NOT NULL CONSTRAINT PK_visuals PRIMARY KEY DEFAULT NEWID(),
  page_id uniqueidentifier NOT NULL,
  visual_type varchar(40) NOT NULL,
  title nvarchar(200) NOT NULL,
  position_x int NOT NULL,
  position_y int NOT NULL,
  width int NOT NULL,
  height int NOT NULL,
  query_json nvarchar(max) NOT NULL,
  configuration_json nvarchar(max) NOT NULL,
  interaction_json nvarchar(max) NOT NULL,
  ordinal int NOT NULL,
  CONSTRAINT CK_visuals_query_json CHECK (ISJSON(query_json) = 1),
  CONSTRAINT CK_visuals_configuration_json CHECK (ISJSON(configuration_json) = 1),
  CONSTRAINT CK_visuals_interaction_json CHECK (ISJSON(interaction_json) = 1),
  CONSTRAINT UQ_visuals_ordinal UNIQUE (page_id, ordinal),
  CONSTRAINT FK_visuals_page FOREIGN KEY (page_id) REFERENCES dve.report_pages(page_id) ON DELETE CASCADE
);

CREATE TABLE dve.apps (
  app_id uniqueidentifier NOT NULL CONSTRAINT PK_apps PRIMARY KEY DEFAULT NEWID(),
  name nvarchar(150) NOT NULL,
  slug varchar(150) NOT NULL CONSTRAINT UQ_apps_slug UNIQUE,
  description nvarchar(1000) NULL,
  icon_path nvarchar(500) NULL,
  theme_json nvarchar(max) NOT NULL CONSTRAINT DF_apps_theme DEFAULT '{}',
  status varchar(30) NOT NULL,
  default_report_id uniqueidentifier NULL,
  publisher_display nvarchar(200) NULL,
  created_by uniqueidentifier NOT NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_apps_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_apps_updated DEFAULT SYSUTCDATETIME(),
  published_at datetime2(3) NULL,
  CONSTRAINT CK_apps_theme_json CHECK (ISJSON(theme_json) = 1),
  CONSTRAINT FK_apps_default_report FOREIGN KEY (default_report_id) REFERENCES dve.reports(report_id),
  CONSTRAINT FK_apps_creator FOREIGN KEY (created_by) REFERENCES dve.users(user_id)
);

CREATE TABLE dve.app_sections (
  section_id uniqueidentifier NOT NULL CONSTRAINT PK_app_sections PRIMARY KEY DEFAULT NEWID(),
  app_id uniqueidentifier NOT NULL,
  name nvarchar(150) NOT NULL,
  ordinal int NOT NULL,
  is_collapsed_default bit NOT NULL CONSTRAINT DF_app_sections_collapsed DEFAULT 0,
  CONSTRAINT UQ_app_sections_ordinal UNIQUE (app_id, ordinal),
  CONSTRAINT FK_app_sections_app FOREIGN KEY (app_id) REFERENCES dve.apps(app_id) ON DELETE CASCADE
);

CREATE TABLE dve.app_reports (
  app_report_id uniqueidentifier NOT NULL CONSTRAINT PK_app_reports PRIMARY KEY DEFAULT NEWID(),
  app_id uniqueidentifier NOT NULL,
  section_id uniqueidentifier NOT NULL,
  report_id uniqueidentifier NOT NULL,
  ordinal int NOT NULL,
  CONSTRAINT UQ_app_reports_report UNIQUE (app_id, report_id),
  CONSTRAINT UQ_app_reports_ordinal UNIQUE (section_id, ordinal),
  CONSTRAINT FK_app_reports_app FOREIGN KEY (app_id) REFERENCES dve.apps(app_id),
  CONSTRAINT FK_app_reports_section FOREIGN KEY (section_id) REFERENCES dve.app_sections(section_id) ON DELETE CASCADE,
  CONSTRAINT FK_app_reports_report FOREIGN KEY (report_id) REFERENCES dve.reports(report_id)
);

CREATE TABLE dve.audiences (
  audience_id uniqueidentifier NOT NULL CONSTRAINT PK_audiences PRIMARY KEY DEFAULT NEWID(),
  app_id uniqueidentifier NOT NULL,
  name nvarchar(150) NOT NULL,
  description nvarchar(500) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_audiences_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_audiences_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_audiences_name UNIQUE (app_id, name),
  CONSTRAINT FK_audiences_app FOREIGN KEY (app_id) REFERENCES dve.apps(app_id) ON DELETE CASCADE
);

CREATE TABLE dve.audience_members (
  audience_member_id uniqueidentifier NOT NULL CONSTRAINT PK_audience_members PRIMARY KEY DEFAULT NEWID(),
  audience_id uniqueidentifier NOT NULL,
  user_id uniqueidentifier NULL,
  role_id uniqueidentifier NULL,
  CONSTRAINT CK_audience_members_target CHECK ((user_id IS NULL AND role_id IS NOT NULL) OR (user_id IS NOT NULL AND role_id IS NULL)),
  CONSTRAINT FK_audience_members_audience FOREIGN KEY (audience_id) REFERENCES dve.audiences(audience_id) ON DELETE CASCADE,
  CONSTRAINT FK_audience_members_user FOREIGN KEY (user_id) REFERENCES dve.users(user_id),
  CONSTRAINT FK_audience_members_role FOREIGN KEY (role_id) REFERENCES dve.roles(role_id)
);
CREATE UNIQUE INDEX UX_audience_members_user ON dve.audience_members(audience_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX UX_audience_members_role ON dve.audience_members(audience_id, role_id) WHERE role_id IS NOT NULL;

CREATE TABLE dve.audience_reports (
  audience_id uniqueidentifier NOT NULL,
  app_report_id uniqueidentifier NOT NULL,
  CONSTRAINT PK_audience_reports PRIMARY KEY (audience_id, app_report_id),
  CONSTRAINT FK_audience_reports_audience FOREIGN KEY (audience_id) REFERENCES dve.audiences(audience_id) ON DELETE CASCADE,
  CONSTRAINT FK_audience_reports_app_report FOREIGN KEY (app_report_id) REFERENCES dve.app_reports(app_report_id)
);

CREATE TABLE dve.refresh_schedules (
  schedule_id uniqueidentifier NOT NULL CONSTRAINT PK_refresh_schedules PRIMARY KEY DEFAULT NEWID(),
  dataset_id uniqueidentifier NOT NULL,
  schedule_type varchar(30) NOT NULL,
  interval_minutes int NULL,
  cron_expression varchar(150) NULL,
  timezone varchar(80) NOT NULL CONSTRAINT DF_refresh_schedules_tz DEFAULT 'Asia/Bangkok',
  is_enabled bit NOT NULL CONSTRAINT DF_refresh_schedules_enabled DEFAULT 1,
  next_run_at datetime2(3) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_refresh_schedules_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_refresh_schedules_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_refresh_schedules_dataset FOREIGN KEY (dataset_id) REFERENCES dve.datasets(dataset_id) ON DELETE CASCADE
);
CREATE INDEX IX_refresh_schedules_due ON dve.refresh_schedules(is_enabled, next_run_at) INCLUDE (dataset_id, schedule_type, interval_minutes);

CREATE TABLE dve.refresh_runs (
  run_id uniqueidentifier NOT NULL CONSTRAINT PK_refresh_runs PRIMARY KEY DEFAULT NEWID(),
  dataset_id uniqueidentifier NOT NULL,
  schedule_id uniqueidentifier NULL,
  status varchar(30) NOT NULL,
  trigger_type varchar(30) NOT NULL,
  started_at datetime2(3) NOT NULL CONSTRAINT DF_refresh_runs_started DEFAULT SYSUTCDATETIME(),
  completed_at datetime2(3) NULL,
  rows_read bigint NULL,
  rows_written bigint NULL,
  source_version nvarchar(200) NULL,
  batch_id uniqueidentifier NULL,
  error_message nvarchar(2000) NULL,
  triggered_by uniqueidentifier NULL,
  CONSTRAINT FK_refresh_runs_dataset FOREIGN KEY (dataset_id) REFERENCES dve.datasets(dataset_id),
  CONSTRAINT FK_refresh_runs_schedule FOREIGN KEY (schedule_id) REFERENCES dve.refresh_schedules(schedule_id),
  CONSTRAINT FK_refresh_runs_user FOREIGN KEY (triggered_by) REFERENCES dve.users(user_id)
);
CREATE INDEX IX_refresh_runs_dataset_started ON dve.refresh_runs(dataset_id, started_at DESC) INCLUDE (status, completed_at, rows_written);

CREATE TABLE dve.alert_rules (
  alert_rule_id uniqueidentifier NOT NULL CONSTRAINT PK_alert_rules PRIMARY KEY DEFAULT NEWID(),
  name nvarchar(150) NOT NULL,
  dataset_id uniqueidentifier NULL,
  report_id uniqueidentifier NULL,
  condition_json nvarchar(max) NOT NULL,
  severity varchar(20) NOT NULL,
  channels_json nvarchar(max) NOT NULL CONSTRAINT DF_alert_rules_channels DEFAULT '[]',
  is_enabled bit NOT NULL CONSTRAINT DF_alert_rules_enabled DEFAULT 1,
  created_by uniqueidentifier NOT NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_alert_rules_created DEFAULT SYSUTCDATETIME(),
  updated_at datetime2(3) NOT NULL CONSTRAINT DF_alert_rules_updated DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_alert_rules_condition_json CHECK (ISJSON(condition_json) = 1),
  CONSTRAINT CK_alert_rules_channels_json CHECK (ISJSON(channels_json) = 1),
  CONSTRAINT FK_alert_rules_dataset FOREIGN KEY (dataset_id) REFERENCES dve.datasets(dataset_id),
  CONSTRAINT FK_alert_rules_report FOREIGN KEY (report_id) REFERENCES dve.reports(report_id),
  CONSTRAINT FK_alert_rules_creator FOREIGN KEY (created_by) REFERENCES dve.users(user_id)
);

CREATE TABLE dve.alert_events (
  alert_event_id uniqueidentifier NOT NULL CONSTRAINT PK_alert_events PRIMARY KEY DEFAULT NEWID(),
  alert_rule_id uniqueidentifier NOT NULL,
  status varchar(30) NOT NULL,
  fired_at datetime2(3) NOT NULL CONSTRAINT DF_alert_events_fired DEFAULT SYSUTCDATETIME(),
  resolved_at datetime2(3) NULL,
  payload_json nvarchar(max) NOT NULL,
  CONSTRAINT CK_alert_events_payload_json CHECK (ISJSON(payload_json) = 1),
  CONSTRAINT FK_alert_events_rule FOREIGN KEY (alert_rule_id) REFERENCES dve.alert_rules(alert_rule_id)
);
CREATE INDEX IX_alert_events_status ON dve.alert_events(status, fired_at DESC);

CREATE TABLE dve.alert_acknowledgements (
  acknowledgement_id uniqueidentifier NOT NULL CONSTRAINT PK_alert_acknowledgements PRIMARY KEY DEFAULT NEWID(),
  alert_event_id uniqueidentifier NOT NULL,
  user_id uniqueidentifier NOT NULL,
  comment nvarchar(1000) NOT NULL,
  acknowledged_at datetime2(3) NOT NULL CONSTRAINT DF_alert_acknowledgements_time DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_alert_acknowledgements_event FOREIGN KEY (alert_event_id) REFERENCES dve.alert_events(alert_event_id),
  CONSTRAINT FK_alert_acknowledgements_user FOREIGN KEY (user_id) REFERENCES dve.users(user_id)
);

CREATE TABLE dve.comments (
  comment_id uniqueidentifier NOT NULL CONSTRAINT PK_comments PRIMARY KEY DEFAULT NEWID(),
  entity_type varchar(50) NOT NULL,
  entity_id nvarchar(200) NOT NULL,
  user_id uniqueidentifier NOT NULL,
  body nvarchar(2000) NOT NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_comments_created DEFAULT SYSUTCDATETIME(),
  edited_at datetime2(3) NULL,
  deleted_at datetime2(3) NULL,
  CONSTRAINT FK_comments_user FOREIGN KEY (user_id) REFERENCES dve.users(user_id)
);
CREATE INDEX IX_comments_entity ON dve.comments(entity_type, entity_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE dve.bookmarks (
  bookmark_id uniqueidentifier NOT NULL CONSTRAINT PK_bookmarks PRIMARY KEY DEFAULT NEWID(),
  user_id uniqueidentifier NOT NULL,
  report_id uniqueidentifier NOT NULL,
  name nvarchar(150) NOT NULL,
  state_json nvarchar(max) NOT NULL,
  is_default bit NOT NULL CONSTRAINT DF_bookmarks_default DEFAULT 0,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_bookmarks_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_bookmarks_state_json CHECK (ISJSON(state_json) = 1),
  CONSTRAINT UQ_bookmarks_name UNIQUE (user_id, report_id, name),
  CONSTRAINT FK_bookmarks_user FOREIGN KEY (user_id) REFERENCES dve.users(user_id) ON DELETE CASCADE,
  CONSTRAINT FK_bookmarks_report FOREIGN KEY (report_id) REFERENCES dve.reports(report_id) ON DELETE CASCADE
);

CREATE TABLE dve_audit.audit_logs (
  audit_id uniqueidentifier NOT NULL CONSTRAINT PK_audit_logs PRIMARY KEY DEFAULT NEWID(),
  user_id uniqueidentifier NULL,
  action varchar(100) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id nvarchar(200) NOT NULL,
  details_json nvarchar(max) NOT NULL CONSTRAINT DF_audit_logs_details DEFAULT '{}',
  ip_address varchar(45) NULL,
  created_at datetime2(3) NOT NULL CONSTRAINT DF_audit_logs_created DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_audit_logs_details_json CHECK (ISJSON(details_json) = 1),
  CONSTRAINT FK_audit_logs_user FOREIGN KEY (user_id) REFERENCES dve.users(user_id)
);
CREATE INDEX IX_audit_logs_created ON dve_audit.audit_logs(created_at DESC) INCLUDE (action, entity_type, entity_id, user_id);

MERGE dve.roles AS target
USING (VALUES
  ('VIEWER', 'Viewer', 'Read assigned applications and reports; filter and export permitted data.'),
  ('SUPERVISOR', 'Supervisor', 'Viewer capabilities plus comments and alert acknowledgement.'),
  ('MANAGER', 'Manager', 'Supervisor capabilities plus management-assigned reporting.'),
  ('ADMINISTRATOR', 'Administrator', 'Full platform and content administration.')
) AS source(code, name, description)
ON target.code = source.code
WHEN NOT MATCHED THEN INSERT (code, name, description) VALUES (source.code, source.name, source.description);

COMMIT TRANSACTION;
