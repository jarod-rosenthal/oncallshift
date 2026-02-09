import { Menu, Bell, User } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        className="lg:hidden rounded p-1.5 text-gray-500 hover:text-gray-700"
        onClick={onMenuClick}
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Header actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative rounded-full p-1.5 text-gray-500 hover:text-gray-700"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-1.5 text-gray-500 hover:text-gray-700"
          aria-label="User menu"
        >
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
