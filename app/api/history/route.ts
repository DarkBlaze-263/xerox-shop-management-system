import { NextResponse } from 'next/server'
import { getHistoryData } from '@/lib/server/db'
import { errorResponse } from '@/lib/validate'

export async function GET() {
  try {
    const history = await getHistoryData()
    return NextResponse.json(history)
  } catch (err) {
    return errorResponse(err)
  }
}
