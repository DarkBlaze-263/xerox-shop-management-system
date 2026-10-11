import crypto from 'node:crypto'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export class ValidationError extends Error {}

export function assertDate(value: unknown): string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new ValidationError('Invalid date format. Expected YYYY-MM-DD')
  }
  return value
}

export function cleanText(value: unknown, max: number, required = false): string {
  const text = typeof value === 'string' ? value.trim().slice(0, max) : ''
  if (required && !text) throw new ValidationError('Required text is missing')
  return text
}

export function cleanMoney(value: unknown, max = 1_000_000): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0 || n > max) {
    throw new ValidationError('Invalid amount')
  }
  return Math.round(n * 100) / 100
}

export function cleanQty(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 100_000) {
    throw new ValidationError('Quantity must be a whole number above 0')
  }
  return n
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // fallback
    }
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)
}

export function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 })
  }
  console.error('API Error:', error)
  const message = error instanceof Error ? error.message : 'Something went wrong'
  return Response.json({ error: message }, { status: 500 })
}
