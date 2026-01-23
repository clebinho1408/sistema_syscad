import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Download, FileText, Clock, CheckCircle2, Building2, Users, Search, History, ChevronDown, ChevronRight, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StatusBadge, Status } from "@/components/status-badge";

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

interface DrivingSchoolReport {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  uf: string;
  isActive: boolean;
  totalSolicitations: number;
  finalizadas: number;
  emAnalise: number;
  pendentes: number;
}

interface CandidatesBySchool {
  schoolId: string;
  schoolName: string;
  candidates: {
    em_analise: { id: string; nome: string; cpf: string; tipo: string; createdAt: string }[];
    pendente_correcao: { id: string; nome: string; cpf: string; tipo: string; createdAt: string }[];
    cadastro_finalizado: { id: string; nome: string; cpf: string; tipo: string; createdAt: string }[];
    aguardando_penalidade: { id: string; nome: string; cpf: string; tipo: string; createdAt: string }[];
  };
}

interface CandidateSearch {
  conductorId: string;
  conductorName: string;
  conductorCpf: string;
  type: string;
  status: string;
  createdAt: string;
  drivingSchoolName: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  details: string;
  createdAt: string;
  userName: string;
}

interface CandidateAudit {
  conductor: {
    id: string;
    nome: string;
    cpf: string;
    dataNascimento: string;
    createdAt: string;
  };
  solicitation: {
    id: string;
    type: string;
    status: string;
    createdAt: string;
  };
  auditLogs: AuditLog[];
  messagesCount: number;
}

