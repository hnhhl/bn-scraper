import { NextRequest, NextResponse } from 'next/server';
import { categoryService } from '@/lib/database-supabase';

export async function GET() {
  try {
    const categories = await categoryService.getAll().all();
    return NextResponse.json({ success: true, data: categories });
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
