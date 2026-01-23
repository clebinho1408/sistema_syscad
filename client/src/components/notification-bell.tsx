import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

interface UnreadCount {
  solicitationId: string;
  solicitationType: string;
  conductorName: string;
  drivingSchoolName: string;
  unreadCount: number;
}

export function NotificationBell() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: unreadCounts } = useQuery<UnreadCount[]>({
    queryKey: ["/api/chat/unread-counts"],
    refetchInterval: 10000,
  });

  const { data: solicitationTypes } = useQuery<any[]>({
    queryKey: ["/api/solicitation-types"],
  });

  const getTypeLabel = (typeValue: string) => {
    return solicitationTypes?.find(t => t.value === typeValue)?.label || typeValue;
  };

  const totalUnread = unreadCounts?.reduce((sum, item) => sum + item.unreadCount, 0) || 0;

  const handleClick = (solicitationId: string) => {
    navigate(`/solicitations/${solicitationId}?openChat=true`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-notification-count"
            >
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {!unreadCounts || unreadCounts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nenhuma mensagem não lida
          </div>
        ) : (
          unreadCounts.map((item) => (
            <DropdownMenuItem
              key={item.solicitationId}
              className="flex items-center justify-between gap-2 cursor-pointer"
              onClick={() => handleClick(item.solicitationId)}
              data-testid={`notification-item-${item.solicitationId}`}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium truncate">{item.conductorName}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground truncate">{getTypeLabel(item.solicitationType)}</span>
                  {(user?.role === "admin" || user?.role === "operador") && (
                    <span className="text-[10px] text-primary/70 font-semibold truncate uppercase">{item.drivingSchoolName}</span>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {item.unreadCount} {item.unreadCount === 1 ? "nova" : "novas"}
              </Badge>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
