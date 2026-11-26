-- LOGATARA Normalized Database Schema (SQLite / Local Persistent Engine)
-- Mirrors schema.postgres.sql (21 normalized tables including all 20 required tables + vocabulary)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provinces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province_name TEXT NOT NULL UNIQUE,
  province_code TEXT NOT NULL UNIQUE,
  island_group TEXT NOT NULL,
  region_description TEXT NOT NULL,
  cultural_information TEXT NOT NULL,
  illustration_asset TEXT NOT NULL DEFAULT '/assets/environments/kampung-nusantara.png'
);

CREATE TABLE IF NOT EXISTS regional_languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language_name TEXT NOT NULL,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  alternative_names TEXT DEFAULT '',
  language_description TEXT NOT NULL,
  pronunciation_information TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'needs_verification' CHECK (verification_status IN ('verified', 'needs_verification')),
  source_metadata TEXT NOT NULL DEFAULT 'Memerlukan verifikasi penutur asli & Balai Bahasa',
  has_full_curriculum INTEGER NOT NULL DEFAULT 0,
  UNIQUE(language_name, province_id)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '/assets/characters/tara.png',
  current_language_id INTEGER REFERENCES regional_languages(id) ON DELETE SET NULL,
  current_level_number INTEGER NOT NULL DEFAULT 1,
  total_xp INTEGER NOT NULL DEFAULT 0,
  total_stars INTEGER NOT NULL DEFAULT 0,
  daily_streak INTEGER NOT NULL DEFAULT 1,
  last_active_date TEXT,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  pending_walk_from INTEGER,
  pending_walk_to INTEGER,
  bio TEXT DEFAULT 'Penjelajah bahasa dan budaya Nusantara',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_known_languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, language_id)
);

CREATE TABLE IF NOT EXISTS user_learning_languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, language_id)
);

CREATE TABLE IF NOT EXISTS vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  regional_word TEXT NOT NULL,
  indonesian_meaning TEXT NOT NULL,
  pronunciation TEXT NOT NULL,
  example_sentence TEXT NOT NULL,
  example_translation TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'umum',
  register_level TEXT NOT NULL DEFAULT 'Umum',
  audio_asset TEXT DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'needs_verification')),
  source_metadata TEXT NOT NULL DEFAULT 'Dokumentasi Tata Bahasa Standar / Balai Bahasa',
  UNIQUE(language_id, regional_word)
);

CREATE TABLE IF NOT EXISTS learning_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  level_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  location_name TEXT NOT NULL,
  description TEXT NOT NULL,
  required_xp INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 100,
  star_reward INTEGER NOT NULL DEFAULT 3,
  map_x REAL NOT NULL,
  map_y REAL NOT NULL,
  UNIQUE(language_id, level_number)
);

CREATE TABLE IF NOT EXISTS learning_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id INTEGER NOT NULL UNIQUE REFERENCES learning_levels(id) ON DELETE CASCADE,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  vocabulary_json TEXT NOT NULL,
  expressions_json TEXT NOT NULL,
  cultural_context TEXT NOT NULL,
  pronunciation_notes TEXT NOT NULL,
  source_metadata TEXT NOT NULL DEFAULT 'Kurikulum Terverifikasi LOGATARA'
);

CREATE TABLE IF NOT EXISTS game_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_id INTEGER NOT NULL REFERENCES learning_levels(id) ON DELETE CASCADE,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('speaking', 'listening', 'reading', 'writing')),
  title TEXT NOT NULL,
  instructions TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 25,
  order_index INTEGER NOT NULL DEFAULT 1,
  story_json TEXT DEFAULT NULL,
  UNIQUE(level_id, activity_type)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES game_activities(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL REFERENCES learning_levels(id) ON DELETE CASCADE,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  regional_text TEXT NOT NULL DEFAULT '',
  pronunciation_guide TEXT NOT NULL DEFAULT '',
  options_json TEXT DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  accepted_answers_json TEXT DEFAULT '[]',
  explanation TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'pemula',
  order_index INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  activity_id INTEGER NOT NULL REFERENCES game_activities(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL REFERENCES learning_levels(id) ON DELETE CASCADE,
  submitted_answer TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  evaluation_mode TEXT NOT NULL DEFAULT 'exact',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL REFERENCES learning_levels(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  module_completed INTEGER NOT NULL DEFAULT 0,
  speaking_completed INTEGER NOT NULL DEFAULT 0,
  listening_completed INTEGER NOT NULL DEFAULT 0,
  reading_completed INTEGER NOT NULL DEFAULT 0,
  writing_completed INTEGER NOT NULL DEFAULT 0,
  stars_earned INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, level_id)
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  xp_amount INTEGER NOT NULL DEFAULT 0,
  stars_amount INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, source_type, source_key)
);

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  badge_color TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL DEFAULT 1,
  xp_bonus INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS daily_phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
  phrase_date TEXT NOT NULL,
  regional_phrase TEXT NOT NULL,
  indonesian_meaning TEXT NOT NULL,
  pronunciation TEXT NOT NULL,
  cultural_context TEXT NOT NULL,
  example_dialogue_json TEXT NOT NULL,
  source_metadata TEXT NOT NULL DEFAULT 'Kurikulum Terverifikasi LOGATARA',
  UNIQUE(language_id, regional_phrase)
);

CREATE TABLE IF NOT EXISTS saved_vocabulary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id INTEGER REFERENCES vocabulary(id) ON DELETE SET NULL,
  language_id INTEGER NOT NULL REFERENCES regional_languages(id) ON DELETE CASCADE,
  regional_word TEXT NOT NULL,
  indonesian_meaning TEXT NOT NULL,
  pronunciation TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, language_id, regional_word)
);

CREATE TABLE IF NOT EXISTS saved_phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_phrase_id INTEGER NOT NULL REFERENCES daily_phrases(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, daily_phrase_id)
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_id INTEGER REFERENCES regional_languages(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Diskusi dengan LOGATARA AI',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  provider_mode TEXT NOT NULL DEFAULT 'local_knowledge_fallback',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_languages_province ON regional_languages(province_id);
CREATE INDEX IF NOT EXISTS idx_vocab_language ON vocabulary(language_id);
CREATE INDEX IF NOT EXISTS idx_levels_language ON learning_levels(language_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id, language_id);
CREATE INDEX IF NOT EXISTS idx_xp_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_conv ON chat_messages(conversation_id);
