import { notFound } from 'next/navigation'
import { isValidUserId, USERS, type UserId } from '@/lib/auth'
import { ShopApp } from '@/components/shop/shop-app'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params
  if (!isValidUserId(userId)) {
    return { title: 'User Not Found' }
  }
  const user = USERS[userId]
  return {
    title: `${user.name} Dashboard - ${user.label} | Xerox Shop`,
    description: `Billing, Daily Accounts and Transactions for ${user.name} (${user.label}).`,
  }
}

export default async function DashboardPage({ params }: Props) {
  const { userId } = await params

  if (!isValidUserId(userId)) {
    notFound()
  }

  return <ShopApp userId={userId} />
}
