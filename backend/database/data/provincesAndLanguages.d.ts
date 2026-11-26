export const PROVINCES: Array<{
  province_code: string;
  province_name: string;
  island_group: string;
  region_description: string;
  cultural_information: string;
}>;
export const REGIONAL_LANGUAGES: Array<{
  language_name: string;
  province_code: string;
  alternative_names: string;
  language_description: string;
  pronunciation_information: string;
  verification_status: 'verified' | 'needs_verification';
  source_metadata: string;
  has_full_curriculum: number;
}>;
