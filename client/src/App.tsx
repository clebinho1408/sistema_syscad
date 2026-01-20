import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import SolicitationsPage from "@/pages/solicitations/index";
import NewSolicitationPage from "@/pages/solicitations/new";
import SolicitationDetailPage from "@/pages/solicitations/detail";
import SolicitationEditPage from "@/pages/solicitations/edit";
import DrivingSchoolsPage from "@/pages/driving-schools";
import UsersPage from "@/pages/users";
import ReportsPage from "@/pages/reports";
import AuditLogsPage from "@/pages/audit-logs";
import SettingsPage from "@/pages/settings";
import SolicitationTypesPage from "@/pages/solicitation-types";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, allowedRoles }: { component: React.ComponentType; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between gap-2 p-3 border-b bg-background/95 backdrop-blur sticky top-0 z-10">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/dashboard">
        <AppLayout>
          <ProtectedRoute component={DashboardPage} />
        </AppLayout>
      </Route>
      <Route path="/solicitations">
        <AppLayout>
          <ProtectedRoute component={SolicitationsPage} />
        </AppLayout>
      </Route>
      <Route path="/solicitations/new">
        <AppLayout>
          <ProtectedRoute component={NewSolicitationPage} allowedRoles={["autoescola"]} />
        </AppLayout>
      </Route>
      <Route path="/solicitations/:id/edit">
        <AppLayout>
          <ProtectedRoute component={SolicitationEditPage} allowedRoles={["autoescola"]} />
        </AppLayout>
      </Route>
      <Route path="/solicitations/:id">
        <AppLayout>
          <ProtectedRoute component={SolicitationDetailPage} />
        </AppLayout>
      </Route>
      <Route path="/driving-schools">
        <AppLayout>
          <ProtectedRoute component={DrivingSchoolsPage} allowedRoles={["admin"]} />
        </AppLayout>
      </Route>
      <Route path="/users">
        <AppLayout>
          <ProtectedRoute component={UsersPage} allowedRoles={["admin"]} />
        </AppLayout>
      </Route>
      <Route path="/reports">
        <AppLayout>
          <ProtectedRoute component={ReportsPage} allowedRoles={["admin"]} />
        </AppLayout>
      </Route>
      <Route path="/audit-logs">
        <AppLayout>
          <ProtectedRoute component={AuditLogsPage} allowedRoles={["admin"]} />
        </AppLayout>
      </Route>
      <Route path="/settings">
        <AppLayout>
          <ProtectedRoute component={SettingsPage} allowedRoles={["admin"]} />
        </AppLayout>
      </Route>
      <Route path="/solicitation-types">
        <AppLayout>
          <ProtectedRoute component={SolicitationTypesPage} allowedRoles={["admin"]} />
        </AppLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="detran-theme">
        <TooltipProvider>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
