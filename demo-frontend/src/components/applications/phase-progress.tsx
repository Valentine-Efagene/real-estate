'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useReopenPhase, type Phase } from '@/lib/hooks/use-applications';

interface PhaseProgressProps {
  applicationId: string;
  phases: Phase[];
  /** Whether the current user is an admin who can reopen phases */
  isAdmin?: boolean;
}

function getPhaseIcon(category: string) {
  switch (category) {
    case 'QUESTIONNAIRE':
      return '📝';
    case 'DOCUMENTATION':
      return '📄';
    case 'PAYMENT':
      return '💳';
    default:
      return '📌';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-500';
    case 'IN_PROGRESS':
      return 'bg-blue-500';
    case 'PENDING':
      return 'bg-gray-300';
    case 'SKIPPED':
      return 'bg-gray-400';
    default:
      return 'bg-gray-300';
  }
}

function getActorBadge(nextActor?: string) {
  switch (nextActor) {
    case 'CUSTOMER':
      return { label: 'Awaiting Customer', variant: 'secondary' as const, icon: '👤' };
    case 'ADMIN':
      return { label: 'Awaiting Admin', variant: 'outline' as const, icon: '🏢' };
    case 'SYSTEM':
      return { label: 'Processing', variant: 'outline' as const, icon: '⚙️' };
    default:
      return null;
  }
}

export function PhaseProgress({ applicationId, phases, isAdmin = false }: PhaseProgressProps) {
  const [reopenPhaseId, setReopenPhaseId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [resetDependentPhases, setResetDependentPhases] = useState(true);
  const reopenPhase = useReopenPhase();

  if (!phases || phases.length === 0) {
    return null;
  }

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
  const completedCount = phases.filter((p) => p.status === 'COMPLETED').length;
  const progress = (completedCount / phases.length) * 100;

  const reopeningPhase = sortedPhases.find((p) => p.id === reopenPhaseId);
  // Count how many subsequent phases would be reset
  const dependentPhaseCount = reopeningPhase
    ? sortedPhases.filter((p) => p.order > reopeningPhase.order && p.status !== 'PENDING').length
    : 0;

  const handleReopenPhase = async () => {
    if (!reopenPhaseId) return;
    try {
      await reopenPhase.mutateAsync({
        applicationId,
        phaseId: reopenPhaseId,
        reason: reopenReason || undefined,
        resetDependentPhases,
      });
      toast.success(`Phase "${reopeningPhase?.name}" reopened successfully`);
      setReopenPhaseId(null);
      setReopenReason('');
      setResetDependentPhases(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reopen phase');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Application Progress</CardTitle>
            <Badge variant="outline">
              {completedCount}/{phases.length} phases complete
            </Badge>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mt-4">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedPhases.map((phase, index) => (
              <div key={phase.id} className="flex items-start gap-4">
                {/* Timeline connector */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${getStatusColor(
                      phase.status
                    )}`}
                  >
                    {phase.status === 'COMPLETED' ? (
                      '✓'
                    ) : (
                      <span>{getPhaseIcon(phase.phaseCategory)}</span>
                    )}
                  </div>
                  {index < sortedPhases.length - 1 && (
                    <div
                      className={`w-0.5 h-12 ${phase.status === 'COMPLETED' ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                    />
                  )}
                </div>

                {/* Phase info */}
                <div className="flex-1 pb-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">{phase.name}</h4>
                    <Badge
                      variant={
                        phase.status === 'COMPLETED'
                          ? 'default'
                          : phase.status === 'IN_PROGRESS'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {phase.status}
                    </Badge>
                    {/* Show who needs to act for in-progress phases */}
                    {phase.status === 'IN_PROGRESS' && phase.actionStatus?.nextActor && getActorBadge(phase.actionStatus.nextActor) && (
                      <Badge variant={getActorBadge(phase.actionStatus.nextActor)!.variant}>
                        {getActorBadge(phase.actionStatus.nextActor)!.icon} {getActorBadge(phase.actionStatus.nextActor)!.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {phase.phaseCategory} • {phase.phaseType}
                  </p>
                  {/* Show action required message */}
                  {phase.status === 'IN_PROGRESS' && phase.actionStatus?.actionRequired && (
                    <p className="text-sm text-blue-600 mt-1">
                      {phase.actionStatus.actionRequired}
                    </p>
                  )}
                  {phase.completedAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      Completed: {new Date(phase.completedAt).toLocaleDateString()}
                    </p>
                  )}
                  {/* Reopen button for admins on COMPLETED phases */}
                  {isAdmin && phase.status === 'COMPLETED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 h-7"
                      onClick={() => setReopenPhaseId(phase.id)}
                    >
                      ↩ Reopen Phase
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reopen Phase Confirmation Dialog */}
      <Dialog
        open={!!reopenPhaseId}
        onOpenChange={(open) => {
          if (!open) {
            setReopenPhaseId(null);
            setReopenReason('');
            setResetDependentPhases(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Phase</DialogTitle>
            <DialogDescription>
              Reopen &ldquo;{reopeningPhase?.name}&rdquo; to allow corrections.
              This will reset it to IN_PROGRESS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {dependentPhaseCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  ⚠️ <strong>{dependentPhaseCount}</strong> subsequent phase{dependentPhaseCount > 1 ? 's' : ''} will be
                  reset to PENDING if you keep &ldquo;Reset dependent phases&rdquo; enabled.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reopen-reason">Reason for reopening</Label>
              <Textarea
                id="reopen-reason"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g., Documents need re-verification, incorrect information submitted..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="reset-dependent">Reset dependent phases</Label>
                <p className="text-xs text-gray-500">Reset all subsequent phases back to PENDING</p>
              </div>
              <Switch
                id="reset-dependent"
                checked={resetDependentPhases}
                onCheckedChange={setResetDependentPhases}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReopenPhaseId(null);
                setReopenReason('');
                setResetDependentPhases(true);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-orange-600 hover:bg-orange-700"
              disabled={reopenPhase.isPending}
              onClick={handleReopenPhase}
            >
              {reopenPhase.isPending ? 'Reopening...' : 'Reopen Phase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
