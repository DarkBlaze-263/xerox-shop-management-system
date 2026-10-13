import { NextRequest, NextResponse } from 'next/server'
import { getHistoryData, getUserIdFromRequest } from '@/lib/server/db'
import { errorResponse } from '@/lib/validate'

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromRequest(request)
    const history = await getHistoryData(userId)
    return NextResponse.json(history)
  } catch (err) {
    return errorResponse(err)
  }
}
