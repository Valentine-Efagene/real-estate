'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Phase } from '@/lib/hooks/use-applications';

interface PhaseProgressProps {
  applicationId: string;
  phases: Phase[];
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

export function PhaseProgress({ phases }: PhaseProgressProps) {
  if (!phases || phases.length === 0) {
    return null;
  }

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
  const completedCount = phases.filter((p) => p.status === 'COMPLETED').length;
  const progress = (completedCount / phases.length) * 100;

  return (
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
                <div className="flex items-center gap-2">
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
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {phase.phaseCategory} • {phase.phaseType}
                </p>
                {phase.completedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Completed: {new Date(phase.completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
