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
  ZoomIn,
  ZoomOut,
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
  const [isAccessRequestOpen, setIsAccessRequestOpen] = useState(false);
  const [requestedFields, setRequestedFields] = useState<string[]>([]);
  const [requestedDocs, setRequestedDocs] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
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

  const requestAccessMutation = useMutation({
    mutationFn: async (data: { fields: string[]; documents: string[] }) => {
      return apiRequest("POST", `/api/solicitations/${params?.id}/request-access`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id] });
      toast({ title: "Pedido de acesso enviado!" });
      setIsAccessRequestOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar pedido", description: error.message, variant: "destructive" });
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
  const isAutoescola = user?.role === "autoescola";
  const isPendente = solicitation.status === "pendente_correcao";

  const fieldsList = [
    { id: "nomeCompleto", label: "Nome Completo" },
    { id: "nomeMae", label: "Nome da Mãe" },
    { id: "nomePai", label: "Nome do Pai" },
    { id: "rg", label: "RG" },
    { id: "cpf", label: "CPF" },
    { id: "endereco", label: "Endereço" },
    { id: "contato", label: "Contato" },
  ];

  const docsList = [
    { id: "documento_identificacao", label: "Documento de Identificação" },
    { id: "comprovante_residencia", label: "Comprovante de Residência" },
    { id: "outros", label: "Outros Documentos" },
  ];

  const handleGrantAccess = () => {
    updateStatusMutation.mutate({ 
      status: solicitation.status, 
      accessGranted: true,
      sendChatNotification: true,
      observacoesExternas: "Acesso para edição concedido." 
    });
  };

  const handleRevokeAccess = () => {
    updateStatusMutation.mutate({ 
      status: solicitation.status, 
      accessGranted: false,
      sendChatNotification: true,
      observacoesExternas: "Acesso para edição revogado." 
    });
  };

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
                            <CopyableField label="Nome da Mãe" value={solicitation.conductor.nomeMae} fieldName="nomeMae" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          </div>
                          <div className="md:col-span-2">
                            <CopyableField label="Nome do Pai" value={solicitation.conductor.nomePai || "-"} fieldName="nomePai" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          </div>
                          <CopyableField label="Nacionalidade" value={solicitation.conductor.nacionalidade} fieldName="nacionalidade" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Data de Nascimento" value={format(new Date(solicitation.conductor.dataNascimento + 'T12:00:00'), "dd/MM/yyyy")} fieldName="dataNascimento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Cidade de Nascimento" value={solicitation.conductor.cidadeNascimento} fieldName="cidadeNascimento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="UF Nascimento" value={solicitation.conductor.ufNascimento} fieldName="ufNascimento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="RG" value={solicitation.conductor.rg} fieldName="rg" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Órgão Emissor / UF" value={`${solicitation.conductor.orgaoEmissor}/${solicitation.conductor.ufEmissor}`} fieldName="orgaoEmissorUf" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-3 text-sm text-muted-foreground">Endereço</h4>
                        <div className="grid gap-3 md:grid-cols-2">
                          <CopyableField label="CEP" value={solicitation.conductor.cep} fieldName="cep" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Tipo de Logradouro" value={solicitation.conductor.tipoLogradouro} fieldName="tipoLogradouro" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Logradouro" value={solicitation.conductor.logradouro} fieldName="logradouro" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          <CopyableField label="Número" value={solicitation.conductor.numero} fieldName="numero" copiedFields={copiedFields} onCopy={copyToClipboard} />
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
                <p className="font-medium">{format(new Date(solicitation.conductor.dataNascimento + 'T12:00:00'), "dd/MM/yyyy")}</p>
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
                <p className="text-sm text-muted-foreground">Órgão Emissor / UF</p>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        setSelectedDoc(doc);
                      }}
                      data-testid={`button-view-${doc.id}`}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                    <a href={doc.fileData} download={doc.fileName} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" data-testid={`button-download-${doc.id}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              ))}
              {(!documents || documents.length === 0) && (
                <p className="text-center text-muted-foreground py-4">Nenhum documento anexado</p>
              )}
            </CardContent>
          </Card>

          <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
              <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
                <div>
                  <DialogTitle>Detalhes do Documento</DialogTitle>
                  <DialogDescription>{selectedDoc?.fileName}</DialogDescription>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-4">
                {selectedDoc?.fileType.startsWith('image/') ? (
                  <img 
                    src={selectedDoc.fileData} 
                    alt={selectedDoc.fileName}
                    className="max-w-full h-auto shadow-lg"
                  />
                ) : selectedDoc?.fileType === 'application/pdf' ? (
                  <iframe 
                    src={selectedDoc.fileData} 
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p>Visualização não disponível para este tipo de arquivo.</p>
                    <a href={selectedDoc?.fileData} download={selectedDoc?.fileName} className="text-primary hover:underline mt-2 inline-block">
                      Baixar arquivo
                    </a>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {isAutoescola && isPendente && !solicitation.accessGranted && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="text-blue-700 dark:text-blue-400 text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Solicitar Acesso para Edição
                </CardTitle>
                <CardDescription>
                  Se você precisa corrigir algum campo ou anexo, solicite acesso ao DETRAN.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={isAccessRequestOpen} onOpenChange={setIsAccessRequestOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-100">
                      Escolher Campos e Anexos
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>O que deseja corrigir?</DialogTitle>
                      <DialogDescription>
                        Selecione os itens que precisam de ajuste.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Campos de Dados</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {fieldsList.map(field => (
                            <div key={field.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`field-${field.id}`} 
                                checked={requestedFields.includes(field.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) setRequestedFields([...requestedFields, field.id]);
                                  else setRequestedFields(requestedFields.filter(f => f !== field.id));
                                }}
                              />
                              <label htmlFor={`field-${field.id}`} className="text-xs">{field.label}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Anexos/Documentos</h4>
                        <div className="space-y-2">
                          {docsList.map(doc => (
                            <div key={doc.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`doc-${doc.id}`}
                                checked={requestedDocs.includes(doc.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) setRequestedDocs([...requestedDocs, doc.id]);
                                  else setRequestedDocs(requestedDocs.filter(d => d !== doc.id));
                                }}
                              />
                              <label htmlFor={`doc-${doc.id}`} className="text-xs">{doc.label}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAccessRequestOpen(false)}>Cancelar</Button>
                      <Button 
                        onClick={() => requestAccessMutation.mutate({ fields: requestedFields, documents: requestedDocs })}
                        disabled={requestAccessMutation.isPending || (requestedFields.length === 0 && requestedDocs.length === 0)}
                      >
                        {requestAccessMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Solicitar Acesso
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {canEdit && isPendente && solicitation.accessRequestedFields && solicitation.accessRequestedFields.length > 0 && (
            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/30">
              <CardHeader>
                <CardTitle className="text-orange-700 dark:text-orange-400 text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Pedido de Acesso Pendente
                </CardTitle>
                <CardDescription>
                  A autoescola solicitou acesso para corrigir os seguintes itens:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-2">
                  {solicitation.accessRequestedFields.length > 0 && (
                    <p><strong>Campos:</strong> {solicitation.accessRequestedFields.map(id => fieldsList.find(f => f.id === id)?.label).join(", ")}</p>
                  )}
                  {solicitation.accessRequestedDocuments && solicitation.accessRequestedDocuments.length > 0 && (
                    <p><strong>Anexos:</strong> {solicitation.accessRequestedDocuments.map(id => docsList.find(d => d.id === id)?.label).join(", ")}</p>
                  )}
                </div>
                {!solicitation.accessGranted ? (
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleGrantAccess} disabled={updateStatusMutation.isPending}>
                    {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Aprovar Pedido de Acesso
                  </Button>
                ) : (
                  <Button className="w-full" variant="outline" onClick={handleRevokeAccess} disabled={updateStatusMutation.isPending}>
                    {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Revogar Acesso Concedido
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {isAutoescola && solicitation.accessGranted && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50/30">
              <CardHeader>
                <CardTitle className="text-green-700 dark:text-green-400 text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Acesso para Edição Liberado
                </CardTitle>
                <CardDescription>
                  Você pode editar os campos solicitados e reenviar os documentos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">
                  <strong>Itens liberados:</strong> {[...(solicitation.accessRequestedFields || []), ...(solicitation.accessRequestedDocuments || [])].map(id => {
                    const field = fieldsList.find(f => f.id === id);
                    const doc = docsList.find(d => d.id === id);
                    return field?.label || doc?.label || id;
                  }).join(", ")}
                </p>
                <Link href={`/solicitations/${solicitation.id}/edit`}>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Iniciar Correções
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

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
                <CardTitle>Ações</CardTitle>
                <CardDescription>Atualize o status da solicitação</CardDescription>
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
                        Informe o motivo da pendência. Esta informação será visível para a autoescola.
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Digite o motivo da pendência..."
                      value={pendingReason}
                      onChange={(e) => setPendingReason(e.target.value)}
                      rows={4}
                      data-testid="input-pending-reason"
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsPendingDialogOpen(false)}>Cancelar</Button>
                      <Button variant="default" onClick={handlePendente} disabled={updateStatusMutation.isPending}>
                        {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Confirmar Pendência
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
