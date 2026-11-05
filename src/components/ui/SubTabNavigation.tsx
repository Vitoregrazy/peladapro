import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface SubTabItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  highlight?: boolean;
}

interface SubTabNavigationProps<T extends string> {
  tabs: SubTabItem<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
}

export function SubTabNavigation<T extends string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: SubTabNavigationProps<T>) {
  return (
    <nav
      aria-label="Sub-navegação"
      className={`sticky top-[53px] z-20 bg-slate-950/95 backdrop-blur-md pt-1.5 pb-2 px-2 sm:px-4 border-b border-slate-800/80 shadow-md ${className}`}
    >
      <div
        className="grid gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800/90 max-w-full overflow-x-auto no-scrollbar"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2 px-1.5 rounded-xl font-bold text-xs transition-all duration-150 select-none active:scale-95 ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {tab.highlight && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                )}
              </div>

              <span className="truncate max-w-full tracking-tight leading-none text-[11px] sm:text-xs">
                {tab.label}
              </span>

              {tab.badge !== undefined && tab.badge !== '' && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full leading-none tabular-nums shrink-0 ${
                    isActive
                      ? 'bg-slate-950/30 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

