import React from 'react';
import { Menu } from 'lucide-react';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedFileName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  selectedFileName,
}) => {
  return (
    <header className="h-16 bg-[#141414] border-b border-[#262626] flex items-center justify-between px-6 shrink-0 select-none text-white">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          id="toggle-sidebar-btn"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#262626] transition-colors focus:outline-none"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#10b981] rounded text-white flex items-center justify-center font-bold text-sm shadow-xs">
            E
          </div>
          <h2 className="text-sm font-medium text-gray-400">
            EdgeView /{' '}
            <span className="text-white font-semibold">
              {selectedFileName || 'No file selected'}
            </span>
          </h2>
        </div>
      </div>
      <div aria-hidden="true" />
    </header>
  );
};

