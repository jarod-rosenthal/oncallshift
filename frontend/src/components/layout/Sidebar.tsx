import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  AlertTriangle,
  Server,
  Calendar,
  Users,
  GitBranch,
  Settings,
  Shield,
  X,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Incidents", href: "/incidents", icon: AlertTriangle },
  { name: "Services", href: "/services", icon: Server },
  { name: "Schedules", href: "/schedules", icon: Calendar },
  { name: "Teams", href: "/teams", icon: Users },
  { name: "Escalation Policies", href: "/escalation-policies", icon: GitBranch },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-900 transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo area */}
        <div className="flex h-16 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-brand-400" />
            <span className="text-lg font-bold text-white">OnCallShift</span>
          </div>
          <button
            type="button"
            className="lg:hidden rounded p-1 text-gray-400 hover:text-white"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white",
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Version footer */}
        <div className="border-t border-gray-800 px-4 py-3">
          <p className="text-xs text-gray-500">OnCallShift v0.1.0</p>
        </div>
      </aside>
    </>
  );
}
