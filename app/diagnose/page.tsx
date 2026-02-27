"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Activity,
  Cpu,
  Zap,
  RotateCcw,
  Cog,
  Play,
} from "lucide-react";
import { Skeleton, SkeletonCard, SkeletonStatCard } from "@/components/ui/skeleton";
import { useConnectionToasts } from "@/hooks/use-toast";

const problemOptions = [
  { value: "wont_arm", label: "Drone won't arm" },
  { value: "unstable_flight", label: "Unstable flight / oscillations" },
  { value: "gps_no_fix", label: "GPS not working / no fix" },
  { value: "motors_not_spinning", label: "Motors not spinning" },
  { value: "motors_no_thrust", label: "Motors spin but no thrust" },
  { value: "receiver_no_signal", label: "Receiver not working / no signal" },
  { value: "battery_voltage_wrong", label: "Battery voltage wrong" },
  { value: "fc_not_connecting", label: "FC not connecting" },
  { value: "gyro_drift", label: "Gyro drift" },
  { value: "failsafe_issues", label: "Failsafe issues" },
];

function getStatusIcon(status: string) {
  switch (status) {
    case "working":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "warning":
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <HelpCircle className="h-5 w-5 text-gray-400" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "working":
      return <Badge className="bg-green-500">Working</Badge>;
    case "warning":
      return <Badge className="bg-yellow-500">Warning</Badge>;
    case "failed":
      return <Badge className="bg-red-500">Failed</Badge>;
    default:
      return <Badge variant="secondary">Not Detected</Badge>;
  }
}

// Skeleton components for loading states
function HealthScoreSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-3 w-full mb-4" />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

