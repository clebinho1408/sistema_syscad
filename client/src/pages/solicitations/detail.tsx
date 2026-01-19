import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatusBadge, TypeBadge } from "@/components/status-badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  FileText,
  User,
  MapPin,
  Phone,
  Calendar,
  Building2,
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Upload,
  Loader2,
  Copy,
  Check,
  ClipboardList,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SolicitationWithDetails, ChatMessage, Document } from "@shared/schema";

function CopyableField({
  label,
  value,
  fieldName,
  copiedFields,
  onCopy,
}: {
  label: string;
  value: string;
  fieldName: string;
  copiedFields: Set<string>;
  onCopy: (fieldName: string, value: string) => void;
}) {
  const isCopied = copiedFields.has(fieldName);
  return (
    <div className={`p-3 border rounded-lg transition-colors ${isCopied ? 'bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-medium truncate">{value}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCopy(fieldName, value)}
          className={isCopied ? 'text-green-600' : ''}
          data-testid={`button-copy-${fieldName}`}
        >
          {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function SolicitationDetailPage() {
  const [, params] = useRoute("/solicitations/:id");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [pendingReason, setPendingReason] = useState("");
  const [externalObservation, setExternalObservation] = useState("");
  const [isPendingDialogOpen, setIsPendingDialogOpen] = useState(false);
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
  const [copiedFields, setCopiedFields] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: solicitation, isLoading } = useQuery<SolicitationWithDetails>({
    queryKey: ["/api/solicitations", params?.id],
    enabled: !!params?.id,
  });

  const { data: messages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/solicitations", params?.id, "messages"],
    enabled: !!params?.id,
    refetchInterval: 3000,
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/solicitations", params?.id, "documents"],
    enabled: !!params?.id,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", `/api/solicitations/${params?.id}/messages`, { message });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "messages"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { status: string; justificativa?: string; observacoesExternas?: string; sendChatNotification?: boolean }) => {
      return apiRequest("PATCH", `/api/solicitations/${params?.id}/status`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Status atualizado com sucesso!" });
      setIsPendingDialogOpen(false);
      setPendingReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ documentId, data }: { documentId: string; data: any }) => {
      return apiRequest("PATCH", `/api/documents/${documentId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "documents"] });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleCadastrado = () => {
    updateStatusMutation.mutate({ status: "aprovada", sendChatNotification: true });
  };

  const handlePendente = () => {
    if (!pendingReason.trim()) {
      toast({ title: "Motivo da pendencia obrigatorio", variant: "destructive" });
      return;
    }
    updateStatusMutation.mutate({ status: "pendente_correcao", observacoesExternas: pendingReason, sendChatNotification: true });
  };

  const handleRequestCorrection = () => {
    if (!externalObservation.trim()) {
      toast({ title: "Observacao obrigatoria", variant: "destructive" });
      return;
    }
    updateStatusMutation.mutate({ status: "pendente_correcao", observacoesExternas: externalObservation, sendChatNotification: true });
  };

  const copyToClipboard = async (fieldName: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFields(prev => new Set(prev).add(fieldName));
      toast({ title: "Copiado!" });
    } catch (err) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!solicitation) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 mx-auto text-muted-foreground/30" />
        <p className="mt-4 text-lg font-medium">Solicitação não encontrada</p>
        <Link href="/solicitations">
          <Button className="mt-4">Voltar</Button>
        </Link>
      </div>
    );
  }

  const isFinalized = solicitation.status === "aprovada" || solicitation.status === "reprovada";
  const canEdit = user?.role === "operador" || user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/solicitations">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Detalhes da Solicitação</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              Criada em {format(new Date(solicitation.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TypeBadge type={solicitation.type as any} />
          <StatusBadge status={solicitation.status as any} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Dados do Candidato/Condutor
              </CardTitle>
              {canEdit && (
                <Dialog open={isDataDialogOpen} onOpenChange={setIsDataDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-open-full-data">
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Abrir Dados Completos
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Dados Completos do Candidato</DialogTitle>
                      <DialogDescription>
                        Clique no icone ao lado de cada campo para copiar
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div>
                        <h4 className="font-medium mb-3 text-sm text-muted-foreground">Dados Pessoais</h4>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <CopyableField label="Nome Completo" value={solicitation.conductor.nomeCompleto} fieldName="nomeCompleto" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          </div>
                          <div className="md:col-span-2">
                            <CopyableField label="Nome da Mae" value={solicitation.conductor.nomeMae} fieldName="nomeMae" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          </div>
                          <div className="md:col-span-2">
                            <CopyableField label="Nome do Pai" value={solicitation.conductor.nomePai || "-"} fieldName="nomePai" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          </div>
                          <CopyableField label="Nacionalidade" value={solicitation.conductor.nacionalidade} fieldName="nacionalidade" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Data de Nascimento" value={solicitation.conductor.dataNascimento} fieldName="dataNascimento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Cidade de Nascimento" value={solicitation.conductor.cidadeNascimento} fieldName="cidadeNascimento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="UF Nascimento" value={solicitation.conductor.ufNascimento} fieldName="ufNascimento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="RG" value={solicitation.conductor.rg} fieldName="rg" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Orgao Emissor / UF" value={`${solicitation.conductor.orgaoEmissor}/${solicitation.conductor.ufEmissor}`} fieldName="orgaoEmissorUf" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-3 text-sm text-muted-foreground">Endereço</h4>
                        <div className="grid gap-3 md:grid-cols-2">
                          <CopyableField label="CEP" value={solicitation.conductor.cep} fieldName="cep" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Tipo de Logradouro" value={solicitation.conductor.tipoLogradouro} fieldName="tipoLogradouro" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Logradouro" value={solicitation.conductor.logradouro} fieldName="logradouro" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Numero" value={solicitation.conductor.numero} fieldName="numero" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Complemento" value={solicitation.conductor.complemento || "-"} fieldName="complemento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Bairro" value={solicitation.conductor.bairro} fieldName="bairro" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Cidade" value={solicitation.conductor.cidade} fieldName="cidade" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="UF" value={solicitation.conductor.uf} fieldName="uf" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-3 text-sm text-muted-foreground">Contato</h4>
                        <div className="grid gap-3 md:grid-cols-2">
                          <CopyableField label="Telefone 1" value={solicitation.conductor.telefone1} fieldName="telefone1" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Telefone 2" value={solicitation.conductor.telefone2 || "-"} fieldName="telefone2" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="E-mail" value={solicitation.conductor.email} fieldName="email" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsDataDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-medium" data-testid="text-cpf">{solicitation.conductor.cpf}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome Completo</p>
                <p className="font-medium">{solicitation.conductor.nomeCompleto}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome da Mãe</p>
                <p className="font-medium">{solicitation.conductor.nomeMae}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nome do Pai</p>
                <p className="font-medium">{solicitation.conductor.nomePai || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nacionalidade</p>
                <p className="font-medium">{solicitation.conductor.nacionalidade}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                <p className="font-medium">{solicitation.conductor.dataNascimento}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Naturalidade</p>
                <p className="font-medium">{solicitation.conductor.cidadeNascimento}/{solicitation.conductor.ufNascimento}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">RG</p>
                <p className="font-medium">{solicitation.conductor.rg}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Orgao Emissor / UF</p>
                <p className="font-medium">{solicitation.conductor.orgaoEmissor}/{solicitation.conductor.ufEmissor}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {solicitation.conductor.tipoLogradouro} {solicitation.conductor.logradouro}, {solicitation.conductor.numero}
                {solicitation.conductor.complemento && ` - ${solicitation.conductor.complemento}`}
              </p>
              <p className="text-muted-foreground">
                {solicitation.conductor.bairro} - {solicitation.conductor.cidade}/{solicitation.conductor.uf}
              </p>
              <p className="text-muted-foreground">CEP: {solicitation.conductor.cep}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Telefone 1</p>
                <p className="font-medium">{solicitation.conductor.telefone1}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone 2</p>
                <p className="font-medium">{solicitation.conductor.telefone2 || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">E-mail</p>
                <p className="font-medium">{solicitation.conductor.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documentos Anexados
              </CardTitle>
              <CardDescription>
                {documents?.length || 0} documento(s) anexado(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents?.map((doc) => (
                <div key={doc.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.fileName}</p>
                    <p className="text-sm text-muted-foreground">{doc.fileType}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={doc.isLegible || false}
                          onCheckedChange={(checked) => updateDocumentMutation.mutate({ documentId: doc.id, data: { isLegible: checked } })}
                          data-testid={`check-legible-${doc.id}`}
                        />
                        Legível
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={doc.isValid || false}
                          onCheckedChange={(checked) => updateDocumentMutation.mutate({ documentId: doc.id, data: { isValid: checked } })}
                          data-testid={`check-valid-${doc.id}`}
                        />
                        Válido
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={doc.isCompatible || false}
                          onCheckedChange={(checked) => updateDocumentMutation.mutate({ documentId: doc.id, data: { isCompatible: checked } })}
                          data-testid={`check-compatible-${doc.id}`}
                        />
                        Compatível
                      </label>
                    </div>
                  )}
                  <a href={doc.fileData} download={doc.fileName} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" data-testid={`button-download-${doc.id}`}>
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
              ))}
              {(!documents || documents.length === 0) && (
                <p className="text-center text-muted-foreground py-4">Nenhum documento anexado</p>
              )}
            </CardContent>
          </Card>

          {solicitation.observacoesExternas && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  Observações do DETRAN
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{solicitation.observacoesExternas}</p>
              </CardContent>
            </Card>
          )}

          {solicitation.justificativaReprovacao && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="w-5 h-5" />
                  Justificativa da Reprovação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>{solicitation.justificativaReprovacao}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Autoescola
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{solicitation.drivingSchool.nome}</p>
              <Separator className="my-3" />
              <p className="text-sm">
                <span className="text-muted-foreground">Telefone:</span> {solicitation.drivingSchool.telefone}
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">E-mail:</span> {solicitation.drivingSchool.email}
              </p>
            </CardContent>
          </Card>

          {canEdit && !isFinalized && (
            <Card>
              <CardHeader>
                <CardTitle>Acoes</CardTitle>
                <CardDescription>Atualize o status da solicitacao</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="default" className="w-full" onClick={handleCadastrado} disabled={updateStatusMutation.isPending} data-testid="button-cadastrado">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Cadastrado
                </Button>

                <Dialog open={isPendingDialogOpen} onOpenChange={setIsPendingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full" data-testid="button-pendente-trigger">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Pendente
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Marcar como Pendente</DialogTitle>
                      <DialogDescription>
                        Informe o motivo da pendencia. Esta informacao sera visivel para a autoescola.
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Digite o motivo da pendencia..."
                      value={pendingReason}
                      onChange={(e) => setPendingReason(e.target.value)}
                      rows={4}
                      data-testid="input-pending-reason"
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsPendingDialogOpen(false)}>Cancelar</Button>
                      <Button variant="default" onClick={handlePendente} disabled={updateStatusMutation.isPending}>
                        {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar Pendencia
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          <Card className="flex flex-col h-96">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Chat
              </CardTitle>
              <CardDescription>Comunicação sobre esta solicitação</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg max-w-[85%] ${
                      msg.senderId === user?.id
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {format(new Date(msg.createdAt), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                ))}
                {(!messages || messages.length === 0) && (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    Nenhuma mensagem ainda
                  </p>
                )}
                <div ref={messagesEndRef} />
              </div>

              {!isFinalized && (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1"
                    data-testid="input-message"
                  />
                  <Button type="submit" size="icon" disabled={sendMessageMutation.isPending} data-testid="button-send-message">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              )}

              {isFinalized && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  Chat encerrado - Solicitação finalizada
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
