import type { ReactNode } from 'react';

interface Step {
  title: string;
  content: ReactNode;
}

interface StepListProps {
  steps: Step[];
}

export function StepList({ steps }: StepListProps) {
  return (
    <div className="space-y-6 my-6">
      {steps.map((step, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-semibold">
              {index + 1}
            </div>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h4 className="font-semibold text-white mb-2">
              {step.title}
            </h4>
            <div className="text-slate-400 text-sm">
              {step.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  children: ReactNode;
}

export function Step({ number, title, children }: StepProps) {
  return (
    <div className="flex gap-4 my-6">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-semibold">
          {number}
        </div>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="font-semibold text-white mb-2">
          {title}
        </h4>
        <div className="text-slate-400 text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