function HardwareStatusSkeleton() {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function DiagnosePage() {
  const [selectedProblem, setSelectedProblem] = useState("");
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [hardwareReport, setHardwareReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [fixDialog, setFixDialog] = useState({
    open: false,
    title: "",
    message: "",
  });

  const { showCalibrationStarted } = useConnectionToasts();

  // Run hardware checks on mount
  useEffect(() => {
    runHardwareCheck();
  }, []);

  async function runHardwareCheck() {
    setHardwareLoading(true);
    try {
      const response = await fetch("/api/diagnose/hardware");
      if (response.ok) {
        const report = await response.json();
        setHardwareReport(report);
      }
    } catch (error) {
      console.error("Failed to run hardware check:", error);
    } finally {
      setHardwareLoading(false);
    }
  }

  async function diagnose() {
    if (!selectedProblem) return;

    setLoading(true);
    try {
      const response = await fetch("/api/diagnose/problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: selectedProblem }),
      });

      if (response.ok) {
        const result = await response.json();
        setDiagnosis(result);
      }
    } catch (error) {
      console.error("Diagnosis failed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function executeQuickFix(action: string, title: string) {
    setFixDialog({ open: true, title: `${title}...`, message: "Please wait..." });

    if (action === "recalibrate_gyro") {
      showCalibrationStarted("gyro");
    }

    try {
      const response = await fetch("/api/quickfix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const result = await response.json();
        setFixDialog({ open: true, title: "Complete", message: result.message });
        setTimeout(runHardwareCheck, 1000);
      } else {
        setFixDialog({
          open: true,
          title: "Error",
          message: "Failed to execute fix",
        });
      }
    } catch (error) {
      setFixDialog({ open: true, title: "Error", message: "Network error" });
    }
  }

  const healthStatus = hardwareReport
    ? {
        score: hardwareReport.overallHealth,
        status:
          hardwareReport.overallHealth >= 90
            ? "excellent"
            : hardwareReport.overallHealth >= 70
            ? "good"
            : hardwareReport.overallHealth >= 50
            ? "fair"
            : "poor",
        color:
          hardwareReport.overallHealth >= 90
            ? "bg-green-500"
            : hardwareReport.overallHealth >= 70
            ? "bg-blue-500"
            : hardwareReport.overallHealth >= 50
            ? "bg-yellow-500"
            : "bg-red-500",
      }
    : null;

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-xl lg:text-2xl font-bold text-white">Drone Diagnostics</h1>
        <p className="text-gray-400 mt-1 text-sm lg:text-base">
          Analyze hardware status and diagnose flight issues
        </p>
      </div>

      {/* Health Score Card */}
      {hardwareLoading ? (
        <HealthScoreSkeleton />
      ) : healthStatus ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-blue-500" />
              <div>
                <h3 className="font-semibold text-white">Health Score</h3>
                <p className="text-sm text-gray-400 capitalize">{healthStatus.status}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-3xl font-bold text-white">{healthStatus.score}</span>
              <span className="text-gray-400">/100</span>
            </div>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${healthStatus.color} transition-all duration-500`}
              style={{ width: `${healthStatus.score}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs lg:text-sm text-gray-500">
            <span>Poor</span>
            <span>Fair</span>
            <span>Good</span>
            <span>Excellent</span>
          </div>
        </div>
      ) : null}

      {/* Hardware Status Grid */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-5 lg:p-6 border-b border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Cpu className="h-5 w-5 text-blue-500" />
                Hardware Status
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Automatic hardware validation results
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runHardwareCheck}
              disabled={hardwareLoading}
              className="w-full sm:w-auto"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${hardwareLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div className="p-5 lg:p-6">
          {hardwareLoading ? (
            <HardwareStatusSkeleton />
          ) : hardwareReport ? (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
                <div className="text-center p-3 lg:p-4 bg-green-950/30 border border-green-900 rounded-lg">
                  <div className="text-xl lg:text-2xl font-bold text-green-400">
                    {hardwareReport.summary.working}
                  </div>
                  <div className="text-xs text-green-500">Working</div>
                </div>
                <div className="text-center p-3 lg:p-4 bg-yellow-950/30 border border-yellow-900 rounded-lg">
                  <div className="text-xl lg:text-2xl font-bold text-yellow-400">
                    {hardwareReport.summary.warning}
                  </div>
                  <div className="text-xs text-yellow-500">Warning</div>
                </div>
                <div className="text-center p-3 lg:p-4 bg-red-950/30 border border-red-900 rounded-lg">
                  <div className="text-xl lg:text-2xl font-bold text-red-400">
                    {hardwareReport.summary.failed}
                  </div>
                  <div className="text-xs text-red-500">Failed</div>
                </div>
                <div className="text-center p-3 lg:p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="text-xl lg:text-2xl font-bold text-gray-400">
                    {hardwareReport.summary.notDetected}
                  </div>
                  <div className="text-xs text-gray-500">Not Detected</div>
                </div>
                <div className="text-center p-3 lg:p-4 bg-blue-950/30 border border-blue-900 rounded-lg">
                  <div className="text-xl lg:text-2xl font-bold text-blue-400">
                    {hardwareReport.checks.length}
                  </div>
                  <div className="text-xs text-blue-500">Total Checks</div>
                </div>
              </div>

              {/* Checks List */}
              <div className="space-y-2">
                {hardwareReport.checks.map((check: any) => (
                  <div
                    key={check.name}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 lg:p-4 bg-gray-800/30 border border-gray-800 rounded-lg hover:bg-gray-800/50 transition-colors gap-3"
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(check.status)}
                      <div>
                        <div className="font-medium text-white text-sm lg:text-base">
                          {check.name}
                        </div>
                        <div className="text-xs lg:text-sm text-gray-400">
                          {check.message}
                        </div>
                        {check.details && (
                          <div className="text-xs text-gray-500 mt-1">
                            {check.details}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-8 sm:ml-0">
                      {check.value !== undefined && (
                        <span className="text-sm font-medium text-white">
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
            <div className="text-center py-8 text-gray-400">
              Click Refresh to run hardware checks
            </div>
          )}
        </div>
      </div>

      {/* Quick Fixes */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 lg:p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Quick Fixes
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Common troubleshooting actions
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => executeQuickFix("recalibrate_gyro", "Recalibrating Gyro")}
            variant="outline"
            className="min-h-[44px]"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Recalibrate Gyro
          </Button>
          <Button
            onClick={() => executeQuickFix("reset_defaults", "Resetting to Defaults")}
            variant="outline"
            className="min-h-[44px]"
          >
            <Cog className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button
            onClick={() => executeQuickFix("motor_test", "Running Motor Test")}
            variant="outline"
            className="min-h-[44px]"
          >
            <Play className="h-4 w-4 mr-2" />
            Run Motor Test
          </Button>
        </div>
      </div>

      {/* Problem Diagnosis */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 lg:p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Problem Diagnosis
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Select a problem to get diagnostic help
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Select
            value={selectedProblem}
            onValueChange={(v) => setSelectedProblem(v)}
          >
            <SelectTrigger className="flex-1 min-h-[44px]">
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
            className="min-h-[44px]"
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
              <Alert className="bg-green-950/30 border-green-800 text-green-100">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertTitle className="text-green-100">
                  Checks Passed ({diagnosis.quickChecks.passed.length})
                </AlertTitle>
                <AlertDescription className="text-green-200">
                  <ul className="list-disc list-inside text-sm mt-2">
                    {diagnosis.quickChecks.passed.map((check: string, i: number) => (
                      <li key={i}>{check}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>

              {diagnosis.quickChecks.failed.length > 0 && (
                <Alert className="bg-red-950/30 border-red-800 text-red-100">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <AlertTitle className="text-red-100">
                    Checks Failed ({diagnosis.quickChecks.failed.length})
                  </AlertTitle>
                  <AlertDescription className="text-red-200">
                    <ul className="list-disc list-inside text-sm mt-2">
                      {diagnosis.quickChecks.failed.map((check: string, i: number) => (
                        <li key={i}>{check}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Probable Causes */}
            <div>
              <h3 className="font-semibold text-white mb-4">
                Probable Causes (Ranked by Likelihood)
              </h3>
              <div className="space-y-4">
                {diagnosis.causes.map((cause: any, index: number) => (
                  <div
                    key={cause.id}
                    className="bg-gray-800/50 border-l-4 border-l-blue-500 rounded-lg p-4 lg:p-5"
                  >
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            cause.likelihood === "high"
                              ? "destructive"
                              : cause.likelihood === "medium"
                              ? "default"
                              : "secondary"
                          }
                        >
                          #{index + 1} {cause.likelihood.toUpperCase()}
                        </Badge>
                        <h4 className="font-semibold text-lg text-white">{cause.title}</h4>
                      </div>
                    </div>

                    <p className="text-gray-400 mb-4 text-sm lg:text-base">
                      {cause.description}
                    </p>

                    <div className="space-y-3">
                      <div>
                        <span className="font-medium text-sm text-white">
                          Why this happens:
                        </span>
                        <p className="text-sm text-gray-400 mt-1">{cause.why}</p>
                      </div>

                      <div>
                        <span className="font-medium text-sm text-white">How to fix:</span>
                        <ol className="list-decimal list-inside text-sm text-gray-400 mt-1">
                          {cause.fix.map((step: string, i: number) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      {cause.wikiLink && (
                        <a
                          href={cause.wikiLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 hover:underline"
                        >
                          View Betaflight Wiki →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fix Dialog */}
      <Dialog open={fixDialog.open} onOpenChange={(open) => setFixDialog({ ...fixDialog, open })}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{fixDialog.title}</DialogTitle>
            <DialogDescription className="text-gray-400">
              {fixDialog.message}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
