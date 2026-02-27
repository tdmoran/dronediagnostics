import { NextResponse } from 'next/server';
import { runHardwareChecks, HardwareReport } from '@/lib/diagnostics';

export async function GET(): Promise<NextResponse> {
  try {
    const report = await runHardwareChecks();
    return NextResponse.json(report);
  } catch (error) {
    console.error('Hardware check failed:', error);
    return NextResponse.json(
      { error: 'Failed to run hardware checks' },
      { status: 500 }
    );
  }
}
