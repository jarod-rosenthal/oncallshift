import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';

const sections = [
  { id: 'scheduling', label: 'Scheduling', icon: '📅' },
  { id: 'incident-management', label: 'Incidents', icon: '🚨' },
  { id: 'escalation-policies', label: 'Escalation', icon: '📶' },
  { id: 'ai-diagnosis', label: 'AI Diagnosis', icon: '🤖' },
  { id: 'integrations', label: 'Integrations', icon: '🔌' },
  { id: 'mobile-app', label: 'Mobile App', icon: '📱' },
] as const;

export function Product() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState<string>('scheduling');

  // Scroll to hash on mount or hash change
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      // Small delay to allow DOM to render
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  // Track active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-teal-500/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 text-teal-400 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span>Product</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight leading-[1.1]">
            Everything You Need{' '}
            <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              for On-Call
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Scheduling, incident management, AI diagnosis, and more — all in one platform
            built by engineers who've carried the pager.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-lg px-8 h-12 shadow-lg shadow-teal-500/25">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                Watch Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Sticky section nav */}
      <div className="sticky top-[73px] z-40 border-y border-white/5 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto py-3 scrollbar-hide">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === s.id
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── On-Call Scheduling ── */}
      <section id="scheduling" className="py-24 border-b border-white/5 scroll-mt-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            icon="📅"
            title="On-Call Scheduling"
            subtitle="Build rotating schedules, manage overrides, and ensure 24/7 coverage without spreadsheets."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            <FeatureItem icon="🔄" title="Weekly Rotations" desc="Customizable handoff times for predictable schedules." />
            <FeatureItem icon="📝" title="Schedule Overrides" desc="Swap shifts for vacations or sick days with auto-notification." />
            <FeatureItem icon="⚠️" title="Coverage Gap Alerts" desc="Detect and alert when no one is scheduled." />
            <FeatureItem icon="🌍" title="Timezone Support" desc="Manage global teams with local time display." />
            <FeatureItem icon="📅" title="Calendar Export" desc="Sync to Google Calendar, Outlook, or any iCal app." />
            <FeatureItem icon="📱" title="Mobile Access" desc="View and manage schedules from the iOS/Android apps." />
          </div>

          {/* Steps visual */}
          <div className="mt-14 grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { n: '1', title: 'Add team members', desc: 'Invite via email or import from existing tools.' },
              { n: '2', title: 'Create a schedule', desc: 'Pick rotation type, set handoff times.' },
              { n: '3', title: 'Link to services', desc: 'Alerts route to whoever is on call.' },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-10 h-10 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-teal-400 font-bold text-sm">{s.n}</span>
                </div>
                <h4 className="font-semibold text-sm text-white mb-1">{s.title}</h4>
                <p className="text-xs text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Incident Management ── */}
      <section id="incident-management" className="py-24 border-b border-white/5 scroll-mt-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            icon="🚨"
            title="Incident Management"
            subtitle="AI-enhanced incident response. From alert to resolution without opening your laptop."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            <FeatureItem icon="🤖" title="AI Auto-Diagnosis" desc="Every incident analyzed automatically with root cause and suggested fixes." />
            <FeatureItem icon="⚡" title="One-Tap Remediation" desc="Execute runbooks from your phone. No laptop required." />
            <FeatureItem icon="🔔" title="Smart Escalations" desc="Multi-channel notifications that repeat until acknowledged." />
            <FeatureItem icon="📱" title="Mobile-First" desc="Native iOS & Android apps designed for one-handed use at 3am." />
            <FeatureItem icon="📜" title="Timeline & Audit" desc="Complete incident history — who did what, when." />
            <FeatureItem icon="👥" title="Collaboration" desc="Add responders, chat in real-time, share context." />
          </div>

          {/* Lifecycle visual */}
          <div className="mt-14">
            <h3 className="text-lg font-semibold text-white text-center mb-8">The Incident Lifecycle</h3>
            <div className="flex flex-col md:flex-row justify-center items-center gap-3 max-w-4xl mx-auto">
              {[
                { label: 'Alert Triggered', color: 'bg-red-500/10 text-red-400' },
                { label: 'Notification Sent', color: 'bg-amber-500/10 text-amber-400' },
                { label: 'Acknowledged', color: 'bg-teal-500/10 text-teal-400' },
                { label: 'Investigated', color: 'bg-blue-500/10 text-blue-400' },
                { label: 'Resolved', color: 'bg-green-500/10 text-green-400' },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${step.color}`}>
                    {step.label}
                  </span>
                  {i < arr.length - 1 && <span className="hidden md:block text-slate-600">→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Escalation Policies ── */}
      <section id="escalation-policies" className="py-24 border-b border-white/5 scroll-mt-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            icon="📶"
            title="Escalation Policies"
            subtitle="Multi-step escalation chains that automatically notify backup responders when alerts aren't acknowledged."
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            <FeatureItem icon="📶" title="Multi-Step Escalation" desc="Define who gets notified first, second, third with configurable timeouts." />
            <FeatureItem icon="📅" title="Schedule Integration" desc="Link steps to on-call schedules for dynamic routing." />
            <FeatureItem icon="👥" title="User & Team Targets" desc="Escalate to users, teams, or on-call schedules at each step." />
            <FeatureItem icon="🔁" title="Repeat Until Resolved" desc="Repeat the chain until someone responds." />
            <FeatureItem icon="⬆️" title="Manual Escalation" desc="Responders can manually escalate for backup." />
            <FeatureItem icon="🆘" title="Fallback Contacts" desc="Define final-resort contacts when all steps exhaust." />
          </div>

          {/* Example policy */}
          <div className="mt-14 max-w-xl mx-auto">
            <h3 className="text-sm font-semibold text-slate-400 text-center mb-4 uppercase tracking-wide">Example Policy</h3>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3">
              {[
                { step: 1, target: 'Primary on-call', delay: '0 min' },
                { step: 2, target: 'Secondary on-call', delay: '+5 min' },
                { step: 3, target: 'Backend Engineers team', delay: '+10 min' },
                { step: 4, target: 'Engineering Manager', delay: '+15 min' },
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg">
                  <div className="w-8 h-8 bg-teal-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-400 font-bold text-xs">{s.step}</span>
                  </div>
                  <span className="text-sm text-white flex-1">{s.target}</span>
                  <span className="bg-teal-500/10 text-teal-400 text-xs px-2.5 py-1 rounded-full">{s.delay}</span>
                </div>
              ))}
              <p className="text-xs text-slate-500 text-center pt-2 border-t border-white/5">
                If still unacknowledged, repeat from step 1
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI Diagnosis ── */}
      <section id="ai-diagnosis" className="py-24 border-b border-white/5 scroll-mt-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            icon="🤖"
            title="AI Diagnosis & Remediation"
            subtitle="While other tools suggest fixes, OnCallShift's AI actually executes them."
            badge="Powered by Anthropic Claude"
          />
          <div className="grid md:grid-cols-2 gap-5 mt-12 max-w-4xl mx-auto">
            <FeatureItem icon="🔍" title="Auto-Diagnosis" desc="Every incident analyzed automatically — logs, metrics, and past incidents." />
            <FeatureItem icon="☁️" title="Cloud Investigation" desc="AI queries CloudWatch, ECS, deployments using your credentials." />
            <FeatureItem icon="⚡" title="Execute Remediation" desc="One tap to restart services, scale deployments, rollback releases." />
            <FeatureItem icon="🧠" title="Learning Loop" desc="AI tracks what worked and gets smarter with every resolution." />
          </div>

          {/* BYOK banner */}
          <div className="mt-14 max-w-3xl mx-auto">
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-6 text-center">
              <p className="text-purple-300 text-sm">
                <span className="font-semibold">Bring Your Own Key (BYOK):</span>{' '}
                Use your Anthropic API key. Your incident data goes directly to Anthropic and is never stored by OnCallShift for AI purposes.
              </p>
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400">
                <span>🔐 Encrypted at rest</span>
                <span>🚀 Direct to Claude</span>
                <span>💰 You control costs</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section id="integrations" className="py-24 border-b border-white/5 scroll-mt-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            icon="🔌"
            title="Integrations"
            subtitle="Connect your existing monitoring tools in minutes. PagerDuty and Opsgenie compatible webhooks."
          />

          {/* Tool grid */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-12 max-w-3xl mx-auto">
            {[
              { name: 'Datadog', icon: '📊' },
              { name: 'Prometheus', icon: '🔥' },
              { name: 'Grafana', icon: '📈' },
              { name: 'Slack', icon: '💬' },
              { name: 'AWS', icon: '☁️' },
              { name: 'GitHub', icon: '🐙' },
              { name: 'Sentry', icon: '🐛' },
              { name: 'Jira', icon: '📋' },
              { name: 'Azure', icon: '☁️' },
              { name: 'GCP', icon: '☁️' },
              { name: 'PagerDuty', icon: '📟' },
              { name: 'Opsgenie', icon: '🔔' },
            ].map((tool) => (
              <div key={tool.name} className="flex flex-col items-center text-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                <div className="text-xl mb-1">{tool.icon}</div>
                <div className="text-xs font-medium text-slate-300">{tool.name}</div>
              </div>
            ))}
          </div>

          {/* Migration ease */}
          <div className="mt-14 max-w-xl mx-auto">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
              <p className="text-sm text-white font-medium text-center mb-3">Migration is just a URL change</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-red-400 text-xs w-12">Before:</span>
                  <code className="bg-red-500/10 px-3 py-1 rounded text-xs text-red-400 flex-1 overflow-x-auto">
                    events.pagerduty.com/v2/enqueue
                  </code>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-400 text-xs w-12">After:</span>
                  <code className="bg-green-500/10 px-3 py-1 rounded text-xs text-green-400 flex-1 overflow-x-auto">
                    api.oncallshift.com/webhooks/pagerduty
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mobile App ── */}
      <section id="mobile-app" className="py-24 border-b border-white/5 scroll-mt-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            icon="📱"
            title="Mobile App"
            subtitle="Native iOS & Android apps. Get alerts, respond to incidents, and manage schedules from your pocket."
            badge="iOS & Android"
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            <FeatureItem icon="🔔" title="Push Notifications" desc="Critical alerts that break through Do Not Disturb mode." />
            <FeatureItem icon="👆" title="One-Tap Actions" desc="Acknowledge, resolve, or escalate without opening the full app." />
            <FeatureItem icon="🤖" title="AI Diagnosis" desc="Chat with Claude and get AI analysis from your phone." />
            <FeatureItem icon="📅" title="Schedule View" desc="See who is on call now and manage overrides." />
            <FeatureItem icon="📋" title="Runbook Execution" desc="Execute runbook steps with one tap — SSH, API calls, more." />
            <FeatureItem icon="📶" title="Offline Support" desc="View cached incidents and schedules without connectivity." />
          </div>

          {/* Platform badges */}
          <div className="flex items-center justify-center gap-6 mt-12">
            <div className="bg-white/[0.03] border border-white/5 px-5 py-3 rounded-xl text-center">
              <span className="text-2xl block mb-1"></span>
              <p className="text-sm font-medium text-white">iOS</p>
              <p className="text-xs text-slate-500">iPhone & iPad</p>
            </div>
            <div className="bg-white/[0.03] border border-white/5 px-5 py-3 rounded-xl text-center">
              <span className="text-2xl block mb-1">🤖</span>
              <p className="text-sm font-medium text-white">Android</p>
              <p className="text-xs text-slate-500">Phones & Tablets</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[200px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Fix On-Call?
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Start your free trial today. No credit card required. Set up in under 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-lg px-8 h-12 shadow-lg shadow-teal-500/25">
                Start Free Trial
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8 h-12 border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Helpers ── */

function SectionHeader({ icon, title, subtitle, badge }: { icon: string; title: string; subtitle: string; badge?: string }) {
  return (
    <div className="text-center">
      {badge && (
        <div className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-400 px-4 py-1.5 rounded-full text-xs font-medium mb-4">
          {badge}
        </div>
      )}
      <div className="text-4xl mb-4">{icon}</div>
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
      <p className="text-lg text-slate-400 max-w-2xl mx-auto">{subtitle}</p>
    </div>
  );
}

function FeatureItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl p-5 bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
      <span className="text-2xl mb-2 block">{icon}</span>
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}
