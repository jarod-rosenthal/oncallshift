/**
 * Natural Language Import Panel
 * Allows users to describe their configuration in plain English
 */
import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Wand2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Clock,
  Users,
  Calendar,
  ArrowUpRight,
  Layers,
  Server,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { semanticImportAPI, RateLimitError } from '../api/semanticImportApi';
import type { ImportExtraction, ImportTemplate } from '../types';

interface NaturalLanguageImportPanelProps {
  onAnalysisComplete: (extraction: ImportExtraction) => void;
  isLoading?: boolean;
}

// Template categories for organizing templates
interface TemplateCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'team', name: 'Teams', icon: Users, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'schedule', name: 'Schedules', icon: Calendar, color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'escalation', name: 'Escalation Policies', icon: ArrowUpRight, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { id: 'service', name: 'Services', icon: Server, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'complex', name: 'Complex Setups', icon: Layers, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

// Default templates shown when API templates are not yet loaded
const DEFAULT_TEMPLATES: ImportTemplate[] = [
  {
    name: 'Team with Members',
    description: 'Create a team with multiple members and roles',
    example: 'Create a team called Engineering with 5 members rotating weekly. Include Alice as tech lead, Bob, Carol, David, and Eve as engineers.',
    category: 'team',
  },
  {
    name: '24/7 Schedule',
    description: 'Set up around-the-clock coverage',
    example: 'Create a 24/7 on-call schedule with daily rotation for the Engineering team. Handoff at 9am Pacific time.',
    category: 'schedule',
  },
  {
    name: 'Weekly Rotation',
    description: 'Standard weekly on-call rotation',
    example: 'Set up a weekly on-call schedule for the Platform team with 4 engineers: John, Sarah, Mike, and Lisa. Rotate every Monday at 10am.',
    category: 'schedule',
  },
  {
    name: '3-Step Escalation',
    description: 'Escalate through on-call, lead, then manager',
    example: 'Set up an escalation policy with 3 steps: first notify the on-call from Primary Schedule, after 5 minutes escalate to the team lead, after 10 more minutes escalate to the engineering manager.',
    category: 'escalation',
  },
  {
    name: 'Multi-tier Escalation',
    description: 'Multiple notification groups per step',
    example: 'Create an escalation policy for critical alerts: Step 1 pages on-call and backup on-call simultaneously, Step 2 after 10 minutes pages the team lead and SRE manager, Step 3 after 15 minutes pages the VP of Engineering.',
    category: 'escalation',
  },
  {
    name: 'Service with Dependencies',
    description: 'Create a service linked to team and policy',
    example: 'Create a service called "Payment Gateway" owned by the Payments team, using the Critical-Escalation policy. Set priority to high.',
    category: 'service',
  },
  {
    name: 'Complete Setup',
    description: 'Full team, schedule, policy, and service',
    example: 'Set up a complete on-call system: Create the Backend team with Alice, Bob, and Carol. Create a weekly rotation schedule with handoff on Mondays at 9am. Create a 2-step escalation policy that pages on-call first, then the whole team after 10 minutes. Create an API Gateway service using this escalation policy.',
    category: 'complex',
  },
];

const MAX_CHARS = 2000;
const MIN_CHARS = 20;

export function NaturalLanguageImportPanel({
  onAnalysisComplete,
  isLoading: externalLoading = false,
}: NaturalLanguageImportPanelProps) {
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ remaining?: number; resetAt?: Date } | null>(null);
  const [templates, setTemplates] = useState<ImportTemplate[]>(DEFAULT_TEMPLATES);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('team');

