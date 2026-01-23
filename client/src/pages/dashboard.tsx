import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, CheckCircle2, XCircle, AlertTriangle, Building2, Users } from "lucide-react";
import { StatusBadge, TypeBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { SolicitationWithDetails, SolicitationType } from "@shared/schema";

interface DashboardStats {
  total: number;
  emAnalise: number;
  pendentes: number;
  finalizados: number;
  aguardandoPenalidade: number;
  autoescolas?: number;
  operadores?: number;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: allSolicitations, isLoading: solicitationsLoading } = useQuery<SolicitationWithDetails[]>({
    queryKey: ["/api/solicitations"],
    refetchInterval: 10000,
  });

  const { data: solicitationTypes } = useQuery<SolicitationType[]>({
    queryKey: ["/api/solicitation-types"],
  });

  const getTypeLabel = (typeValue: string) => {
    return solicitationTypes?.find(t => t.value === typeValue)?.label || typeValue;
  };
  
  // Get the 5 most recent solicitations (sorted by createdAt descending)
  const recentSolicitations = allSolicitations
    ?.slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  if (!user) return null;

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-welcome">
          {getWelcomeMessage()}, {user.name.split(" ")[0]}!
        </h1>
        <p className="text-muted-foreground">
          {user.role === "autoescola" && "Acompanhe suas solicitações e crie novas requisições."}
          {user.role === "operador" && "Gerencie e analise as solicitações recebidas."}
          {user.role === "admin" && "Visão geral do sistema e indicadores."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Solicitações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-total">{stats?.total || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Análise</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-blue-600" data-testid="stat-analysis">{stats?.emAnalise || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente de Correção</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-amber-600" data-testid="stat-pending">{stats?.pendentes || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cadastro Finalizado</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-emerald-600" data-testid="stat-approved">{stats?.finalizados || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {user.role === "admin" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Autoescolas Cadastradas</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="stat-schools">{stats?.autoescolas || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Operadores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold" data-testid="stat-operators">{stats?.operadores || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Solicitações Recentes</CardTitle>
            <CardDescription>
              {user.role === "autoescola"
                ? "Suas últimas solicitações enviadas"
                : "Últimas solicitações recebidas no sistema"}
            </CardDescription>
          </div>
          <Link href="/solicitations">
            <Button variant="outline" size="sm" data-testid="button-view-all">
              Ver todas
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {solicitationsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : recentSolicitations && recentSolicitations.length > 0 ? (
            <div className="space-y-4">
              {recentSolicitations.map((solicitation) => (
                <Link
                  key={solicitation.id}
                  href={`/solicitations/${solicitation.id}`}
                  className="block"
                >
                  <div
                    className="flex items-center gap-4 p-3 rounded-lg border hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`solicitation-item-${solicitation.id}`}
                  >
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{solicitation.conductor.nomeCompleto}</p>
                      <p className="text-sm text-muted-foreground">
                        CPF: {solicitation.conductor.cpf}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <TypeBadge type={solicitation.type} label={getTypeLabel(solicitation.type)} />
                      <StatusBadge status={solicitation.status as any} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Nenhuma solicitação encontrada</p>
              {user.role === "autoescola" && (
                <Link href="/solicitations/new">
                  <Button className="mt-4" data-testid="button-create-first">
                    Criar primeira solicitação
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
