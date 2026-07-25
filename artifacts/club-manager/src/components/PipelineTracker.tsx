import { Check, Clock, Calendar, CheckSquare, Settings } from "lucide-react";

interface PipelineTrackerProps {
  currentStep: number;
  /** Manual/walk-in leads skip steps 1 & 2; pass true to grey them out */
  isManual?: boolean;
}

export function PipelineTracker({ currentStep, isManual }: PipelineTrackerProps) {
  const steps = [
    { num: 1, label: "Contact Initial", icon: Clock },
    { num: 2, label: "Rendez-vous", icon: Calendar },
    { num: 3, label: "Porte Légale", icon: CheckSquare },
    { num: 4, label: "Activation", icon: Settings },
    { num: 5, label: "Finalisation", icon: Check },
  ];

  return (
    <div className="relative">
      {/* Background track */}
      <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 -z-10" />
      {/* Progress fill */}
      <div
        className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-500 -z-10"
        style={{ width: `${(Math.max(0, currentStep - 1) / 4) * 100}%` }}
      />

      <div className="flex justify-between">
        {steps.map((step) => {
          // For manual leads, only step 1 (WhatsApp) is always skipped.
          // Step 2 (Rendez-vous) can be reached via the "retour" action.
          const skipped = isManual && step.num === 1;
          const isCompleted = !skipped && currentStep > step.num;
          const isCurrent = !skipped && currentStep === step.num;
          const Icon = step.icon;

          return (
            <div key={step.num} className="flex flex-col items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors
                  ${skipped
                    ? "bg-gray-50 border-gray-200 text-gray-300"
                    : isCompleted
                    ? "bg-primary border-primary text-white"
                    : isCurrent
                    ? "bg-white border-primary text-primary"
                    : "bg-white border-gray-200 text-gray-400"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={`text-xs font-medium max-w-[72px] text-center leading-tight
                  ${skipped
                    ? "text-gray-300"
                    : isCurrent
                    ? "text-primary"
                    : isCompleted
                    ? "text-gray-900"
                    : "text-gray-400"
                  }
                `}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