export default function ReportsPage() {
  const [period, setPeriod] = useState("30");
  const [activeTab, setActiveTab] = useState("overview");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());

  const { data: stats, isLoading } = useQuery<ReportStats>({
    queryKey: ["/api/reports", { period }],
  });

  const { data: drivingSchools, isLoading: isLoadingSchools } = useQuery<DrivingSchoolReport[]>({
    queryKey: ["/api/reports/driving-schools"],
    enabled: activeTab === "driving-schools",
  });

  const { data: candidatesBySchool, isLoading: isLoadingCandidates } = useQuery<CandidatesBySchool[]>({
    queryKey: ["/api/reports/candidates-by-school"],
    enabled: activeTab === "candidates",
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<CandidateSearch[]>({
    queryKey: ["/api/reports/candidates-search", candidateSearch],
    queryFn: async () => {
      const res = await fetch(`/api/reports/candidates-search?search=${encodeURIComponent(candidateSearch)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar candidatos");
      return res.json();
    },
    enabled: activeTab === "audit" && candidateSearch.replace(/[.\-]/g, "").length >= 3,
  });

  const { data: candidateAudit, isLoading: isLoadingAudit } = useQuery<CandidateAudit>({
    queryKey: ["/api/reports/candidate-audit", selectedCandidate],
    enabled: !!selectedCandidate,
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

  const toggleSchool = (schoolId: string) => {
    const newExpanded = new Set(expandedSchools);
    if (newExpanded.has(schoolId)) {
      newExpanded.delete(schoolId);
    } else {
      newExpanded.add(schoolId);
    }
    setExpandedSchools(newExpanded);
  };

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: "Criação",
      update: "Atualização",
      delete: "Exclusão",
      status_change: "Mudança de Status",
    };
    return labels[action] || action;
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintAudit = () => {
    if (!candidateAudit) return;
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Por favor, permita popups para imprimir o relatório.');
      return;
    }
    
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Histórico de Auditoria - ${candidateAudit.conductor.nome}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #333;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .header h1 {
            font-size: 18pt;
            margin-bottom: 5px;
          }
          .header p {
            color: #666;
            font-size: 10pt;
          }
          .section {
            margin-bottom: 25px;
          }
          .section h2 {
            font-size: 14pt;
            margin-bottom: 10px;
            color: #444;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          .field {
            margin-bottom: 8px;
          }
          .field-label {
            font-size: 10pt;
            color: #666;
          }
          .field-value {
            font-weight: bold;
          }
          .audit-item {
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 12px;
            margin-bottom: 10px;
            page-break-inside: avoid;
          }
          .audit-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .audit-action {
            background: #f0f0f0;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 10pt;
          }
          .audit-date {
            font-size: 10pt;
            color: #666;
          }
          .audit-details {
            margin-bottom: 5px;
          }
          .audit-user {
            font-size: 10pt;
            color: #888;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 10pt;
            font-weight: bold;
          }
          .status-em_analise { background: #dbeafe; color: #1e40af; }
          .status-pendente_correcao { background: #fef3c7; color: #92400e; }
          .status-cadastro_finalizado { background: #d1fae5; color: #065f46; }
          .status-aguardando_penalidade { background: #fed7aa; color: #c2410c; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Histórico de Auditoria</h1>
          <p>Impresso em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
        
        <div class="section">
          <h2>Dados do Candidato</h2>
          <div class="grid">
            <div class="field">
              <div class="field-label">Nome:</div>
              <div class="field-value">${candidateAudit.conductor.nome}</div>
            </div>
            <div class="field">
              <div class="field-label">CPF:</div>
              <div class="field-value">${formatCpf(candidateAudit.conductor.cpf)}</div>
            </div>
            <div class="field">
              <div class="field-label">Data de Nascimento:</div>
              <div class="field-value">${candidateAudit.conductor.dataNascimento 
                ? format(new Date(candidateAudit.conductor.dataNascimento), "dd/MM/yyyy", { locale: ptBR })
                : "-"}</div>
            </div>
            <div class="field">
              <div class="field-label">Cadastrado em:</div>
              <div class="field-value">${format(new Date(candidateAudit.conductor.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Solicitação</h2>
          <div class="grid">
            <div class="field">
              <div class="field-label">Tipo:</div>
              <div class="field-value">${candidateAudit.solicitation.type}</div>
            </div>
            <div class="field">
              <div class="field-label">Status Atual:</div>
              <div class="field-value">
                <span class="status-badge status-${candidateAudit.solicitation.status}">${
                  candidateAudit.solicitation.status === 'em_analise' ? 'Em Análise' :
                  candidateAudit.solicitation.status === 'pendente_correcao' ? 'Pendente de Correção' :
                  candidateAudit.solicitation.status === 'cadastro_finalizado' ? 'Cadastro Finalizado' :
                  candidateAudit.solicitation.status === 'aguardando_penalidade' ? 'Aguardando Penalidade' :
                  candidateAudit.solicitation.status
                }</span>
              </div>
            </div>
            <div class="field">
              <div class="field-label">Mensagens no Chat:</div>
              <div class="field-value">${candidateAudit.messagesCount}</div>
            </div>
          </div>
        </div>
        
        <div class="section">
          <h2>Histórico de Ações</h2>
          ${candidateAudit.auditLogs.length > 0 
            ? candidateAudit.auditLogs.map(log => `
              <div class="audit-item">
                <div class="audit-header">
                  <span class="audit-action">${getActionLabel(log.action)}</span>
                  <span class="audit-date">${format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
                <div class="audit-details">${log.details}</div>
                <div class="audit-user">Por: ${log.userName}</div>
              </div>
            `).join('')
            : '<p>Nenhum registro de auditoria encontrado</p>'
          }
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print, 
          header, 
          nav, 
          aside,
          button,
          [data-testid*="button"],
          [data-testid*="select"],
          [role="tablist"] {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .card {
            border: 1px solid #eee !important;
            box-shadow: none !important;
          }
          .space-y-6 > * + * {
            margin-top: 1.5rem !important;
          }
        }
      `}} />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">
            Visualize métricas e indicadores do sistema
          </p>
        </div>
        {activeTab === "overview" && (
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
            <Button variant="outline" onClick={handlePrint} data-testid="button-print">
              <FileText className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="driving-schools" data-testid="tab-driving-schools">
            <Building2 className="w-4 h-4 mr-2" />
            Autoescolas
          </TabsTrigger>
          <TabsTrigger value="candidates" data-testid="tab-candidates">
            <Users className="w-4 h-4 mr-2" />
            Candidatos
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="w-4 h-4 mr-2" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
                  <Building2 className="w-5 h-5" />
                  Top Autoescolas
                </CardTitle>
                <CardDescription>Autoescolas com mais solicitações</CardDescription>
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
                    {stats.bySchool.slice(0, 5).map((school, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <span className="w-8 text-sm text-muted-foreground">#{index + 1}</span>
                        <span className="w-40 text-sm truncate">{school.name}</span>
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
                    Nenhum dado disponível
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="driving-schools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Listagem de Autoescolas
              </CardTitle>
              <CardDescription>Lista completa de autoescolas com estatísticas</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSchools ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : drivingSchools && drivingSchools.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Finalizadas</TableHead>
                      <TableHead className="text-center">Em Análise</TableHead>
                      <TableHead className="text-center">Pendentes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivingSchools.map((school) => (
                      <TableRow key={school.id} data-testid={`row-school-${school.id}`}>
                        <TableCell className="font-medium">{school.nome}</TableCell>
                        <TableCell>{school.cidade}/{school.uf}</TableCell>
                        <TableCell>{school.telefone}</TableCell>
                        <TableCell>
                          <Badge variant={school.isActive ? "default" : "secondary"}>
                            {school.isActive ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">{school.totalSolicitations}</TableCell>
                        <TableCell className="text-center text-emerald-600">{school.finalizadas}</TableCell>
                        <TableCell className="text-center text-blue-600">{school.emAnalise}</TableCell>
                        <TableCell className="text-center text-amber-600">{school.pendentes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma autoescola encontrada
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="candidates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Candidatos por Autoescola
              </CardTitle>
              <CardDescription>Lista de candidatos agrupados por autoescola e status</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCandidates ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : candidatesBySchool && candidatesBySchool.length > 0 ? (
                <div className="space-y-4">
                  {candidatesBySchool.map((school) => {
                    const totalCandidates = 
                      school.candidates.em_analise.length +
                      school.candidates.pendente_correcao.length +
                      school.candidates.cadastro_finalizado.length +
                      school.candidates.aguardando_penalidade.length;
                    
                    if (totalCandidates === 0) return null;

                    const isExpanded = expandedSchools.has(school.schoolId);

                    return (
                      <div key={school.schoolId} className="border rounded-lg">
                        <button
                          onClick={() => toggleSchool(school.schoolId)}
                          className="w-full flex items-center justify-between p-4 hover-elevate"
                          data-testid={`toggle-school-${school.schoolId}`}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                            <span className="font-medium">{school.schoolName}</span>
                            <Badge variant="secondary">{totalCandidates} candidatos</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {school.candidates.em_analise.length > 0 && (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                {school.candidates.em_analise.length} em análise
                              </Badge>
                            )}
                            {school.candidates.pendente_correcao.length > 0 && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                                {school.candidates.pendente_correcao.length} pendentes
                              </Badge>
                            )}
                            {school.candidates.cadastro_finalizado.length > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                                {school.candidates.cadastro_finalizado.length} finalizadas
                              </Badge>
                            )}
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="border-t p-4 space-y-4">
                            {Object.entries(school.candidates).map(([status, candidates]) => {
                              if (candidates.length === 0) return null;
                              
                              return (
                                <div key={status}>
                                  <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <StatusBadge status={status as Status} />
                                  </h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>CPF</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Data</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {candidates.map((candidate) => (
                                        <TableRow key={candidate.id}>
                                          <TableCell className="font-medium">{candidate.nome}</TableCell>
                                          <TableCell>{formatCpf(candidate.cpf)}</TableCell>
                                          <TableCell>{candidate.tipo}</TableCell>
                                          <TableCell>
                                            {format(new Date(candidate.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum candidato encontrado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Relatório de Auditoria por Candidato
              </CardTitle>
              <CardDescription>
                Histórico completo do candidato desde o cadastro até a finalização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CPF do candidato..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    className="pl-10"
                    data-testid="input-candidate-search"
                  />
                </div>
              </div>

              {candidateSearch.length >= 2 && (
                <div className="border rounded-lg">
                  {isSearching ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Autoescola</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchResults.map((result) => (
                          <TableRow key={result.conductorId}>
                            <TableCell className="font-medium">{result.conductorName}</TableCell>
                            <TableCell>{result.conductorCpf ? formatCpf(result.conductorCpf) : "-"}</TableCell>
                            <TableCell>{result.drivingSchoolName}</TableCell>
                            <TableCell>
                              <StatusBadge status={result.status as Status} />
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedCandidate(result.conductorId)}
                                data-testid={`button-view-audit-${result.conductorId}`}
                              >
                                Ver Histórico
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum candidato encontrado
                    </p>
                  )}
                </div>
              )}

              {candidateSearch.length < 2 && (
                <p className="text-center text-muted-foreground py-8">
                  Digite pelo menos 2 caracteres para buscar
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Auditoria
            </DialogTitle>
            {candidateAudit && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrintAudit}
                data-testid="button-print-audit"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {isLoadingAudit ? (
              <div className="space-y-4 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : candidateAudit ? (
              <div className="space-y-6 p-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">Dados do Candidato</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nome:</span>
                      <p className="font-medium">{candidateAudit.conductor.nome}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPF:</span>
                      <p className="font-medium">{formatCpf(candidateAudit.conductor.cpf)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data de Nascimento:</span>
                      <p className="font-medium">
                        {candidateAudit.conductor.dataNascimento 
                          ? format(new Date(candidateAudit.conductor.dataNascimento), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cadastrado em:</span>
                      <p className="font-medium">
                        {format(new Date(candidateAudit.conductor.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Solicitação</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{candidateAudit.solicitation.type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status Atual:</span>
                      <div className="mt-1">
                        <StatusBadge status={candidateAudit.solicitation.status as Status} />
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mensagens no Chat:</span>
                      <p className="font-medium">{candidateAudit.messagesCount}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Histórico de Ações</h3>
                  {candidateAudit.auditLogs.length > 0 ? (
                    <div className="space-y-3">
                      {candidateAudit.auditLogs.map((log) => (
                        <div key={log.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm">{log.details}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Por: {log.userName}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum registro de auditoria encontrado</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Erro ao carregar dados
              </p>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
