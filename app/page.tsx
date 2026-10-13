'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClientActiveUser, isValidUserId } from '@/lib/auth'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const user = getClientActiveUser()
    if (user && isValidUserId(user)) {
      router.replace(`/dashboard/${user}`)
    } else {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground text-sm">
        <div className="size-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p>Routing to your counter terminal...</p>
      </div>
    </div>
  )
}
