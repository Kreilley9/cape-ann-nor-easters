-- Cape Ann Nor'easters: Initial PostgreSQL Schema
-- Converted from Cloudflare D1 (SQLite) to PostgreSQL
-- Run via: psql $DATABASE_URL -f supabase/migrations/0001_initial.sql

-- ============================================================
-- CORE AUTH / ACCESS CONTROL
-- ============================================================

CREATE TABLE IF NOT EXISTS admins (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL,
  email       TEXT,
  name        TEXT,
  role        TEXT NOT NULL,
  team_id     BIGINT,
  family_id   BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_team_id ON user_roles (team_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_family_id ON user_roles (family_id);

CREATE TABLE IF NOT EXISTS invites (
  id                  BIGSERIAL PRIMARY KEY,
  email               TEXT NOT NULL,
  code                TEXT NOT NULL UNIQUE,
  role                TEXT NOT NULL,
  team_id             BIGINT,
  family_id           BIGINT,
  invited_by_user_id  TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  expires_at          TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          TEXT NOT NULL,
  permission_key   TEXT NOT NULL,
  permission_value TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, permission_key)
);

-- ============================================================
-- SEASONS / TEAMS / PLAYERS
-- ============================================================

CREATE TABLE IF NOT EXISTS seasons (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  year        INTEGER,
  start_date  DATE,
  end_date    DATE,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id                      BIGSERIAL PRIMARY KEY,
  name                    TEXT NOT NULL,
  age_group               TEXT,
  season_id               BIGINT,
  head_coach_user_id      TEXT,
  assistant_coach_user_id TEXT,
  photo_key               TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_season_id ON teams (season_id);

CREATE TABLE IF NOT EXISTS team_seasons (
  id          BIGSERIAL PRIMARY KEY,
  team_id     BIGINT NOT NULL,
  season_id   BIGINT NOT NULL,
  division    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, season_id)
);

CREATE TABLE IF NOT EXISTS families (
  id                      BIGSERIAL PRIMARY KEY,
  name                    TEXT,
  email                   TEXT,
  phone                   TEXT,
  address                 TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  user_id                 TEXT,
  -- Legacy columns used in queries
  family_name             TEXT,
  parent1_first_name      TEXT,
  parent1_last_name       TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_families_user_id ON families (user_id);

CREATE TABLE IF NOT EXISTS players (
  id                    BIGSERIAL PRIMARY KEY,
  family_id             BIGINT,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  birth_date            DATE,
  jersey_number         TEXT,
  notes                 TEXT,
  status                TEXT,
  photo_key             TEXT,
  uniform_size          TEXT,
  zorts_expiration_date DATE,
  zorts_id              TEXT,
  grade                 TEXT,
  address_1             TEXT,
  address_2             TEXT,
  town                  TEXT,
  state                 TEXT,
  zip_code              TEXT,
  parent_1_name         TEXT,
  parent_1_phone        TEXT,
  parent_1_email        TEXT,
  parent_2_name         TEXT,
  parent_2_phone        TEXT,
  parent_2_email        TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_family_id ON players (family_id);
CREATE INDEX IF NOT EXISTS idx_players_last_name ON players (last_name);

CREATE TABLE IF NOT EXISTS team_players (
  id          BIGSERIAL PRIMARY KEY,
  team_id     BIGINT NOT NULL,
  player_id   BIGINT NOT NULL,
  position    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_team_players_team_id ON team_players (team_id);
CREATE INDEX IF NOT EXISTS idx_team_players_player_id ON team_players (player_id);

CREATE TABLE IF NOT EXISTS team_coaches (
  id          BIGSERIAL PRIMARY KEY,
  team_id     BIGINT NOT NULL,
  name        TEXT NOT NULL,
  title       TEXT,
  email       TEXT,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_coaches_team_id ON team_coaches (team_id);

-- ============================================================
-- EVENTS / ATTENDANCE / CALENDAR
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id           BIGSERIAL PRIMARY KEY,
  team_id      BIGINT,
  event_type   TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  start_at     TIMESTAMPTZ NOT NULL,
  end_at       TIMESTAMPTZ,
  cost         NUMERIC(10,2),
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_team_id ON events (team_id);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events (start_at);

CREATE TABLE IF NOT EXISTS event_invites (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL,
  player_id   BIGINT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_event_invites_event_id ON event_invites (event_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_player_id ON event_invites (player_id);

CREATE TABLE IF NOT EXISTS attendance (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL,
  player_id   BIGINT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_event_id ON attendance (event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_player_id ON attendance (player_id);

CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL UNIQUE,
  token       TEXT NOT NULL UNIQUE,
  name        TEXT,
  team_ids    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id            BIGSERIAL PRIMARY KEY,
  team_id       BIGINT,
  family_id     BIGINT,
  description   TEXT NOT NULL DEFAULT '',
  due_date      DATE,
  status        TEXT NOT NULL DEFAULT 'pending',
  notes         TEXT,
  payment_type  TEXT NOT NULL DEFAULT 'fixed',
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_team_id ON payments (team_id);
CREATE INDEX IF NOT EXISTS idx_payments_family_id ON payments (family_id);

CREATE TABLE IF NOT EXISTS player_payments (
  id               BIGSERIAL PRIMARY KEY,
  payment_id       BIGINT NOT NULL,
  player_id        BIGINT NOT NULL,
  amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending',
  paid_at          TIMESTAMPTZ,
  waived_at        TIMESTAMPTZ,
  waived_by_user_id TEXT,
  waived_by_name   TEXT,
  waiver_reason    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_payments_payment_id ON player_payments (payment_id);
CREATE INDEX IF NOT EXISTS idx_player_payments_player_id ON player_payments (player_id);

-- ============================================================
-- UNIFORM ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS uniform_orders (
  id                    BIGSERIAL PRIMARY KEY,
  player_id             BIGINT NOT NULL,
  team_id               BIGINT,
  payment_id            BIGINT,
  status                TEXT NOT NULL DEFAULT 'pending',
  jersey_material       TEXT,
  jersey_type           TEXT,
  jersey_size           TEXT,
  jersey_number         TEXT,
  jersey_name           TEXT,
  jersey_color          TEXT,
  shorts_size           TEXT,
  shorts_material       TEXT,
  is_female             BOOLEAN NOT NULL DEFAULT FALSE,
  leggings_size         TEXT,
  fleece_hoodie_size    TEXT,
  fleece_hoodie_color   TEXT,
  fleece_joggers_size   TEXT,
  fleece_joggers_color  TEXT,
  backpack_size         TEXT,
  has_flag_sets         BOOLEAN NOT NULL DEFAULT FALSE,
  duffle_bag_size       TEXT,
  drawstring_bags_qty   INTEGER NOT NULL DEFAULT 0,
  arm_sleeves_qty       INTEGER NOT NULL DEFAULT 0,
  bomber_jacket_qty     INTEGER NOT NULL DEFAULT 0,
  combo_total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  addons_total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  items_total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  order_total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  comments              TEXT,
  ordered_by_user_id    TEXT,
  submitted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uniform_orders_player_id ON uniform_orders (player_id);
CREATE INDEX IF NOT EXISTS idx_uniform_orders_team_id ON uniform_orders (team_id);

-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS team_documents (
  id                  BIGSERIAL PRIMARY KEY,
  team_id             BIGINT,
  family_id           BIGINT,
  title               TEXT NOT NULL,
  description         TEXT,
  file_key            TEXT NOT NULL,
  file_name           TEXT,
  file_size           BIGINT,
  uploaded_by_user_id TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_documents_team_id ON team_documents (team_id);
CREATE INDEX IF NOT EXISTS idx_team_documents_family_id ON team_documents (family_id);

CREATE TABLE IF NOT EXISTS coaches_documents (
  id                  BIGSERIAL PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT,
  file_key            TEXT NOT NULL,
  file_name           TEXT NOT NULL,
  file_size           BIGINT,
  uploaded_by_user_id TEXT,
  uploaded_by_name    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RECRUITING / PROSPECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS prospects (
  id                   BIGSERIAL PRIMARY KEY,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  birth_date           DATE,
  age_group            TEXT,
  email                TEXT,
  phone                TEXT,
  parent_name          TEXT,
  parent_email         TEXT,
  parent_phone         TEXT,
  status               TEXT,
  interest_level       TEXT,
  next_follow_up_date  DATE,
  source               TEXT,
  address              TEXT,
  city                 TEXT,
  state                TEXT,
  zip                  TEXT,
  current_team         TEXT,
  position             TEXT,
  notes                TEXT,
  rating               NUMERIC(3,1),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospect_notes (
  id             BIGSERIAL PRIMARY KEY,
  prospect_id    BIGINT NOT NULL,
  note           TEXT NOT NULL,
  contact_type   TEXT,
  created_by_user_id TEXT,
  created_by_name    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_notes_prospect_id ON prospect_notes (prospect_id);

-- ============================================================
-- SURVEYS
-- ============================================================

CREATE TABLE IF NOT EXISTS surveys (
  id                   BIGSERIAL PRIMARY KEY,
  title                TEXT NOT NULL,
  description          TEXT,
  target_type          TEXT NOT NULL DEFAULT 'all',
  team_ids             TEXT,
  expires_at           TIMESTAMPTZ,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id   TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id              BIGSERIAL PRIMARY KEY,
  survey_id       BIGINT NOT NULL,
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL DEFAULT 'text',
  options         TEXT,
  is_required     BOOLEAN NOT NULL DEFAULT FALSE,
  order_index     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_id ON survey_questions (survey_id);

CREATE TABLE IF NOT EXISTS survey_recipients (
  id          BIGSERIAL PRIMARY KEY,
  survey_id   BIGINT NOT NULL,
  family_id   BIGINT,
  player_id   BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_recipients_survey_id ON survey_recipients (survey_id);

CREATE TABLE IF NOT EXISTS survey_responses (
  id                   BIGSERIAL PRIMARY KEY,
  survey_id            BIGINT NOT NULL,
  family_id            BIGINT,
  player_id            BIGINT,
  submitted_by_user_id TEXT,
  submitted_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses (survey_id);

CREATE TABLE IF NOT EXISTS survey_answers (
  id            BIGSERIAL PRIMARY KEY,
  response_id   BIGINT NOT NULL,
  question_id   BIGINT NOT NULL,
  answer_text   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_answers_response_id ON survey_answers (response_id);

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS team_messages (
  id               BIGSERIAL PRIMARY KEY,
  team_id          BIGINT NOT NULL,
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  author_user_id   TEXT,
  author_name      TEXT,
  is_pinned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_team_id ON team_messages (team_id);

CREATE TABLE IF NOT EXISTS team_message_replies (
  id              BIGSERIAL PRIMARY KEY,
  message_id      BIGINT NOT NULL,
  content         TEXT NOT NULL,
  author_user_id  TEXT,
  author_name     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_message_replies_message_id ON team_message_replies (message_id);

CREATE TABLE IF NOT EXISTS coaches_messages (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  author_user_id  TEXT,
  author_name     TEXT,
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coaches_message_replies (
  id              BIGSERIAL PRIMARY KEY,
  message_id      BIGINT NOT NULL,
  content         TEXT NOT NULL,
  author_user_id  TEXT,
  author_name     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaches_message_replies_message_id ON coaches_message_replies (message_id);

CREATE TABLE IF NOT EXISTS group_messages (
  id               BIGSERIAL PRIMARY KEY,
  subject          TEXT NOT NULL,
  content          TEXT NOT NULL,
  recipient_type   TEXT NOT NULL,
  team_ids         JSONB,
  player_status    TEXT,
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  sent_at          TIMESTAMPTZ,
  sent_by_user_id  TEXT,
  sent_by_name     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_message_recipients (
  id          BIGSERIAL PRIMARY KEY,
  message_id  BIGINT NOT NULL,
  email       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  sent_at     TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_message_recipients_message_id ON group_message_recipients (message_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id                       BIGSERIAL PRIMARY KEY,
  user_id                  TEXT NOT NULL UNIQUE,
  notification_email       TEXT,
  notification_phone       TEXT,
  schedule_changes_email   BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_changes_text    BOOLEAN NOT NULL DEFAULT FALSE,
  rsvp_requests_email      BOOLEAN NOT NULL DEFAULT FALSE,
  rsvp_requests_text       BOOLEAN NOT NULL DEFAULT FALSE,
  team_messages_email      BOOLEAN NOT NULL DEFAULT FALSE,
  team_messages_text       BOOLEAN NOT NULL DEFAULT FALSE,
  coach_messages_email     BOOLEAN NOT NULL DEFAULT FALSE,
  coach_messages_text      BOOLEAN NOT NULL DEFAULT FALSE,
  documents_email          BOOLEAN NOT NULL DEFAULT FALSE,
  documents_text           BOOLEAN NOT NULL DEFAULT FALSE,
  payment_reminders_email  BOOLEAN NOT NULL DEFAULT FALSE,
  payment_reminders_text   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTENT / PUBLIC PAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS news_posts (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  author_name   TEXT,
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  image_key     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_post_images (
  id            BIGSERIAL PRIMARY KEY,
  news_post_id  BIGINT NOT NULL,
  image_key     TEXT NOT NULL,
  caption       TEXT,
  order_index   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_post_images_post_id ON news_post_images (news_post_id);

CREATE TABLE IF NOT EXISTS gallery_photos (
  id           BIGSERIAL PRIMARY KEY,
  image_key    TEXT NOT NULL,
  caption      TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  is_visible   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coaches (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  role         TEXT,
  photo_key    TEXT,
  team_id      BIGINT,
  bio          TEXT,
  email        TEXT,
  phone        TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  is_visible   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BOARDS / SQUARES GAME
-- ============================================================

CREATE TABLE IF NOT EXISTS boards (
  id             BIGSERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  team_top       TEXT NOT NULL,
  team_side      TEXT NOT NULL,
  game_date      TEXT,
  cost_per_square NUMERIC(10,2),
  venmo_handle   TEXT,
  is_open        BOOLEAN NOT NULL DEFAULT TRUE,
  payout_mode    TEXT NOT NULL DEFAULT 'percent',
  payouts        JSONB,
  top_nums       JSONB,
  side_nums      JSONB,
  scores         JSONB,
  lock_at        TIMESTAMPTZ,
  randomized_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  id            BIGSERIAL PRIMARY KEY,
  board_id      BIGINT NOT NULL,
  square_idx    INTEGER NOT NULL,
  buyer_name    TEXT NOT NULL,
  email         TEXT NOT NULL,
  venmo_handle  TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_board_id ON reservations (board_id);

-- ============================================================
-- RAFFLES
-- ============================================================

CREATE TABLE IF NOT EXISTS raffles (
  id                    BIGSERIAL PRIMARY KEY,
  title                 TEXT NOT NULL,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'draft',
  tickets_for_1         INTEGER,
  tickets_for_5         INTEGER,
  tickets_for_10        INTEGER,
  tickets_for_25        INTEGER,
  tickets_for_50        INTEGER,
  tickets_for_100       INTEGER,
  sales_close_at        TIMESTAMPTZ,
  winner_select_at      TIMESTAMPTZ,
  winning_ticket_number TEXT,
  winner_name           TEXT,
  total_collected       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raffle_tickets (
  id            BIGSERIAL PRIMARY KEY,
  raffle_id     BIGINT NOT NULL,
  ticket_number TEXT NOT NULL,
  buyer_name    TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  amount_paid   NUMERIC(10,2) NOT NULL DEFAULT 0,
  seller_name   TEXT,
  is_paid       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (raffle_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_raffle_tickets_raffle_id ON raffle_tickets (raffle_id);

CREATE TABLE IF NOT EXISTS raffle_sellers (
  id          BIGSERIAL PRIMARY KEY,
  raffle_id   BIGINT NOT NULL,
  user_id     TEXT NOT NULL,
  user_name   TEXT,
  user_email  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (raffle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_raffle_sellers_raffle_id ON raffle_sellers (raffle_id);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT,
  user_name    TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    BIGINT,
  entity_name  TEXT,
  team_id      BIGINT,
  family_id    BIGINT,
  details      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log (entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at DESC);

-- ============================================================
-- CONFIGURATION
-- ============================================================

CREATE TABLE IF NOT EXISTS tryout_config (
  id           BIGSERIAL PRIMARY KEY,
  is_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  tryout_date  TEXT,
  title        TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_config (
  id            BIGSERIAL PRIMARY KEY,
  config_key    TEXT NOT NULL UNIQUE,
  config_value  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default banner config rows
INSERT INTO site_config (config_key, config_value) VALUES
  ('banner_enabled', '0'),
  ('banner_text',    ''),
  ('banner_link',    ''),
  ('banner_type',    'info')
ON CONFLICT (config_key) DO NOTHING;
