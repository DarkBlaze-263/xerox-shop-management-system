import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, isValidUserId, USERS, type UserId } from '@/lib/auth'
import { ValidationError, cleanText, errorResponse } from '@/lib/validate'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = cleanText(body?.userId, 20) as UserId
    const pin = cleanText(body?.pin, 20)

    if (!isValidUserId(userId)) {
      throw new ValidationError('Invalid user selected. Please select User 1, User 2, or User 3.')
    }

    const user = USERS[userId]
    if (!user) {
      throw new ValidationError('User account not found.')
    }

    // Verify PIN against default or environment overrides
    const expectedPin = process.env[`PIN_${userId.toUpperCase()}`] || user.defaultPin

    if (pin !== expectedPin) {
      throw new ValidationError(`Incorrect PIN for ${user.name}. Hint: default PIN is ${user.defaultPin}`)
    }

    const response = NextResponse.json({
      ok: true,
      message: 'Authentication successful',
      user: {
        id: user.id,
        name: user.name,
        label: user.label,
        role: user.role,
        destinedPath: user.destinedPath,
      },
    })

    // Set auth cookie for 30 days
    const maxAge = 60 * 60 * 24 * 30
    response.cookies.set(AUTH_COOKIE_NAME, userId, {
      path: '/',
      maxAge,
      sameSite: 'lax',
      httpOnly: false, // Accessible to client for instant hydrate
    })

    return response
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true, message: 'Logged out successfully' })
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  })
  return response
}

export async function GET(request: NextRequest) {
  const cookieUser = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const headerUser = request.headers.get('x-user-id')
  const activeId = (isValidUserId(cookieUser) ? cookieUser : isValidUserId(headerUser) ? headerUser : null) as UserId | null

  if (!activeId || !USERS[activeId]) {
    return NextResponse.json({ authenticated: false, user: null })
  }

  const user = USERS[activeId]
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      label: user.label,
      role: user.role,
      destinedPath: user.destinedPath,
    },
  })
}
