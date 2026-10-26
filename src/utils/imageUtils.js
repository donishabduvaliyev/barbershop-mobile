export const DEFAULT_SHOP_IMAGES = {
  barbershop: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80',
  'hair salon': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
  'nail salon': 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=800&q=80',
  'beauty spas': 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  default: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80',
};

/**
 * Normalizes image URLs for React Native Android:
 * - placehold.co serves SVG by default; appending .png forces raster PNG output which Android Fresco supports.
 * - Empty, invalid, or missing URLs fall back to curated category photos.
 */
export function normalizeShopImageUrl(url, category = 'barbershop') {
  const categoryKey = String(category || '').toLowerCase().trim();
  const fallback = DEFAULT_SHOP_IMAGES[categoryKey] || DEFAULT_SHOP_IMAGES.default;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallback;
  }

  const trimmed = url.trim();

  if (trimmed.includes('placehold.co')) {
    if (trimmed.includes('.png') || trimmed.includes('/png')) {
      return trimmed;
    }
    const [base, query] = trimmed.split('?');
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return query ? `${cleanBase}.png?${query}` : `${cleanBase}.png`;
  }

  return trimmed;
}
