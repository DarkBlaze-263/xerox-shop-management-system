import { NextRequest, NextResponse } from 'next/server'
import { getSettings, updateSettings } from '@/lib/server/db'
import type { PriceItem } from '@/lib/types'
import { ValidationError, cleanMoney, cleanText, errorResponse, newId } from '@/lib/validate'

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json(settings)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!Array.isArray(body?.priceList) || body.priceList.length > 300) {
      throw new ValidationError('Invalid price list format')
    }

    const priceList: PriceItem[] = body.priceList.map((raw: Record<string, unknown>) => ({
      id: typeof raw?.id === 'string' && raw.id ? raw.id.slice(0, 100) : newId(),
      name: cleanText(raw?.name, 60, true),
      price: cleanMoney(raw?.price, 100_000),
      category: raw?.category === 'stationery' ? 'stationery' : 'xerox',
    }))

    const shopName = cleanText(body?.shopName, 60) || 'My Xerox Shop'
    const updated = await updateSettings(shopName, priceList)
    return NextResponse.json(updated)
  } catch (err) {
    return errorResponse(err)
  }
}
