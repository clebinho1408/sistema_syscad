import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  Settings,
  BarChart3,
  LogOut,
  ChevronUp,
  ClipboardList,
  History,
  ListOrdered,
} from "lucide-react";
import logoImg from "@/assets/logo.png";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const isActive = (path: string) => location === path;

  const getMenuItems = () => {
    if (user.role === "autoescola") {
      return [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Minhas Solicitações", url: "/solicitations", icon: FileText },
        { title: "Nova Solicitação", url: "/solicitations/new", icon: ClipboardList },
      ];
    }

    if (user.role === "operador") {
      return [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Solicitações", url: "/solicitations", icon: FileText },
      ];
    }

    if (user.role === "admin") {
      return [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Solicitações", url: "/solicitations", icon: FileText },
        { title: "Autoescolas", url: "/driving-schools", icon: Building2 },
        { title: "Usuários", url: "/users", icon: Users },
        { title: "Tipos de Requerimento", url: "/solicitation-types", icon: ListOrdered },
        { title: "Relatórios", url: "/reports", icon: BarChart3 },
        { title: "Configurações", url: "/settings", icon: Settings },
      ];
    }

    return [];
  };

  const menuItems = getMenuItems();

  const getRoleName = () => {
    switch (user.role) {
      case "autoescola":
        return "Autoescola";
      case "operador":
        return "Operador";
      case "admin":
        return "Administrador";
      default:
        return "Usuário";
    }
  };

  const getInitials = () => {
    return user.name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="SysCad" className="w-10 h-10 rounded-md object-contain" />
          <div>
            <h1 className="font-semibold text-sm leading-none text-sidebar-foreground">SysCad</h1>
            <span className="text-xs text-sidebar-foreground/70">Sistema de Cadastro</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.url.replace(/\//g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto py-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs text-sidebar-foreground/70 mt-0.5">{getRoleName()}</p>
              </div>
              <ChevronUp className="w-4 h-4 text-sidebar-foreground/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
