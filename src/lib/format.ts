export function formatINR(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function formatDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function safeImageSrc(src?: string): string {
  if (!src) return '/src/assets/images/prod_smartphone_pro_1795581229943.jpg';
  if (src.startsWith('/src/assets/') || src.startsWith('/uploads/') || src.startsWith('https://') || src.startsWith('http://')) {
    return src;
  }
  return '/src/assets/images/prod_smartphone_pro_1795581229943.jpg';
}
