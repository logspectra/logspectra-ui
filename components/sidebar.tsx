"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Zap,
  LogOut,
  LayoutDashboard,
  Search,
  AlertCircle,
  BarChart3,
  Radio,
  Shield,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/project-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import { Button } from "@/components/ui/button";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/explorer", label: "Log Explorer", icon: Search },
  { href: "/issues", label: "Issues", icon: AlertCircle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/live", label: "Live Stream", icon: Radio },
  { href: "/severity-rules", label: "Severity Rules", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/users", label: "Users", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const withAppState = (path: string) => (query ? `${path}?${query}` : path);
  const { logout } = useProject();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-60 flex-col border-r border-border/80 bg-sidebar shadow-sm">
      <div className="border-b border-border/60 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary p-2 shadow-sm">
            <Zap className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">LogSpectra</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Project
        </p>
        <div className="mb-6 px-1">
          <ProjectSwitcher />
        </div>

        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Navigate
        </p>
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={withAppState(item.href)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={isActive ? 2.25 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-border/60 p-4">
        <Button variant="outline" size="sm" onClick={handleLogout} className="w-full justify-start text-xs">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">v1.0.0</p>
      </div>
    </aside>
  );
}
