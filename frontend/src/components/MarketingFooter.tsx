import { Link } from 'react-router-dom';

function WorkerMillIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 pt-16 pb-10 bg-slate-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-2xl">📟</span>
              <span className="font-bold text-lg text-white">OnCallShift</span>
            </div>
            <p className="text-sm text-slate-500 mb-5 max-w-xs leading-relaxed">
              On-call scheduling and incident management for teams who ship fast.
            </p>

            <a
              href="https://workermill.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-teal-500/30 transition-colors group mb-6"
            >
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
                <WorkerMillIcon className="w-4 h-4 text-white" />
              </span>
              <span className="flex flex-col">
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors leading-tight">Built by</span>
                <span className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors leading-tight">WorkerMill</span>
              </span>
            </a>

            <div className="flex gap-4">
              <a href="#" className="text-slate-600 hover:text-white transition-colors text-sm">𝕏</a>
              <a href="#" className="text-slate-600 hover:text-white transition-colors text-sm">GitHub</a>
              <a href="#" className="text-slate-600 hover:text-white transition-colors text-sm">LinkedIn</a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Product</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/product#scheduling" className="text-slate-500 hover:text-white transition-colors">On-Call Scheduling</Link></li>
              <li><Link to="/product#incident-management" className="text-slate-500 hover:text-white transition-colors">Incident Management</Link></li>
              <li><Link to="/product#escalation-policies" className="text-slate-500 hover:text-white transition-colors">Escalation Policies</Link></li>
              <li><Link to="/product#ai-diagnosis" className="text-slate-500 hover:text-white transition-colors">AI Diagnosis</Link></li>
              <li><Link to="/product#integrations" className="text-slate-500 hover:text-white transition-colors">Integrations</Link></li>
              <li><Link to="/pricing" className="text-slate-500 hover:text-white transition-colors">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Resources</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/docs" className="text-slate-500 hover:text-white transition-colors">Documentation</Link></li>
              <li><Link to="/help" className="text-slate-500 hover:text-white transition-colors">Help Center</Link></li>
              <li><a href="/api-docs" className="text-slate-500 hover:text-white transition-colors">API Reference</a></li>
              <li><Link to="/blog" className="text-slate-500 hover:text-white transition-colors">Blog</Link></li>
              <li><Link to="/demo" className="text-slate-500 hover:text-white transition-colors">Live Demo</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/company/about" className="text-slate-500 hover:text-white transition-colors">About</Link></li>
              <li><Link to="/company/security" className="text-slate-500 hover:text-white transition-colors">Security</Link></li>
              <li><Link to="/legal/privacy" className="text-slate-500 hover:text-white transition-colors">Privacy</Link></li>
              <li><Link to="/legal/terms" className="text-slate-500 hover:text-white transition-colors">Terms</Link></li>
              <li><Link to="/company/contact" className="text-slate-500 hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-12 pt-8">
          <div className="text-center mb-4">
            <p className="text-slate-600 text-sm">
              Built by DevOps engineers who get paged. Questions?{' '}
              <a href="mailto:jarod@oncallshift.com" className="text-teal-500 hover:text-teal-400 transition-colors">
                Email the founder
              </a>
            </p>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-600">
              &copy; 2026 OnCallShift &middot;{' '}
              <a href="https://workermill.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-teal-400 transition-colors">
                A WorkerMill product
              </a>
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <span>SOC 2 Type II</span>
              <span>99.9% Uptime SLA</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
