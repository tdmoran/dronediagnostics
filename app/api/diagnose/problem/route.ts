import { NextRequest, NextResponse } from 'next/server';
import { 
  diagnoseProblem, 
  ProblemType, 
  runHardwareChecks,
  DiagnosisResult 
} from '@/lib/diagnostics';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { problem } = body;

    if (!problem) {
      return NextResponse.json(
        { error: 'Problem type is required' },
        { status: 400 }
      );
    }

    const validProblems: ProblemType[] = [
      'wont_arm',
      'unstable_flight',
      'gps_no_fix',
      'motors_not_spinning',
      'motors_no_thrust',
      'receiver_no_signal',
      'battery_voltage_wrong',
      'fc_not_connecting',
      'gyro_drift',
      'failsafe_issues',
    ];

    if (!validProblems.includes(problem)) {
      return NextResponse.json(
        { error: 'Invalid problem type' },
        { status: 400 }
      );
    }

    // Run hardware checks first
    const hardwareReport = await runHardwareChecks();
    
    // Then diagnose the specific problem
    const diagnosis = await diagnoseProblem(problem, hardwareReport);

    return NextResponse.json(diagnosis);
  } catch (error) {
    console.error('Problem diagnosis failed:', error);
    return NextResponse.json(
      { error: 'Failed to diagnose problem' },
      { status: 500 }
    );
  }
}
