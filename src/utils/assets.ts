/**
 * Resolves public asset URLs safely across both root hosting ("/")
 * and subpath hosting such as GitHub Pages ("/BUDAYAGO/").
 * Passes through data: URIs (e.g., uploaded custom avatars) and external http(s) URLs untouched.
 */
export function assetUrl(path: string): string {
  if (!path) return '';
  if (
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.replace(/^\/+/, '');
  // Avoid double-prefixing if path already starts with BASE_URL
  if (normalizedBase !== '/' && path.startsWith(normalizedBase)) {
    return path;
  }
  return `${normalizedBase}${cleanPath}`;
}
