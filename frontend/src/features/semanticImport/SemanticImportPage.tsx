/**
 * Semantic Import Page
 * Main page component with tab navigation for import methods
 */
import { useState } from 'react';
import { Upload, MessageSquare, History, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/PageHeader';
import { Section } from '@/components/layout/Section';
import { ScreenshotImportPanel } from './components/ScreenshotImportPanel';
import { NaturalLanguageImportPanel } from './components/NaturalLanguageImportPanel';
import { ImportPreviewPanel } from './components/ImportPreviewPanel';
import { ImportHistoryTable } from './components/ImportHistoryTable';
import { ImportHistoryDetail } from './components/ImportHistoryDetail';
import type { ImportExtraction, ImportExecutionResult, ImportWizardState } from './types';

type TabType = 'screenshot' | 'natural-language' | 'history';

export function SemanticImportPage() {
  const [activeTab, setActiveTab] = useState<TabType>('screenshot');
  const [wizardState, setWizardState] = useState<ImportWizardState>({
    step: 'input',
    inputType: 'screenshot',
    isLoading: false,
  });
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);

  const handleAnalysisComplete = (extraction: ImportExtraction) => {
    setWizardState({
      ...wizardState,
      step: 'preview',
      extraction,
      isLoading: false,
    });
  };

  const handleImportComplete = (result: ImportExecutionResult, importId?: string) => {
    setWizardState({
      ...wizardState,
      step: 'complete',
      result,
      importId,
      isLoading: false,
    });
  };

  const handleBack = () => {
    if (wizardState.step === 'preview') {
      setWizardState({
        ...wizardState,
        step: 'input',
        extraction: undefined,
      });
    } else if (wizardState.step === 'complete') {
      // Reset to input
      setWizardState({
        step: 'input',
        inputType: activeTab === 'screenshot' ? 'screenshot' : 'natural_language',
        isLoading: false,
      });
    }
  };

  const handleStartNew = () => {
    setWizardState({
      step: 'input',
      inputType: activeTab === 'screenshot' ? 'screenshot' : 'natural_language',
      isLoading: false,
    });
  };

  const handleSelectImport = (importId: string) => {
    setSelectedImportId(importId);
  };

  const handleBackFromDetail = () => {
    setSelectedImportId(null);
  };

  const tabs = [
    { id: 'screenshot' as const, label: 'Screenshot Import', icon: Upload },
    { id: 'natural-language' as const, label: 'Natural Language', icon: MessageSquare },
    { id: 'history' as const, label: 'Import History', icon: History },
  ];

  // Show history detail view if selected
  if (selectedImportId && activeTab === 'history') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Import Details"
          subtitle="View details of a previous import"
        />
        <Section>
          <ImportHistoryDetail
            importId={selectedImportId}
            onBack={handleBackFromDetail}
          />
        </Section>
      </div>
    );
  }

  // Show completion screen
  if (wizardState.step === 'complete' && wizardState.result) {
    const { result } = wizardState;
    const totalCreated = result.created.length;
    const totalFailed = result.failed.length;

    return (
      <div className="space-y-6">
        <PageHeader
          title="Semantic Import"
          subtitle="Import your existing configuration using screenshots or natural language"
        />
        <Section>
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {result.success ? (
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-2xl">!</span>
                  </div>
                )}
              </div>
              <CardTitle className={result.success ? 'text-green-700' : 'text-red-700'}>
                {result.success ? 'Import Completed Successfully' : 'Import Completed with Errors'}
              </CardTitle>
              <CardDescription>
                {result.success
                  ? `Successfully created ${totalCreated} items`
                  : `Created ${totalCreated} items, ${totalFailed} failed`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{result.created.length}</div>
                  <div className="text-sm text-green-600">Created</div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">{result.skipped.length}</div>
                  <div className="text-sm text-yellow-600">Skipped</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">{result.failed.length}</div>
                  <div className="text-sm text-red-600">Failed</div>
                </div>
              </div>

              {/* Created Items */}
              {result.created.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Created Items</h4>
                  <div className="space-y-1">
                    {result.created.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-green-50 rounded">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium capitalize">{item.type}:</span>
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Items */}
              {result.failed.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-gray-700 mb-2">Failed Items</h4>
                  <div className="space-y-1">
                    {result.failed.map((item, idx) => (
                      <div key={idx} className="text-sm p-2 bg-red-50 rounded">
                        <div className="font-medium capitalize">{item.type}: {item.name}</div>
                        <div className="text-red-600 text-xs">{item.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rollback Notice */}
              {result.rollbackPerformed && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-orange-700 text-sm">
                    <strong>Rollback performed:</strong> Due to errors, all changes have been rolled back.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-center pt-4">
                <Button variant="outline" onClick={handleStartNew}>
                  Start New Import
                </Button>
                <Button onClick={() => setActiveTab('history')}>
                  View Import History
                </Button>
              </div>
            </CardContent>
          </Card>
        </Section>
      </div>
    );
  }

  // Show preview screen
  if (wizardState.step === 'preview' && wizardState.extraction) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Semantic Import"
          subtitle="Review and confirm your import"
        />
        <Section>
          <ImportPreviewPanel
            extraction={wizardState.extraction}
            onImportComplete={handleImportComplete}
            onBack={handleBack}
          />
        </Section>
      </div>
    );
  }

  // Main input screen with tabs
  return (
    <div className="space-y-6">
      <PageHeader
        title="Semantic Import"
        subtitle="Import your existing configuration using screenshots or natural language"
      />

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setWizardState({
                    step: 'input',
                    inputType: tab.id === 'screenshot' ? 'screenshot' : 'natural_language',
                    isLoading: false,
                  });
                }}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <Section>
        {activeTab === 'screenshot' && (
          <ScreenshotImportPanel
            onAnalysisComplete={handleAnalysisComplete}
            isLoading={wizardState.isLoading}
          />
        )}

        {activeTab === 'natural-language' && (
          <NaturalLanguageImportPanel
            onAnalysisComplete={handleAnalysisComplete}
            isLoading={wizardState.isLoading}
          />
        )}

        {activeTab === 'history' && (
          <ImportHistoryTable onSelectImport={handleSelectImport} />
        )}
      </Section>
    </div>
  );
}

export default SemanticImportPage;
