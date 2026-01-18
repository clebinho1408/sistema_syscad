import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { History, Search, User, FileText, Settings, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AuditLog, User as UserType } from "@shared/schema";

interface AuditLogWithUser extends AuditLog {
  user?: UserType;
}

const actionLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "Criação", variant: "default" },
  update: { label: "Atualização", variant: "secondary" },
  delete: { label: "Exclusão", variant: "destructive" },
  login: { label: "Login", variant: "outline" },
  logout: { label: "Logout", variant: "outline" },
  status_change: { label: "Mudança de Status", variant: "secondary" },
  message: { label: "Mensagem", variant: "outline" },
};

const entityLabels: Record<string, string> = {
  user: "Usuário",
  driving_school: "Autoescola",
  solicitation: "Solicitação",
  document: "Documento",
  chat_message: "Mensagem",
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<AuditLogWithUser[]>({
    queryKey: ["/api/audit-logs"],
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      log.details?.toLowerCase().includes(search.toLowerCase()) ||
      log.user?.name.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId?.includes(search);
    const matchesEntity = entityFilter === "all" || log.entity === entityFilter;
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesEntity && matchesAction;
  });

  const getActionBadge = (action: string) => {
    const config = actionLabels[action] || { label: action, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case "user":
        return <User className="w-4 h-4" />;
      case "solicitation":
      case "document":
        return <FileText className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logs de Auditoria</h1>
        <p className="text-muted-foreground">
          Histórico completo de ações realizadas no sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário, ID ou detalhes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-logs"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger data-testid="select-entity-filter">
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as entidades</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="driving_school">Autoescola</SelectItem>
                <SelectItem value="solicitation">Solicitação</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
                <SelectItem value="chat_message">Mensagem</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger data-testid="select-action-filter">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="status_change">Mudança de Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico
          </CardTitle>
          <CardDescription>
            {filteredLogs?.length || 0} registros encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                  data-testid={`log-row-${log.id}`}
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {getEntityIcon(log.entity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{log.user?.name || "Sistema"}</span>
                      {getActionBadge(log.action)}
                      <Badge variant="outline">{entityLabels[log.entity] || log.entity}</Badge>
                    </div>
                    {log.details && (
                      <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                    )}
                    {log.entityId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {log.entityId}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(log.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.createdAt), "HH:mm:ss", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <History className="h-16 w-16 mx-auto text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium">Nenhum registro encontrado</p>
              <p className="text-muted-foreground mt-1">
                {search || entityFilter !== "all" || actionFilter !== "all"
                  ? "Tente ajustar os filtros"
                  : "Os logs aparecerão aqui conforme ações forem realizadas"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
