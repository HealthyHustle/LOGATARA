export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string;
  current_language_id: number | null;
  current_level_number: number;
  total_xp: number;
  total_stars: number;
  daily_streak: number;
  onboarding_completed: boolean;
  pending_walk_from: number | null;
  pending_walk_to: number | null;
  bio: string;
  current_language?: RegionalLanguage | null;
}

export interface Province {
  id: number;
  province_name: string;
  province_code: string;
  island_group: string;
  region_description: string;
  cultural_information: string;
  illustration_asset: string;
  languages: RegionalLanguage[];
}

export interface RegionalLanguage {
  id: number;
  language_name: string;
  province_id: number;
  province_name?: string;
  province_code?: string;
  island_group?: string;
  alternative_names: string;
  language_description: string;
  pronunciation_information: string;
  verification_status: 'verified' | 'needs_verification';
  source_metadata: string;
  has_full_curriculum: boolean;
  vocab_count?: number;
}

export interface AdventureLevel {
  id: number;
  language_id: number;
  level_number: number;
  title: string;
  location_name: string;
  description: string;
  required_xp: number;
  xp_reward: number;
  star_reward: number;
  map_x: number;
  map_y: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  module_completed: boolean;
  speaking_completed: boolean;
  listening_completed: boolean;
  reading_completed: boolean;
  writing_completed: boolean;
  stars_earned: number;
  xp_earned: number;
  completed_at?: string | null;
}

export interface VillageLocation {
  id: string;
  name: string;
  levelNumber: number;
  levelId: number | null;
  subtitle: string;
  x: number;
  y: number;
  description: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  starsEarned: number;
}

export interface VocabularyEntry {
  id: number;
  language_id: number;
  language_name?: string;
  province_name?: string;
  regional_word: string;
  indonesian_meaning: string;
  pronunciation: string;
  example_sentence: string;
  example_translation: string;
  category: string;
  register_level: string;
  verification_status: 'verified' | 'needs_verification';
  source_metadata: string;
  is_saved?: boolean;
}

export interface ModuleVocabItem {
  word: string;
  meaning: string;
  pron: string;
  ex: string;
  exTr: string;
  register?: string;
}

export interface LearningModule {
  id: number;
  title: string;
  summary: string;
  vocabulary: ModuleVocabItem[];
  expressions: Array<{
    regional: string;
    indonesian: string;
    pronunciation: string;
    register?: string;
  }>;
  cultural_context: string;
  pronunciation_notes: string;
  source_metadata: string;
}

export interface ActivityQuestion {
  id: number;
  activity_id: number;
  question_type: string;
  prompt: string;
  regional_text: string;
  pronunciation_guide: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
  order_index: number;
}

export interface GameActivity {
  id: number;
  activity_type: 'speaking' | 'listening' | 'reading' | 'writing';
  title: string;
  instructions: string;
  xp_reward: number;
  order_index: number;
  completed: boolean;
  story: {
    title: string;
    location: string;
    paragraphs: string[];
    culturalNote: string;
    highlights: Array<{ word: string; meaning: string; pronunciation: string }>;
  } | null;
  questions: ActivityQuestion[];
}

export interface Achievement {
  id: number;
  code: string;
  title: string;
  description: string;
  icon: string;
  badge_color: string;
  requirement_type: string;
  requirement_value: number;
  xp_bonus: number;
  unlocked?: boolean;
  unlocked_at?: string | null;
}

export interface DailyPhrase {
  id: number;
  language_id: number;
  province_id: number;
  language_name: string;
  province_name: string;
  island_group?: string;
  phrase_date: string;
  regional_phrase: string;
  indonesian_meaning: string;
  pronunciation: string;
  cultural_context: string;
  example_dialogue: Array<{ speaker: string; text: string }>;
  source_metadata: string;
  is_saved: boolean;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  provider_mode: string;
  created_at: string;
}
