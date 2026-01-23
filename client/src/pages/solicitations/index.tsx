import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, TypeBadge } from "@/components/status-badge";
import { Link, useLocation } from "wouter";
import { FileText, Plus, Search, Filter, Calendar, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import type { SolicitationWithDetails, SolicitationType } from "@shared/schema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function SolicitationsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    em_analise: false,
    pendente_correcao: false,
    aguardando_penalidade: false,
    cadastro_finalizado: false,
  });

  const { data: solicitations, isLoading } = useQuery<SolicitationWithDetails[]>({
    queryKey: ["/api/solicitations"],
    refetchInterval: 10000,
  });

  const { data: unreadCounts } = useQuery<{ solicitationId: string; unreadCount: number }[]>({
    queryKey: ["/api/chat/unread-counts"],
    refetchInterval: 10000,
  });

  const { data: solicitationTypes } = useQuery<SolicitationType[]>({
    queryKey: ["/api/solicitation-types"],
  });

  const getTypeLabel = (typeValue: string) => {
    return solicitationTypes?.find(t => t.value === typeValue)?.label || typeValue;
  };

  const getUnreadCount = (solicitationId: string) => {
    return unreadCounts?.find(u => u.solicitationId === solicitationId)?.unreadCount || 0;
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const filterSolicitations = (status: string) => {
    return solicitations?.filter((s) => {
      const matchesSearch =
        s.conductor.nomeCompleto.toLowerCase().includes(search.toLowerCase()) ||
        s.conductor.cpf.includes(search);
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesType = typeFilter === "all" || s.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType && s.status === status;
    }) || [];
  };

  const statusSections = [
    { id: "em_analise", label: "Em Análise", color: "blue" },
    { id: "pendente_correcao", label: "Pendente de Correção", color: "orange" },
    { id: "aguardando_penalidade", label: "Aguardando Penalidade", color: "red" },
    { id: "cadastro_finalizado", label: "Cadastro Finalizado", color: "green" },
  ];

  const renderSolicitationList = (list: SolicitationWithDetails[]) => (
    <div className="space-y-3 mt-4">
      {list.map((solicitation) => (
        <Link
          key={solicitation.id}
          href={`/solicitations/${solicitation.id}`}
          className="block"
        >
          <div
            className="flex items-center gap-4 p-4 rounded-lg border hover-elevate active-elevate-2 cursor-pointer bg-card"
            data-testid={`solicitation-row-${solicitation.id}`}
          >
            <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{solicitation.conductor.nomeCompleto}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                <span>CPF: {solicitation.conductor.cpf}</span>
                {user?.role !== "autoescola" && (
                  <span>Autoescola: {solicitation.drivingSchool.nome}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(solicitation.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <button
                type="button"
                className="relative p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                data-testid={`chat-icon-${solicitation.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/solicitations/${solicitation.id}?openChat=true`);
                }}
                title="Abrir chat"
              >
                <MessageSquare className="w-5 h-5 text-green-500" />
                {getUnreadCount(solicitation.id) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                    {getUnreadCount(solicitation.id) > 99 ? "99+" : getUnreadCount(solicitation.id)}
                  </span>
                )}
              </button>
              <TypeBadge type={solicitation.type} label={getTypeLabel(solicitation.type)} />
              <StatusBadge status={solicitation.status as any} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solicitações</h1>
          <p className="text-muted-foreground">
            {user?.role === "autoescola"
              ? "Gerencie suas solicitações de cadastro e alterações"
              : "Visualize e analise as solicitações recebidas"}
          </p>
        </div>
        {user?.role === "autoescola" && (
          <Link href="/solicitations/new">
            <Button data-testid="button-new-solicitation">
              <Plus className="w-4 h-4 mr-2" />
              Nova Solicitação
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Busca e Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue placeholder="Requerimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Requerimentos</SelectItem>
                  {solicitationTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {statusSections.map((status) => (
                    <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {statusSections.map((section) => {
          const list = filterSolicitations(section.id);
          const isOpen = openSections[section.id];
          
          return (
            <Collapsible
              key={section.id}
              open={isOpen}
              onOpenChange={() => toggleSection(section.id)}
              className="w-full"
            >
              <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: `var(--${section.color}-500, ${section.color})` }}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between p-6 h-auto hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full bg-${section.color}-500`} />
                      <span className="text-lg font-semibold">{section.label}</span>
                      <Badge variant="secondary" className="ml-2">
                        {list.length}
                      </Badge>
                    </div>
                    {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-6 px-6">
                    {isLoading ? (
                      <div className="space-y-4 mt-4">
                        {[1, 2].map((i) => (
                          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                            <Skeleton className="h-12 w-12 rounded" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-48" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : list.length > 0 ? (
                      renderSolicitationList(list)
                    ) : (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg mt-4">
                        <FileText className="h-8 w-8 mx-auto opacity-20" />
                        <p className="mt-2 text-sm">Nenhuma solicitação neste status</p>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
