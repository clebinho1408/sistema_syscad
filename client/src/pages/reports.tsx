import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Download, FileText, Clock, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReportStats {
  totalSolicitations: number;
  byStatus: {
    em_analise: number;
    pendente_correcao: number;
    cadastro_finalizado: number;
    aguardando_penalidade: number;
  };
  byType: {
    novo_cadastro: number;
    alteracao_dados: number;
    atualizacao: number;
    regularizacao: number;
  };
  bySchool: { name: string; count: number }[];
  averageAnalysisTime: number;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState("30");

  const { data: stats, isLoading } = useQuery<ReportStats>({
    queryKey: ["/api/reports", { period }],
  });

  const getPeriodLabel = () => {
    const days = parseInt(period);
    if (days === 7) return "Últimos 7 dias";
    if (days === 30) return "Últimos 30 dias";
    if (days === 90) return "Últimos 90 dias";
    return "Todo o período";
  };

  const handleExport = async (format: "pdf" | "excel") => {
    window.open(`/api/reports/export?format=${format}&period=${period}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">
            Visualize métricas e indicadores do sistema
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Todo o período</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExport("excel")} data-testid="button-export-excel">
            <Download className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" onClick={() => handleExport("pdf")} data-testid="button-export-pdf">
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Solicitações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="report-total">
                {stats?.totalSolicitations || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{getPeriodLabel()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-emerald-600" data-testid="report-approved">
                  {stats?.byStatus.cadastro_finalizado || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalSolicitations ? ((stats.byStatus.cadastro_finalizado / stats.totalSolicitations) * 100).toFixed(1) : 0}% do total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Penalidade</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-orange-600" data-testid="report-awaiting-penalty">
                  {stats?.byStatus.aguardando_penalidade || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalSolicitations ? ((stats.byStatus.aguardando_penalidade / stats.totalSolicitations) * 100).toFixed(1) : 0}% do total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Análise</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="report-avg-time">
                  {stats?.averageAnalysisTime || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">dias em média</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Por Status
            </CardTitle>
            <CardDescription>Distribuição das solicitações por status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm">Em Análise</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${stats?.totalSolicitations ? (stats.byStatus.em_analise / stats.totalSolicitations) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{stats?.byStatus.em_analise || 0}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm">Pendentes</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${stats?.totalSolicitations ? (stats.byStatus.pendente_correcao / stats.totalSolicitations) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{stats?.byStatus.pendente_correcao || 0}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm">Finalizadas</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${stats?.totalSolicitations ? (stats.byStatus.cadastro_finalizado / stats.totalSolicitations) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{stats?.byStatus.cadastro_finalizado || 0}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm">Aguardando Penalidade</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${stats?.totalSolicitations ? (stats.byStatus.aguardando_penalidade / stats.totalSolicitations) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{stats?.byStatus.aguardando_penalidade || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Por Tipo
            </CardTitle>
            <CardDescription>Distribuição das solicitações por tipo</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm">Novo Cadastro</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${stats?.totalSolicitations ? (stats.byType.novo_cadastro / stats.totalSolicitations) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{stats?.byType.novo_cadastro || 0}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm">Alteração</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all"
                      style={{ width: `${stats?.totalSolicitations ? (stats.byType.alteracao_dados / stats.totalSolicitations) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{stats?.byType.alteracao_dados || 0}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm">Atualização</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 transition-all"
                      style={{ width: `${stats?.totalSolicitations ? (stats.byType.atualizacao / stats.totalSolicitations) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{stats?.byType.atualizacao || 0}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-32 text-sm">Regularização</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${stats?.totalSolicitations ? (stats.byType.regularizacao / stats.totalSolicitations) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{stats?.byType.regularizacao || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Solicitações por Autoescola
          </CardTitle>
          <CardDescription>Top 10 autoescolas com mais solicitações no período</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : stats?.bySchool && stats.bySchool.length > 0 ? (
            <div className="space-y-3">
              {stats.bySchool.slice(0, 10).map((school, index) => (
                <div key={index} className="flex items-center gap-4">
                  <span className="w-8 text-sm text-muted-foreground">#{index + 1}</span>
                  <span className="w-48 text-sm truncate">{school.name}</span>
                  <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(school.count / (stats.bySchool[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-sm font-medium text-right">{school.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado disponível para o período selecionado
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
