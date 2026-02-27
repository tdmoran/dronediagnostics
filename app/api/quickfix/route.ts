import { NextRequest, NextResponse } from 'next/server';
import { 
  recalibrateGyro, 
  resetToDefaults, 
  runMotorTest 
} from '@/lib/diagnostics';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'recalibrate_gyro':
        result = await recalibrateGyro();
        break;
      case 'reset_defaults':
        result = await resetToDefaults();
        break;
      case 'motor_test':
        result = await runMotorTest();
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Quick fix failed:', error);
    return NextResponse.json(
      { error: 'Failed to execute quick fix' },
      { status: 500 }
    );
  }
}
