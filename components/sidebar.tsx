"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
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
import { Logo } from "@/components/logo";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Observe",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/explorer", label: "Log Explorer", icon: Search },
      { href: "/live", label: "Live Stream", icon: Radio },
      { href: "/issues", label: "Issues", icon: AlertCircle },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/severity-rules", label: "Severity Rules", icon: Shield },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/users", label: "Users", icon: Users },
    ],
  },
];

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
      {children}
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const withAppState = (path: string) => (query ? `${path}?${query}` : path);
  const { logout, user } = useProject();
  const displayName = user?.name || user?.email || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
        <Link href={withAppState("/dashboard")}>
          <Logo />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <GroupLabel>Project</GroupLabel>
        <div className="mb-6 px-1">
          <ProjectSwitcher />
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <GroupLabel>{group.label}</GroupLabel>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={withAppState(item.href)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {isActive ? (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" aria-hidden />
                    ) : null}
                    <Icon
                      className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "opacity-70")}
                      strokeWidth={isActive ? 2.25 : 1.9}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{displayName}</p>
            <p className="text-[11px] text-muted-foreground">v1.0.0</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
