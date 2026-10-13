import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME, isValidUserId, type UserId } from '@/lib/auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignore static assets, internal next files, api routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const cookieUser = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const isAuthenticated = isValidUserId(cookieUser)

  // Root path '/'
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(`/dashboard/${cookieUser}`, request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Login page '/login'
  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(`/dashboard/${cookieUser}`, request.url))
    }
    return NextResponse.next()
  }

  // Protected dashboard routes '/dashboard/...'
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
}
