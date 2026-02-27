'use client';

import { useState, useEffect } from 'react';
import { 
  ProblemType, 
  DiagnosisResult, 
  HardwareReport,
  HardwareCheck,
  HardwareStatus 
} from '@/lib/diagnostics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  HelpCircle,
  Activity,
  Cpu,
  Zap,
  Navigation,
  Radio,
  Gauge,
  RotateCcw,
  Cog,
  Play
} from 'lucide-react';

const problemOptions: { value: ProblemType; label: string }[] = [
  { value: 'wont_arm', label: 'Drone won\'t arm' },
  { value: 'unstable_flight', label: 'Unstable flight / oscillations' },
  { value: 'gps_no_fix', label: 'GPS not working / no fix' },
  { value: 'motors_not_spinning', label: 'Motors not spinning' },
  { value: 'motors_no_thrust', label: 'Motors spin but no thrust' },
  { value: 'receiver_no_signal', label: 'Receiver not working / no signal' },
  { value: 'battery_voltage_wrong', label: 'Battery voltage wrong' },
  { value: 'fc_not_connecting', label: 'FC not connecting' },
  { value: 'gyro_drift', label: 'Gyro drift' },
  { value: 'failsafe_issues', label: 'Failsafe issues' },
];

function getStatusIcon(status: HardwareStatus) {
  switch (status) {
    case 'working':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'warning':
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'not_detected':
      return <HelpCircle className="h-5 w-5 text-gray-400" />;
  }
}

function getStatusBadge(status: HardwareStatus) {
  switch (status) {
    case 'working':
      return <Badge className="bg-green-500">✅ Working</Badge>;
    case 'warning':
      return <Badge className="bg-yellow-500">⚠️ Warning</Badge>;
    case 'failed':
      return <Badge className="bg-red-500">❌ Failed</Badge>;
    case 'not_detected':
      return <Badge variant="secondary">⏭️ Not Detected</Badge>;
  }
}

