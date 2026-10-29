"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Zap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/project-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/explorer", label: "Log Explorer" },
  { href: "/issues", label: "Issues" },
  { href: "/analytics", label: "Analytics" },
  { href: "/live", label: "Live Stream" },
  { href: "/severity-rules", label: "Severity Rules"},
  { href: "/settings", label: "Settings" },
  { href: "/users", label: "Users" },
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
    router.push('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 border-r border-border bg-sidebar p-6 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="bg-primary p-2 rounded-lg">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold text-foreground">LogSpectra</span>
      </div>

      {/* Project Switcher */}
      <div className="mb-8">
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Current Project</p>
        <ProjectSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={withAppState(item.href)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-secondary"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-xs"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          <p>v1.0.0</p>
        </div>
      </div>
    </aside>
  );
}
