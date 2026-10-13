export type UserId = 'user1' | 'user2' | 'user3'

export type UserAccount = {
  id: UserId
  name: string
  label: string
  role: string
  defaultPin: string
  destinedPath: string
  badgeColor: string
  accentColor: string
  description: string
}

export const USERS: Record<UserId, UserAccount> = {
  user1: {
    id: 'user1',
    name: 'User 1',
    label: 'Counter 1 (Main Xerox & Print)',
    role: 'Primary Billing Counter',
    defaultPin: '1111',
    destinedPath: '/dashboard/user1',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    accentColor: 'from-blue-600 to-indigo-600',
    description: 'High-speed Xerox, Color Prints, Scanning & General POS',
  },
  user2: {
    id: 'user2',
    name: 'User 2',
    label: 'Counter 2 (Stationery & Binding)',
    role: 'Stationery & Finishing Counter',
    defaultPin: '2222',
    destinedPath: '/dashboard/user2',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    accentColor: 'from-emerald-600 to-teal-600',
    description: 'Lamination, Spiral Binding, Paper bundles, Books & Stationery',
  },
  user3: {
    id: 'user3',
    name: 'User 3',
    label: 'Counter 3 / Store Manager',
    role: 'Manager & Audit Counter',
    defaultPin: '3333',
    destinedPath: '/dashboard/user3',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    accentColor: 'from-purple-600 to-pink-600',
    description: 'All-round Billing, Daily Expense Audit & Price Configuration',
  },
}

export const VALID_USER_IDS: UserId[] = ['user1', 'user2', 'user3']

export function isValidUserId(id: unknown): id is UserId {
  return typeof id === 'string' && VALID_USER_IDS.includes(id as UserId)
}

export const AUTH_COOKIE_NAME = 'xerox_auth_user'
export const AUTH_STORAGE_KEY = 'xerox_active_user'

/**
 * Get active user from client-side storage or cookie
 */
export function getClientActiveUser(): UserId | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (isValidUserId(stored)) return stored
  } catch {
    // Ignore localStorage errors
  }

  // Fallback to cookie
  try {
    const cookies = document.cookie.split(';')
    for (const c of cookies) {
      const [key, val] = c.trim().split('=')
      if (key === AUTH_COOKIE_NAME && isValidUserId(val)) {
        return val
      }
    }
  } catch {
    // Ignore cookie errors
  }

  return null
}

/**
 * Save authenticated user to client
 */
export function setClientActiveUser(userId: UserId) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(AUTH_STORAGE_KEY, userId)
  } catch {
    // Ignore
  }

  // Set cookie for 30 days
  const maxAge = 60 * 60 * 24 * 30
  document.cookie = `${AUTH_COOKIE_NAME}=${userId}; path=/; max-age=${maxAge}; SameSite=Lax`
}

/**
 * Clear authenticated user from client
 */
export function clearClientActiveUser() {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Ignore
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}
