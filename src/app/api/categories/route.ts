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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, bestseller_url, status = 'ready' } = body;

    if (!name || !url) {
      return NextResponse.json(
        { success: false, error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    console.log('📝 Creating new category:', { name, url, bestseller_url, status });

    const newCategory = await categoryService.insert().run(name, url, bestseller_url, status);
    
    console.log('✅ Category created successfully:', newCategory);

    return NextResponse.json({ 
      success: true, 
      data: newCategory,
      message: `Category "${name}" created successfully` 
    });
  } catch (error: any) {
    console.error('❌ Error creating category:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