  // Fetch templates from API on mount
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const response = await semanticImportAPI.getTemplates();
        if (response.templates && response.templates.length > 0) {
          setTemplates(response.templates);
        }
      } catch (err) {
        // Silently fall back to default templates
        console.warn('Failed to fetch templates, using defaults:', err);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []);

  const charCount = description.length;
  const charCountColor = charCount > MAX_CHARS ? 'text-red-500' : charCount > MAX_CHARS * 0.9 ? 'text-amber-500' : 'text-gray-400';
  const isValidLength = charCount >= MIN_CHARS && charCount <= MAX_CHARS;

  const handleSubmit = useCallback(async () => {
    if (!isValidLength || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
    setRateLimitInfo(null);

    try {
      const response = await semanticImportAPI.naturalLanguageImport({
        description: description.trim(),
      });

      if (response.success && response.extraction) {
        onAnalysisComplete(response.extraction);
      } else {
        setError(response.error || 'Failed to analyze description. Please try again.');
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setError(err.message);
        setRateLimitInfo({ remaining: err.remaining, resetAt: err.resetAt });
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [description, isValidLength, isAnalyzing, onAnalysisComplete]);

  const handleTemplateClick = (template: ImportTemplate) => {
    setDescription(template.example);
    setError(null);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const getTemplatesByCategory = (categoryId: string) => {
    return templates.filter((t) => t.category === categoryId);
  };

  const isLoading = isAnalyzing || externalLoading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Input Panel */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Describe Your Configuration
            </CardTitle>
            <CardDescription>
              Tell us what you want to create in plain English. We will analyze your description and generate the corresponding configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Text Area */}
            <div className="space-y-2">
              <Label htmlFor="description" className="sr-only">
                Configuration Description
              </Label>
              <div className="relative">
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Example: Create a team called Engineering with Alice, Bob, and Carol. Set up a weekly on-call rotation with handoff on Mondays at 9am. Create an escalation policy that pages the on-call first, then escalates to the team lead after 10 minutes..."
                  className="w-full h-48 px-4 py-3 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                />
                {/* Character count */}
                <div className={`absolute bottom-3 right-3 text-xs ${charCountColor}`}>
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </div>
              </div>
              {charCount > 0 && charCount < MIN_CHARS && (
                <p className="text-xs text-amber-600">
                  Please enter at least {MIN_CHARS} characters to describe your configuration.
                </p>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700">{error}</p>
                  {rateLimitInfo?.resetAt && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Try again after {rateLimitInfo.resetAt.toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Powered by AI - Results may need review
              </p>
              <Button
                onClick={handleSubmit}
                disabled={!isValidLength || isLoading}
                className="min-w-[140px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Tips for Best Results
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>- Be specific about team member names and roles</li>
              <li>- Mention rotation type (daily, weekly) and handoff times</li>
              <li>- Specify escalation delays in minutes</li>
              <li>- Include timezone information for schedules</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Templates Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-500" />
              Quick Templates
            </CardTitle>
            <CardDescription className="text-xs">
              Click a template to populate the description field
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              TEMPLATE_CATEGORIES.map((category) => {
                const categoryTemplates = getTemplatesByCategory(category.id);
                if (categoryTemplates.length === 0) return null;

                const isExpanded = expandedCategory === category.id;
                const Icon = category.icon;

                return (
                  <div key={category.id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors hover:bg-gray-50 ${
                        isExpanded ? 'bg-gray-50' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {category.name}
                        <span className="text-xs text-gray-400">
                          ({categoryTemplates.length})
                        </span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-2 space-y-2">
                        {categoryTemplates.map((template, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleTemplateClick(template)}
                            disabled={isLoading}
                            className="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="font-medium text-sm text-gray-900 mb-1">
                              {template.name}
                            </div>
                            <div className="text-xs text-gray-500 line-clamp-2">
                              {template.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* What Gets Created */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What Can Be Created</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { icon: Users, label: 'Teams', desc: 'With members and roles' },
                { icon: Calendar, label: 'Schedules', desc: 'Daily, weekly, or custom rotations' },
                { icon: ArrowUpRight, label: 'Escalation Policies', desc: 'Multi-step with delays' },
                { icon: Server, label: 'Services', desc: 'Linked to teams and policies' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-gray-100">
                    <item.icon className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default NaturalLanguageImportPanel;