export default function DiagnosePage() {
  const [selectedProblem, setSelectedProblem] = useState<ProblemType | ''>('');
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [hardwareReport, setHardwareReport] = useState<HardwareReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [hardwareLoading, setHardwareLoading] = useState(false);
  const [fixDialog, setFixDialog] = useState<{open: boolean; title: string; message: string}>({
    open: false,
    title: '',
    message: ''
  });

  // Run hardware checks on mount
  useEffect(() => {
    runHardwareCheck();
  }, []);

  async function runHardwareCheck() {
    setHardwareLoading(true);
    try {
      const response = await fetch('/api/diagnose/hardware');
      if (response.ok) {
        const report = await response.json();
        setHardwareReport(report);
      }
    } catch (error) {
      console.error('Failed to run hardware check:', error);
    } finally {
      setHardwareLoading(false);
    }
  }

  async function diagnose() {
    if (!selectedProblem) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/diagnose/problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem: selectedProblem }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setDiagnosis(result);
      }
    } catch (error) {
      console.error('Diagnosis failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function executeQuickFix(action: string, title: string) {
    setFixDialog({ open: true, title: `${title}...`, message: 'Please wait...' });
    
    try {
      const response = await fetch('/api/quickfix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setFixDialog({ open: true, title: 'Complete', message: result.message });
        // Refresh hardware check after fix
        setTimeout(runHardwareCheck, 1000);
      } else {
        setFixDialog({ open: true, title: 'Error', message: 'Failed to execute fix' });
      }
    } catch (error) {
      setFixDialog({ open: true, title: 'Error', message: 'Network error' });
    }
  }

  const healthStatus = hardwareReport ? {
    score: hardwareReport.overallHealth,
    status: hardwareReport.overallHealth >= 90 ? 'excellent' : 
            hardwareReport.overallHealth >= 70 ? 'good' :
            hardwareReport.overallHealth >= 50 ? 'fair' : 'poor',
    color: hardwareReport.overallHealth >= 90 ? 'bg-green-500' : 
           hardwareReport.overallHealth >= 70 ? 'bg-blue-500' :
           hardwareReport.overallHealth >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  } : null;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Drone Diagnostics</h1>
        <p className="text-muted-foreground">
          Analyze hardware status and diagnose flight issues
        </p>
      </div>

      {/* Health Score Card */}
      {healthStatus && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6" />
                <div>
                  <h3 className="font-semibold">Health Score</h3>
                  <p className="text-sm text-muted-foreground capitalize">{healthStatus.status}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold">{healthStatus.score}</span>
                <span className="text-muted-foreground">/100</span>
              </div>
            </div>
            <Progress value={healthStatus.score} className={`h-3 ${healthStatus.color}`} />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>Poor</span>
              <span>Fair</span>
              <span>Good</span>
              <span>Excellent</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hardware Status Grid */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Hardware Status
            </CardTitle>
            <CardDescription>
              Automatic hardware validation results
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runHardwareCheck}
            disabled={hardwareLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${hardwareLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {hardwareLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : hardwareReport ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{hardwareReport.summary.working}</div>
                  <div className="text-xs text-green-700">✅ Working</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{hardwareReport.summary.warning}</div>
                  <div className="text-xs text-yellow-700">⚠️ Warning</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{hardwareReport.summary.failed}</div>
                  <div className="text-xs text-red-700">❌ Failed</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{hardwareReport.summary.notDetected}</div>
                  <div className="text-xs text-gray-700">⏭️ Not Detected</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{hardwareReport.checks.length}</div>
                  <div className="text-xs text-blue-700">Total Checks</div>
                </div>
              </div>

              <div className="space-y-2">
                {hardwareReport.checks.map((check) => (
                  <div 
                    key={check.name} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(check.status)}
                      <div>
                        <div className="font-medium">{check.name}</div>
                        <div className="text-sm text-muted-foreground">{check.message}</div>
                        {check.details && (
                          <div className="text-xs text-muted-foreground mt-1">{check.details}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {check.value !== undefined && (
                        <span className="text-sm font-medium">
                          {check.value} {check.unit}
                        </span>
                      )}
                      {getStatusBadge(check.status)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Click Refresh to run hardware checks
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Fixes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Quick Fixes
          </CardTitle>
          <CardDescription>
            Common troubleshooting actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={() => executeQuickFix('recalibrate_gyro', 'Recalibrating Gyro')}
              variant="outline"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Recalibrate Gyro
            </Button>
            <Button 
              onClick={() => executeQuickFix('reset_defaults', 'Resetting to Defaults')}
              variant="outline"
            >
              <Cog className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <Button 
              onClick={() => executeQuickFix('motor_test', 'Running Motor Test')}
              variant="outline"
            >
              <Play className="h-4 w-4 mr-2" />
              Run Motor Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Problem Diagnosis */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Problem Diagnosis
          </CardTitle>
          <CardDescription>
            Select a problem to get diagnostic help
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-6">
            <Select value={selectedProblem} onValueChange={(v) => setSelectedProblem(v as ProblemType)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a problem..." />
              </SelectTrigger>
              <SelectContent>
                {problemOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={diagnose} 
              disabled={!selectedProblem || loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Diagnose
            </Button>
          </div>

          {/* Diagnosis Results */}
          {diagnosis && (
            <div className="space-y-6">
              {/* Quick Checks Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Alert className="border-green-500">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle>Checks Passed ({diagnosis.quickChecks.passed.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm mt-2">
                      {diagnosis.quickChecks.passed.map((check, i) => (
                        <li key={i}>{check}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
                
                {diagnosis.quickChecks.failed.length > 0 && (
                  <Alert className="border-red-500">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <AlertTitle>Checks Failed ({diagnosis.quickChecks.failed.length})</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm mt-2">
                        {diagnosis.quickChecks.failed.map((check, i) => (
                          <li key={i}>{check}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Probable Causes */}
              <div>
                <h3 className="font-semibold mb-4">Probable Causes (Ranked by Likelihood)</h3>
                <div className="space-y-4">
                  {diagnosis.causes.map((cause, index) => (
                    <Card key={cause.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge 
                              variant={cause.likelihood === 'high' ? 'destructive' : 
                                      cause.likelihood === 'medium' ? 'default' : 'secondary'}
                            >
                              #{index + 1} {cause.likelihood.toUpperCase()}
                            </Badge>
                            <h4 className="font-semibold text-lg">{cause.title}</h4>
                          </div>
                        </div>
                        
                        <p className="text-muted-foreground mb-4">{cause.description}</p>
                        
                        <div className="space-y-3">
                          <div>
                            <span className="font-medium text-sm">Why this happens:</span>
                            <p className="text-sm text-muted-foreground">{cause.why}</p>
                          </div>
                          
                          <div>
                            <span className="font-medium text-sm">How to fix:</span>
                            <ol className="list-decimal list-inside text-sm text-muted-foreground mt-1">
                              {cause.fix.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>

                          {cause.wikiLink && (
                            <a 
                              href={cause.wikiLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-blue-500 hover:underline"
                            >
                              <Navigation className="h-3 w-3 mr-1" />
                              View Betaflight Wiki
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fix Dialog */}
      <Dialog open={fixDialog.open} onOpenChange={(open) => setFixDialog({...fixDialog, open})}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fixDialog.title}</DialogTitle>
            <DialogDescription>{fixDialog.message}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
