import { NextRequest, NextResponse } from 'next/server'
import { getDayData, getUserIdFromRequest, updateOpeningCash } from '@/lib/server/db'
import { assertDate, cleanMoney, errorResponse } from '@/lib/validate'

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const searchParams = request.nextUrl.searchParams
    const date = assertDate(searchParams.get('date'))
    const day = await getDayData(userId, date)
    return NextResponse.json(day)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const body = await request.json()
    const date = assertDate(body?.date)
    const openingCash = cleanMoney(body?.openingCash)
    const updated = await updateOpeningCash(userId, date, openingCash)
    return NextResponse.json(updated)
  } catch (err) {
    return errorResponse(err)
  }
}
