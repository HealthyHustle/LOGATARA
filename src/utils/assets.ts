/**
 * Resolves public asset URLs safely across both root hosting ("/")
 * and subpath hosting such as GitHub Pages ("/BUDAYAGO/").
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.replace(/^\/+/, '');
  return `${normalizedBase}${cleanPath}`;
}
