'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  HelpCircle,
  Cpu,
  Zap,
  Radio,
  MapPin,
  ArrowRight,
  RefreshCw,
  Wrench
} from 'lucide-react';
import { HardwareReport, runHardwareChecks } from '@/lib/diagnostics';

export default function DashboardPage() {
  const [hardwareReport, setHardwareReport] = useState<HardwareReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHardwareStatus();
  }, []);

  async function loadHardwareStatus() {
    setLoading(true);
    try {
      const report = await runHardwareChecks();
      setHardwareReport(report);
    } catch (error) {
      console.error('Failed to load hardware status:', error);
    } finally {
      setLoading(false);
    }
  }

  const healthStatus = hardwareReport ? {
    score: hardwareReport.overallHealth,
    status: hardwareReport.overallHealth >= 90 ? 'excellent' : 
            hardwareReport.overallHealth >= 70 ? 'good' :
            hardwareReport.overallHealth >= 50 ? 'fair' : 'poor',
    color: hardwareReport.overallHealth >= 90 ? 'text-green-600' : 
           hardwareReport.overallHealth >= 70 ? 'text-blue-600' :
           hardwareReport.overallHealth >= 50 ? 'text-yellow-600' : 'text-red-600',
    bgColor: hardwareReport.overallHealth >= 90 ? 'bg-green-500' : 
             hardwareReport.overallHealth >= 70 ? 'bg-blue-500' :
             hardwareReport.overallHealth >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  } : null;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your drone's health and status
        </p>
      </div>

      {/* Health Score Card */}
      {healthStatus && (
        <Card className="mb-6 border-2 border-blue-500">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${healthStatus.bgColor} bg-opacity-20`}>
                  <Activity className={`h-8 w-8 ${healthStatus.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Health Score</h2>
                  <p className={`text-sm capitalize ${healthStatus.color} font-medium`}>
                    {healthStatus.status}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-5xl font-bold ${healthStatus.color}`}>
                  {healthStatus.score}
                </span>
                <span className="text-xl text-muted-foreground">/100</span>
              </div>
            </div>
            
            <Progress 
              value={healthStatus.score} 
              className={`h-4 ${healthStatus.bgColor}`} 
            />
            
            <div className="flex justify-between mt-3 text-sm text-muted-foreground">
              <span>Poor</span>
              <span>Fair</span>
              <span>Good</span>
              <span>Excellent</span>
            </div>

            {hardwareReport && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm">
                    <span className="font-bold">{hardwareReport.summary.working}</span> Working
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm">
                    <span className="font-bold">{hardwareReport.summary.warning}</span> Warning
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm">
                    <span className="font-bold">{hardwareReport.summary.failed}</span> Failed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-gray-400" />
                  <span className="text-sm">
                    <span className="font-bold">{hardwareReport.summary.notDetected}</span> Not Detected
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Link href="/diagnose">
                <Button>
                  <Wrench className="h-4 w-4 mr-2" />
                  Open Diagnostics
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={loadHardwareStatus}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">FC Status</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500">Connected</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Betaflight 4.4.3</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Battery</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">16.4V</div>
            <p className="text-xs text-muted-foreground">4S LiPo - 85% charged</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">GPS</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500">3D Fix</Badge>
            </div>
            <p className="text-xs text-muted-foreground">14 satellites tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receiver</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500">Connected</Badge>
            </div>
            <p className="text-xs text-muted-foreground">CRSF - RSSI: -45dBm</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Issues */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Diagnostics</CardTitle>
          <CardDescription>
            Quick access to diagnostic tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Link href="/diagnose">
              <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Problem Diagnosis</p>
                    <p className="text-sm text-muted-foreground">Troubleshoot common issues</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Cpu className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Hardware Validation</p>
                  <p className="text-sm text-muted-foreground">All systems nominal</p>
                </div>
              </div>
              <Badge variant="secondary">Just now</Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-medium">Barometer</p>
                  <p className="text-sm text-muted-foreground">Not detected - optional component</p>
                </div>
              </div>
              <Badge variant="secondary">Info</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
