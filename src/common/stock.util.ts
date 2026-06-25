export const LOW_STOCK_THRESHOLD = 5

export const getAvailabilityLabel = (stock: number): string => {
  if (stock <= 0) return 'Currently unavailable'
  if (stock <= LOW_STOCK_THRESHOLD) return 'Limited stock — order soon'
  return 'In stock'
}
