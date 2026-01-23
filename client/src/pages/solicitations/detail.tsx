import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
  Maximize2,
  X,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SolicitationWithDetails, ChatMessageWithSender, Document, SolicitationType } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [isEnderecoDialogOpen, setIsEnderecoDialogOpen] = useState(false);
  const [isContatoDialogOpen, setIsContatoDialogOpen] = useState(false);
  const [isAccessRequestOpen, setIsAccessRequestOpen] = useState(false);
  const [requestedFields, setRequestedFields] = useState<string[]>([]);
  const [requestedDocs, setRequestedDocs] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [copiedFields, setCopiedFields] = useState<Set<string>>(new Set());
  const [isChatPopupOpen, setIsChatPopupOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isPenaltyDialogOpen, setIsPenaltyDialogOpen] = useState(false);
  const [penaltyReleaseDate, setPenaltyReleaseDate] = useState("");
  const [openedDocs, setOpenedDocs] = useState<Set<string>>(new Set());
  const [isAuthenticityModalOpen, setIsAuthenticityModalOpen] = useState(false);
  const [authenticityResult, setAuthenticityResult] = useState<any>(null);
  const [verificationCooldown, setVerificationCooldown] = useState(false);
  const [visualQualityResult, setVisualQualityResult] = useState<any>(null);
  const [isAnalyzingVisualQuality, setIsAnalyzingVisualQuality] = useState(false);
  const [visualQualityAnalyzedDocs, setVisualQualityAnalyzedDocs] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const [renachFile, setRenachFile] = useState<{ name: string; data: string; type: string } | null>(null);
  const [isUploadingRenach, setIsUploadingRenach] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const popupChatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const popupMessagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessagesCount = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef<boolean>(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("openChat") === "true") {
      setIsChatPopupOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Automatic visual quality analysis for ID documents (only for operador/admin)
  const canAnalyzeVisualQuality = user?.role === "operador" || user?.role === "admin";
  
  useEffect(() => {
    if (canAnalyzeVisualQuality &&
        selectedDoc && 
        selectedDoc.category === "documento_identificacao" && 
        !visualQualityAnalyzedDocs.has(selectedDoc.id) &&
        !analyzeVisualQualityMutation.isPending) {
      setVisualQualityResult(null);
      analyzeVisualQualityMutation.mutate(selectedDoc.id);
    } else if (selectedDoc && selectedDoc.category !== "documento_identificacao") {
      setVisualQualityResult(null);
    }
  }, [selectedDoc, canAnalyzeVisualQuality]);

  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }
        if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume();
        }
        audioUnlockedRef.current = true;
      } catch {}
    };

    document.addEventListener("click", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    document.addEventListener("touchstart", unlockAudio);

    return () => {
      document.removeEventListener("click", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (!params?.id || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?solicitationId=${params.id}&userId=${user.id}&userName=${encodeURIComponent(user.name)}&userRole=${user.role}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "presence") {
          const newOnlineUsers = data.onlineUsers.filter((u: any) => u.id !== user.id);
          setOnlineUsers(newOnlineUsers);
          const onlineUserIds = new Set(newOnlineUsers.map((u: any) => u.id));
          setTypingUsers((prev) => prev.filter((u) => onlineUserIds.has(u.id)));
        } else if (data.type === "typing") {
          if (data.userId !== user.id) {
            if (data.isTyping) {
              setTypingUsers((prev) => {
                if (!prev.find((u) => u.id === data.userId)) {
                  return [...prev, { id: data.userId, name: data.userName }];
                }
                return prev;
              });
            } else {
              setTypingUsers((prev) => prev.filter((u) => u.id !== data.userId));
            }
          }
        } else if (data.type === "newMessage") {
          queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params.id, "messages"] });
        }
      } catch (e) {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [params?.id, user, queryClient]);

  useEffect(() => {
    if (isChatPopupOpen && params?.id) {
      apiRequest("POST", `/api/solicitations/${params.id}/mark-read`, {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/chat/unread-counts"] });
      });
    }
  }, [isChatPopupOpen, params?.id, queryClient]);

  const { data: solicitation, isLoading } = useQuery<SolicitationWithDetails>({
    queryKey: ["/api/solicitations", params?.id],
    enabled: !!params?.id,
    refetchInterval: 5000,
  });

  const { data: solicitationTypes } = useQuery<SolicitationType[]>({
    queryKey: ["/api/solicitation-types"],
  });

  const getTypeLabel = (typeValue: string) => {
    return solicitationTypes?.find(t => t.value === typeValue)?.label || typeValue;
  };

  const { data: messages } = useQuery<ChatMessageWithSender[]>({
    queryKey: ["/api/solicitations", params?.id, "messages"],
    enabled: !!params?.id,
    refetchInterval: 3000,
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/solicitations", params?.id, "documents"],
    enabled: !!params?.id,
    refetchInterval: 5000,
  });

  const { data: accessRequests } = useQuery<{ id: string; fields: string[] | null; documents: string[] | null; status: string; requestedByName: string; rejectionReason: string | null; createdAt: string }[]>({
    queryKey: ["/api/solicitations", params?.id, "access-requests"],
    enabled: !!params?.id,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      popupMessagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    };
    if (messages && messages.length > 0) {
      scrollToBottom();
      // Second attempt to handle layout shifts
      const timeoutId = setTimeout(scrollToBottom, 250);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, isChatPopupOpen, typingUsers]);

  useEffect(() => {
    if (messages && messages.length > previousMessagesCount.current) {
      const lastMessage = messages[messages.length - 1];
      if (previousMessagesCount.current > 0 && lastMessage.senderId !== user?.id && !isChatPopupOpen) {
        const playNotification = () => {
          if (!audioUnlockedRef.current || !audioContextRef.current) return;
          
          const ctx = audioContextRef.current;
          if (ctx.state === "suspended") {
            ctx.resume();
          }
          
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          oscillator.frequency.setValueAtTime(880, ctx.currentTime);
          oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
          
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
        };
        try {
          playNotification();
        } catch {}
      }
    }
    previousMessagesCount.current = messages?.length || 0;
  }, [messages, user?.id, isChatPopupOpen]);

  const sendTypingIndicator = (isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && user) {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        userId: user.id,
        userName: user.name,
        isTyping,
      }));
    }
  };

  const handleMessageChange = (value: string) => {
    setNewMessage(value);
    if (value.length > 0) {
      sendTypingIndicator(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(false);
      }, 2000);
    } else {
      sendTypingIndicator(false);
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest("POST", `/api/solicitations/${params?.id}/messages`, { message });
    },
    onSuccess: () => {
      setNewMessage("");
      sendTypingIndicator(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "messages"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { status: string; justificativa?: string; observacoesExternas?: string; sendChatNotification?: boolean; accessGranted?: boolean }) => {
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

  const verifyAuthenticityMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("POST", `/api/documents/${documentId}/verify-authenticity`);
      return response.json();
    },
    onSuccess: (data) => {
      setAuthenticityResult(data);
      setIsAuthenticityModalOpen(true);
      // Ativa cooldown de 15 segundos após verificação
      setVerificationCooldown(true);
      setTimeout(() => setVerificationCooldown(false), 15000);
    },
    onError: (error: any) => {
      toast({
        title: "Erro na verificação",
        description: error.message || "Não foi possível verificar a autenticidade do documento",
        variant: "destructive",
      });
      // Ativa cooldown mesmo em caso de erro (para evitar spam)
      setVerificationCooldown(true);
      setTimeout(() => setVerificationCooldown(false), 15000);
    },
  });

  const analyzeVisualQualityMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest("POST", `/api/documents/${documentId}/analyze-visual-quality`);
      return response.json();
    },
    onSuccess: (data, documentId) => {
      setVisualQualityResult(data);
      setVisualQualityAnalyzedDocs(prev => new Set(prev).add(documentId));
    },
    onError: (error: any) => {
      console.error("Erro na análise visual:", error.message);
      setVisualQualityResult({ error: true, mensagem: error.message || "Falha na análise visual" });
      toast({
        title: "Análise visual indisponível",
        description: error.message || "Não foi possível analisar o documento. Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const uploadRenachMutation = useMutation({
    mutationFn: async (data: { fileName: string; fileType: string; fileData: string }) => {
      return apiRequest("POST", `/api/solicitations/${params?.id}/upload-renach`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "messages"] });
      toast({ title: "Renach Assinado anexado com sucesso!" });
      setRenachFile(null);
      setIsUploadingRenach(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao anexar", description: error.message, variant: "destructive" });
      setIsUploadingRenach(false);
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async (data: { fields: string[]; documents: string[] }) => {
      return apiRequest("POST", `/api/solicitations/${params?.id}/request-access`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "access-requests"] });
      toast({ title: "Pedido de acesso enviado!" });
      setIsAccessRequestOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar pedido", description: error.message, variant: "destructive" });
    },
  });

  const approveAccessMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return apiRequest("POST", `/api/access-requests/${requestId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "messages"] });
      toast({ title: "Pedido de acesso aprovado!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao aprovar pedido", description: error.message, variant: "destructive" });
    },
  });

  const rejectAccessMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      return apiRequest("POST", `/api/access-requests/${requestId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "messages"] });
      toast({ title: "Pedido de acesso rejeitado!" });
      setIsRejectDialogOpen(false);
      setRejectingRequestId(null);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao rejeitar pedido", description: error.message, variant: "destructive" });
    },
  });

  const handleRejectAccess = () => {
    if (!rejectionReason.trim()) {
      toast({ title: "Motivo da rejeição é obrigatório", variant: "destructive" });
      return;
    }
    if (rejectingRequestId) {
      rejectAccessMutation.mutate({ requestId: rejectingRequestId, reason: rejectionReason });
    }
  };

  const setPenaltyMutation = useMutation({
    mutationFn: async (data: { penaltyReleaseDate: string }) => {
      return apiRequest("PATCH", `/api/solicitations/${params?.id}/penalty`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Penalidade registrada com sucesso!" });
      setIsPenaltyDialogOpen(false);
      setPenaltyReleaseDate("");
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao registrar penalidade", description: error.message, variant: "destructive" });
    },
  });

  const handlePenalty = () => {
    if (!penaltyReleaseDate) {
      toast({ title: "Data de liberação é obrigatória", variant: "destructive" });
      return;
    }
    setPenaltyMutation.mutate({ penaltyReleaseDate });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleCadastrado = () => {
    updateStatusMutation.mutate({ status: "cadastro_finalizado", sendChatNotification: true });
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

  const isFinalized = solicitation.status === "aprovada" || solicitation.status === "cadastro_finalizado";
  const isAguardandoPenalidade = solicitation.status === "aguardando_penalidade";
  const canEdit = user?.role === "operador" || user?.role === "admin";
  const isAutoescola = user?.role === "autoescola";
  const isPendente = solicitation.status === "pendente_correcao";
  
  // Check if all documents have been opened (if there are documents)
  const allDocsOpened = !documents || documents.length === 0 || documents.every(doc => openedDocs.has(doc.id));

  const fieldsList = [
    { id: "nomeCompleto", label: "Nome Civil" },
    { id: "nomeSocial", label: "Nome Social" },
    { id: "filiacaoAfetiva1", label: "Filiação Afetiva 1" },
    { id: "filiacaoAfetiva2", label: "Filiação Afetiva 2" },
    { id: "nomeMae", label: "Nome da Mãe" },
    { id: "nomePai", label: "Nome do Pai" },
    { id: "sexo", label: "Sexo" },
    { id: "nacionalidade", label: "Nacionalidade" },
    { id: "tipoDocumento", label: "Tipo de Documento" },
    { id: "rg", label: "Identidade" },
    { id: "dataNascimento", label: "Data Nascimento" },
    { id: "ufNascimento", label: "UF Nascimento" },
    { id: "cidadeNascimento", label: "Local Nascimento" },
    { id: "endereco", label: "Endereço" },
    { id: "telefone1", label: "Telefone" },
    { id: "dddCelular", label: "DDD Telefone Celular" },
    { id: "telefone2", label: "Telefone Celular" },
    { id: "email", label: "E-mail" },
  ];

  const docsList = [
    { id: "renach_assinado", label: "Renach Assinado" },
    { id: "documento_identificacao", label: "Documento de Identificação" },
    { id: "comprovante_residencia", label: "Comprovante de Residência" },
    { id: "outros", label: "Outros Documentos/Declarações" },
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
          <TypeBadge type={solicitation.type} label={getTypeLabel(solicitation.type)} />
          <StatusBadge status={solicitation.status as any} />
        </div>
      </div>

        {(user?.role === "operador" || user?.role === "admin") && !isFinalized && !isAguardandoPenalidade && (
          <Card className="mb-6">
            <CardHeader className="py-3 border-b bg-muted/30">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Ações
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <Button 
                  onClick={handleCadastrado} 
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={updateStatusMutation.isPending || !allDocsOpened}
                  data-testid="button-approve"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Cadastro Finalizado
                </Button>

                <Dialog open={isPendingDialogOpen} onOpenChange={setIsPendingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-pendente"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Pendente de Correção
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Pendente de Correção</DialogTitle>
                      <DialogDescription>
                        Informe o motivo da pendência para a autoescola.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Textarea
                        placeholder="Descreva o que precisa ser corrigido..."
                        value={pendingReason}
                        onChange={(e) => setPendingReason(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsPendingDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handlePendente} disabled={updateStatusMutation.isPending}>
                        {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Enviar Pendência
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isPenaltyDialogOpen} onOpenChange={setIsPenaltyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      disabled={setPenaltyMutation.isPending}
                      data-testid="button-reject"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Aguardando Penalidade
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Aguardando Penalidade</DialogTitle>
                      <DialogDescription>
                        Informe a data de liberação da penalidade. Após essa data, o status será alterado automaticamente para "Em Análise".
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <label className="block text-sm font-medium mb-2">Data de Liberação</label>
                      <Input
                        type="date"
                        value={penaltyReleaseDate}
                        onChange={(e) => setPenaltyReleaseDate(e.target.value)}
                        min={format(new Date(), "yyyy-MM-dd")}
                        data-testid="input-penalty-date"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsPenaltyDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handlePenalty} disabled={setPenaltyMutation.isPending}>
                        {setPenaltyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Confirmar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {(user?.role === "operador" || user?.role === "admin") && accessRequests && accessRequests.filter(r => r.status === "pending").length > 0 && (
          <Card className="mb-6 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader className="py-3 border-b bg-orange-100/50 dark:bg-orange-900/30">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <ClipboardList className="w-5 h-5" />
                Pedidos de Acesso Pendentes ({accessRequests.filter(r => r.status === "pending").length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {accessRequests.filter(r => r.status === "pending").map((request) => {
                  const labels: Record<string, string> = {
                    nomeCompleto: "Nome Civil",
                    nomeSocial: "Nome Social",
                    nomeMae: "Nome da Mãe",
                    nomePai: "Nome do Pai",
                    filiacaoAfetiva1: "Filiação Afetiva 1",
                    filiacaoAfetiva2: "Filiação Afetiva 2",
                    sexo: "Sexo",
                    nacionalidade: "Nacionalidade",
                    tipoDocumento: "Tipo de Documento",
                    dataNascimento: "Data de Nascimento",
                    cidadeNascimento: "Local de Nascimento",
                    ufNascimento: "UF Nascimento",
                    rg: "Identidade",
                    endereco: "Endereço",
                    telefone1: "Telefone",
                    telefone2: "Telefone Celular",
                    dddCelular: "DDD Telefone Celular",
                    email: "E-mail",
                    renach_assinado: "Renach Assinado",
                    documento_identificacao: "Documento de Identificação",
                    comprovante_residencia: "Comprovante de Residência",
                    outros: "Outros Documentos/Declarações"
                  };
                  const fieldLabels = (request.fields || []).map(f => labels[f] || f);
                  const docLabels = (request.documents || []).map(d => labels[d] || d);
                  
                  return (
                    <div key={request.id} className="p-4 border rounded-lg bg-white dark:bg-gray-900">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">
                            Solicitado por: <span className="font-medium text-foreground">{request.requestedByName}</span>
                          </p>
                          {fieldLabels.length > 0 && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Campos:</span>{" "}
                              <span className="font-medium">{fieldLabels.join(", ")}</span>
                            </p>
                          )}
                          {docLabels.length > 0 && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">Documentos:</span>{" "}
                              <span className="font-medium">{docLabels.join(", ")}</span>
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(request.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveAccessMutation.mutate(request.id)}
                            disabled={approveAccessMutation.isPending || rejectAccessMutation.isPending}
                            data-testid={`button-approve-access-${request.id}`}
                          >
                            {approveAccessMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                            )}
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setRejectingRequestId(request.id);
                              setIsRejectDialogOpen(true);
                            }}
                            disabled={approveAccessMutation.isPending || rejectAccessMutation.isPending}
                            data-testid={`button-reject-access-${request.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Negar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Negar Pedido de Acesso</DialogTitle>
              <DialogDescription>
                Informe o motivo da negação para a autoescola.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Descreva o motivo da negação..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-rejection-reason"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectingRequestId(null);
                setRejectionReason("");
              }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectAccess}
                disabled={rejectAccessMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectAccessMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirmar Negação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                      Abrir Dados do Candidato/Condutor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Dados do Candidato/Condutor</DialogTitle>
                      <DialogDescription>
                        Clique no ícone ao lado de cada campo para copiar
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <CopyableField label="CPF" value={solicitation.conductor.cpf} fieldName="cpf" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        <div className="md:col-span-2">
                          <CopyableField label="Nome Civil" value={solicitation.conductor.nomeCompleto} fieldName="nomeCompleto" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        </div>
                        {solicitation.conductor.nomeSocial && (
                          <div className="md:col-span-2">
                            <CopyableField label="Nome Social" value={solicitation.conductor.nomeSocial} fieldName="nomeSocial" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          </div>
                        )}
                        <div className="md:col-span-2">
                          <CopyableField label="Nome da Mãe" value={solicitation.conductor.nomeMae} fieldName="nomeMae" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        </div>
                        <div className="md:col-span-2">
                          <CopyableField label="Nome do Pai" value={solicitation.conductor.nomePai || "-"} fieldName="nomePai" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        </div>
                        {solicitation.conductor.filiacaoAfetiva1 && (
                          <div className="md:col-span-2">
                            <CopyableField label="Filiação Afetiva 1" value={solicitation.conductor.filiacaoAfetiva1 || ""} fieldName="filiacaoAfetiva1" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          </div>
                        )}
                        {solicitation.conductor.filiacaoAfetiva2 && (
                          <div className="md:col-span-2">
                            <CopyableField label="Filiação Afetiva 2" value={solicitation.conductor.filiacaoAfetiva2 || ""} fieldName="filiacaoAfetiva2" copiedFields={copiedFields} onCopy={copyToClipboard} />
                          </div>
                        )}
                        <CopyableField label="Data Nascimento" value={format(new Date(solicitation.conductor.dataNascimento + 'T12:00:00'), "dd/MM/yyyy")} fieldName="dataNascimento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        <CopyableField label="Identidade" value={solicitation.conductor.rg} fieldName="rg" copiedFields={copiedFields} onCopy={copyToClipboard} />
                        <CopyableField label="Órgão Emissor" value={solicitation.conductor.orgaoEmissor} fieldName="orgaoEmissor" copiedFields={copiedFields} onCopy={copyToClipboard} />
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
                <p className="text-sm text-muted-foreground">Nome Civil</p>
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
                <p className="text-sm text-muted-foreground">Data Nascimento</p>
                <p className="font-medium">{format(new Date(solicitation.conductor.dataNascimento + 'T12:00:00'), "dd/MM/yyyy")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Local Nascimento</p>
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
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereço
              </CardTitle>
              {canEdit && (
                <Dialog open={isEnderecoDialogOpen} onOpenChange={setIsEnderecoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-open-endereco">
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Abrir Endereço
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Endereço do Candidato</DialogTitle>
                      <DialogDescription>
                        Clique no ícone ao lado de cada campo para copiar
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      <CopyableField label="CEP" value={solicitation.conductor.cep} fieldName="cep" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="Tipo de Logradouro" value={solicitation.conductor.tipoLogradouro} fieldName="tipoLogradouro" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="Logradouro" value={solicitation.conductor.logradouro} fieldName="logradouro" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="Número" value={solicitation.conductor.numero} fieldName="numero" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="Complemento" value={solicitation.conductor.complemento || "-"} fieldName="complemento" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="Bairro" value={solicitation.conductor.bairro} fieldName="bairro" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="Cidade" value={solicitation.conductor.cidade} fieldName="cidade" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="UF" value={solicitation.conductor.uf} fieldName="uf" copiedFields={copiedFields} onCopy={copyToClipboard} />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEnderecoDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
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
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Contato
              </CardTitle>
              {canEdit && (
                <Dialog open={isContatoDialogOpen} onOpenChange={setIsContatoDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-open-contato">
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Abrir Contato
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Contato do Candidato</DialogTitle>
                      <DialogDescription>
                        Clique no ícone ao lado de cada campo para copiar
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                      {solicitation.conductor.telefone1 && (
                        <CopyableField label="Telefone" value={solicitation.conductor.telefone1} fieldName="telefone1" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      )}
                      <CopyableField label="DDD Celular" value={solicitation.conductor.dddCelular || "-"} fieldName="dddCelular" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="Telefone Celular" value={solicitation.conductor.telefone2 || "-"} fieldName="telefone2" copiedFields={copiedFields} onCopy={copyToClipboard} />
                      <CopyableField label="E-mail" value={solicitation.conductor.email} fieldName="email" copiedFields={copiedFields} onCopy={copyToClipboard} />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsContatoDialogOpen(false)}>Fechar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {solicitation.conductor.telefone1 && (
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{solicitation.conductor.telefone1}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Telefone Celular</p>
                <p className="font-medium">({solicitation.conductor.dddCelular || ""}) {solicitation.conductor.telefone2 || "-"}</p>
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
              {documents?.map((doc) => {
                const categoryLabels: Record<string, string> = {
                  "renach_assinado": "Renach Assinado",
                  "documento_identificacao": "Documento de Identificação",
                  "comprovante_residencia": "Comprovante de Residência",
                  "outros": "Outros Documentos/Declarações",
                };
                const categoryLabel = doc.category ? categoryLabels[doc.category] || doc.category : null;
                return (
                  <div key={doc.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {categoryLabel && (
                        <p className="text-xs font-medium text-primary mb-1">{categoryLabel}</p>
                      )}
                      <p className="font-medium truncate">{doc.fileName}</p>
                      <p className="text-sm text-muted-foreground">{doc.fileType}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canEdit && openedDocs.has(doc.id) && (
                        <Check className="w-4 h-4 text-green-600" />
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                          setSelectedDoc(doc);
                          setOpenedDocs(prev => new Set(prev).add(doc.id));
                        }}
                        data-testid={`button-view-${doc.id}`}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                      <a href={doc.fileData ?? undefined} download={doc.fileName} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" data-testid={`button-download-${doc.id}`}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                );
              })}
              {(!documents || documents.length === 0) && (
                <p className="text-center text-muted-foreground py-4">Nenhum documento anexado</p>
              )}
            </CardContent>
          </Card>

          {isAutoescola && solicitation.status === "cadastro_finalizado" && (() => {
            const existingRenach = documents?.find(d => d.category === "renach_assinado");
            const hasRenachAccess = solicitation.accessGranted && 
              solicitation.accessRequestedDocuments?.includes("renach_assinado");
            const canUploadRenach = !existingRenach || hasRenachAccess;
            
            return (
              <Card className={existingRenach && !canUploadRenach ? "border-orange-500/50" : "border-primary/50"}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${existingRenach && !canUploadRenach ? "text-orange-600" : "text-primary"}`}>
                    <Upload className="w-5 h-5" />
                    {existingRenach ? "Renach Assinado Anexado" : "Anexar Renach Assinado"}
                  </CardTitle>
                  <CardDescription>
                    {existingRenach ? (
                      canUploadRenach 
                        ? "Acesso para substituição liberado. Você pode anexar um novo arquivo."
                        : "Renach já anexado. Para substituir, use o botão 'SOLICITAR ACESSO PARA CORREÇÃO' e selecione 'Renach Assinado'."
                    ) : (
                      "O cadastro foi finalizado. Agora você pode anexar o Renach Assinado."
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {existingRenach && !canUploadRenach ? (
                    <div className="flex items-center gap-4 p-3 border rounded-lg bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700">
                      <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{existingRenach.fileName}</p>
                        <p className="text-sm text-muted-foreground">Documento anexado com sucesso</p>
                      </div>
                      <a href={`/api/documents/${existingRenach.id}/download`} download={existingRenach.fileName}>
                        <Button variant="outline" size="icon" data-testid="button-download-renach">
                          <Download className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  ) : renachFile ? (
                    <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/50">
                      <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{renachFile.name}</p>
                        <p className="text-sm text-muted-foreground">{renachFile.type}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setRenachFile(null)}
                        data-testid="button-remove-renach"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clique para selecionar o arquivo</span>
                      <span className="text-xs text-muted-foreground">PDF, JPG, PNG (máx. 5MB)</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            toast({
                              title: "Arquivo muito grande",
                              description: "O arquivo deve ter no máximo 5MB",
                              variant: "destructive",
                            });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setRenachFile({
                              name: file.name,
                              data: reader.result as string,
                              type: file.type,
                            });
                          };
                          reader.readAsDataURL(file);
                          e.target.value = "";
                        }}
                        data-testid="input-renach-file"
                      />
                    </label>
                  )}
                </CardContent>
                {(canUploadRenach || !existingRenach) && (
                  <CardFooter>
                    <Button
                      onClick={() => {
                        if (!renachFile) {
                          toast({
                            title: "Selecione um arquivo",
                            description: "Por favor, selecione o arquivo do Renach Assinado",
                            variant: "destructive",
                          });
                          return;
                        }
                        setIsUploadingRenach(true);
                        uploadRenachMutation.mutate({
                          fileName: renachFile.name,
                          fileType: renachFile.type,
                          fileData: renachFile.data,
                        });
                      }}
                      disabled={!renachFile || isUploadingRenach}
                      className="w-full"
                      data-testid="button-upload-renach"
                    >
                      {isUploadingRenach ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {existingRenach ? "Substituir Renach Assinado" : "Enviar Renach Assinado"}
                        </>
                      )}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })()}

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
                    src={selectedDoc.fileData ?? undefined} 
                    alt={selectedDoc.fileName}
                    className="max-w-full h-auto shadow-lg"
                  />
                ) : selectedDoc?.fileType === 'application/pdf' ? (
                  <iframe 
                    src={selectedDoc.fileData ?? undefined} 
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p>Visualização não disponível para este tipo de arquivo.</p>
                  </div>
                )}
              </div>
              {/* Visual Quality Analysis Results for ID Documents */}
              {selectedDoc?.category === "documento_identificacao" && canAnalyzeVisualQuality && (
                <div className="p-4 border-t bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4" />
                    <span className="font-medium text-sm">Análise Visual Automática</span>
                  </div>
                  
                  {analyzeVisualQualityMutation.isPending ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analisando qualidade do documento...</span>
                    </div>
                  ) : visualQualityResult ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {visualQualityResult.avaliacaoGeral === "APROVADO" && (
                          <Badge className="bg-green-500 no-default-hover-elevate no-default-active-elevate">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Aprovado
                          </Badge>
                        )}
                        {visualQualityResult.avaliacaoGeral === "REQUER_ATENCAO" && (
                          <Badge className="bg-yellow-500 no-default-hover-elevate no-default-active-elevate">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Requer Atenção
                          </Badge>
                        )}
                        {visualQualityResult.avaliacaoGeral === "REPROVADO" && (
                          <Badge variant="destructive" className="no-default-hover-elevate no-default-active-elevate">
                            <XCircle className="w-3 h-3 mr-1" />
                            Reprovado
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">{visualQualityResult.mensagem}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${
                            visualQualityResult.conservacao?.status === "BOM" ? "bg-green-500" :
                            visualQualityResult.conservacao?.status === "REGULAR" ? "bg-yellow-500" : "bg-red-500"
                          }`} />
                          <span>Conservação: {visualQualityResult.conservacao?.status || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${
                            visualQualityResult.rasuras?.detectado ? "bg-red-500" : "bg-green-500"
                          }`} />
                          <span>Rasuras: {visualQualityResult.rasuras?.detectado ? "Detectadas" : "Não detectadas"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${
                            visualQualityResult.cortes?.detectado ? "bg-red-500" : "bg-green-500"
                          }`} />
                          <span>Cortes: {visualQualityResult.cortes?.detectado ? "Informação cortada" : "Completo"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${
                            visualQualityResult.nitidez?.status === "NITIDO" ? "bg-green-500" :
                            visualQualityResult.nitidez?.status === "PARCIALMENTE_NITIDO" ? "bg-yellow-500" : "bg-red-500"
                          }`} />
                          <span>Nitidez: {visualQualityResult.nitidez?.status || "N/A"}</span>
                        </div>
                      </div>
                      
                      {visualQualityResult.recomendacao && (
                        <p className="text-xs text-muted-foreground border-t pt-2">
                          <strong>Recomendação:</strong> {visualQualityResult.recomendacao}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Análise não disponível</p>
                  )}
                </div>
              )}
              
              <DialogFooter className="p-4 border-t gap-2 sm:justify-center">
                {canEdit && selectedDoc?.category === "comprovante_residencia" && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => verifyAuthenticityMutation.mutate(selectedDoc!.id)}
                    disabled={verifyAuthenticityMutation.isPending || verificationCooldown}
                    data-testid="button-verify-authenticity"
                  >
                    {verifyAuthenticityMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 mr-2" />
                    )}
                    Verificar Autenticidade
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Modal de Resultado da Verificação de Autenticidade */}
          <Dialog open={isAuthenticityModalOpen} onOpenChange={setIsAuthenticityModalOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {authenticityResult?.nivelRisco === "BAIXO" && <ShieldCheck className="w-6 h-6 text-green-500" />}
                  {authenticityResult?.nivelRisco === "MEDIO" && <ShieldAlert className="w-6 h-6 text-yellow-500" />}
                  {authenticityResult?.nivelRisco === "ALTO" && <ShieldX className="w-6 h-6 text-red-500" />}
                  Análise de Autenticidade
                  <Badge variant={
                    authenticityResult?.nivelRisco === "BAIXO" ? "default" :
                    authenticityResult?.nivelRisco === "MEDIO" ? "secondary" : "destructive"
                  } className="ml-2">
                    {authenticityResult?.pontuacaoConfianca}% confiança
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              
              {authenticityResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Detalhes da Análise */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Detalhes da Análise</h4>
                    <div className="grid gap-2 text-sm">
                      {Object.entries(authenticityResult.detalhesAnalise || {}).map(([key, value]: [string, any]) => (
                        <div key={key} className="p-2 bg-muted/50 rounded">
                          <div className="flex items-center justify-between">
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                            <Badge variant={value.status === "OK" ? "default" : value.status === "SUSPEITO" ? "secondary" : "destructive"} className="text-xs">
                              {value.status}
                            </Badge>
                          </div>
                          {value.status !== "OK" && value.descricao && (
                            <p className="text-xs text-muted-foreground mt-1">{value.descricao}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadados do PDF */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Metadados do PDF
                    </h4>
                    {authenticityResult.metadatasPdf && Object.keys(authenticityResult.metadatasPdf).length > 0 ? (
                      <div className="bg-muted/30 p-3 rounded-lg border text-sm space-y-1">
                        {authenticityResult.metadatasPdf.titulo && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">Título:</span>
                            <span className="font-mono text-xs break-all">{authenticityResult.metadatasPdf.titulo}</span>
                          </div>
                        )}
                        {authenticityResult.metadatasPdf.autor && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">Autor:</span>
                            <span className="font-mono text-xs break-all">{authenticityResult.metadatasPdf.autor}</span>
                          </div>
                        )}
                        {authenticityResult.metadatasPdf.criador && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">Software:</span>
                            <span className={`font-mono text-xs break-all ${
                              /canva|photoshop|gimp|paint|word|libreoffice|pixlr|fotor|abbyy|ocr|camscanner|smallpdf|ilovepdf|sejda|pdf24|nitro|pdfelement/i.test(authenticityResult.metadatasPdf.criador) 
                                ? 'text-red-500 font-bold' : ''
                            }`}>
                              {authenticityResult.metadatasPdf.criador}
                            </span>
                          </div>
                        )}
                        {authenticityResult.metadatasPdf.produtor && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">Produtor:</span>
                            <span className={`font-mono text-xs break-all ${
                              /canva|photoshop|gimp|paint|word|libreoffice|pixlr|fotor|abbyy|ocr|camscanner|smallpdf|ilovepdf|sejda|pdf24|nitro|pdfelement/i.test(authenticityResult.metadatasPdf.produtor) 
                                ? 'text-red-500 font-bold' : ''
                            }`}>
                              {authenticityResult.metadatasPdf.produtor}
                            </span>
                          </div>
                        )}
                        {authenticityResult.metadatasPdf.dataCriacao && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">Criado:</span>
                            <span className="font-mono text-xs">{new Date(authenticityResult.metadatasPdf.dataCriacao).toLocaleString('pt-BR')}</span>
                          </div>
                        )}
                        {authenticityResult.metadatasPdf.dataModificacao && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">Modificado:</span>
                            <span className="font-mono text-xs">{new Date(authenticityResult.metadatasPdf.dataModificacao).toLocaleString('pt-BR')}</span>
                          </div>
                        )}
                        {authenticityResult.metadatasPdf.numeroPaginas && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground shrink-0">Páginas:</span>
                            <span className="font-mono text-xs">{authenticityResult.metadatasPdf.numeroPaginas}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-muted/30 p-3 rounded-lg border text-sm text-muted-foreground">
                        Metadados não disponíveis (documento não é PDF)
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAuthenticityModalOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-6">
          <Card className="flex flex-col h-[500px]">
            <CardHeader className="flex-shrink-0 py-3 border-b bg-muted/30">
              <CardTitle className="text-lg font-bold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Chat Interno
                  {onlineUsers.length > 0 && (
                    <span className="flex items-center gap-1 text-xs font-normal text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      {onlineUsers.map(u => u.role === "autoescola" ? "Autoescola" : "Operador").join(", ")} online
                    </span>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsChatPopupOpen(true)}
                  data-testid="button-open-chat-popup"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 p-4 min-h-0">
              {messages?.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${msg.senderId === user?.id ? "items-end" : "items-start"}`}
                >
                  <p className={`text-sm font-medium mb-1 ${msg.senderId === user?.id ? "text-right" : "text-left"} text-muted-foreground`}>
                    {msg.senderName} • {format(new Date(msg.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    msg.senderId === user?.id 
                      ? "bg-primary text-primary-foreground rounded-tr-none" 
                      : msg.message.startsWith("[SISTEMA]") || msg.message.startsWith("[PEDIDO DE ACESSO]")
                        ? "bg-muted text-muted-foreground w-full text-center text-sm"
                        : "bg-muted rounded-tl-none"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              ))}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  {typingUsers.map(u => u.name).join(", ")} digitando...
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>
            <CardFooter className="p-4 pt-0 flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                <Input 
                  placeholder="Digite uma mensagem..." 
                  value={newMessage}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  disabled={isFinalized}
                  data-testid="input-chat-message"
                />
                <Button type="submit" size="icon" disabled={isFinalized || sendMessageMutation.isPending} data-testid="button-send-message">
                  {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </CardFooter>
          </Card>

          <Dialog open={isChatPopupOpen} onOpenChange={setIsChatPopupOpen}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Chat Interno
                  {onlineUsers.length > 0 && (
                    <span className="flex items-center gap-1 text-xs font-normal text-green-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      {onlineUsers.map(u => u.role === "autoescola" ? "Autoescola" : "Operador").join(", ")} online
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div ref={popupChatContainerRef} className="flex-1 overflow-y-auto space-y-4 p-6 min-h-0">
                {messages?.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col ${msg.senderId === user?.id ? "items-end" : "items-start"}`}
                  >
                    <p className={`text-sm font-medium mb-1 ${msg.senderId === user?.id ? "text-right" : "text-left"} text-muted-foreground`}>
                      {msg.senderName} • {format(new Date(msg.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      msg.senderId === user?.id 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : msg.message.startsWith("[SISTEMA]") || msg.message.startsWith("[PEDIDO DE ACESSO]")
                          ? "bg-muted text-muted-foreground w-full text-center text-sm"
                          : "bg-muted rounded-tl-none"
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                ))}
                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                    {typingUsers.map(u => u.name).join(", ")} digitando...
                  </div>
                )}
                <div ref={popupMessagesEndRef} />
              </div>
              <div className="p-6 pt-0">
                <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                  <Input 
                    placeholder="Digite uma mensagem..." 
                    value={newMessage}
                    onChange={(e) => handleMessageChange(e.target.value)}
                    disabled={solicitation.status === "aprovada"}
                    data-testid="input-chat-message-popup"
                  />
                  <Button type="submit" size="icon" disabled={solicitation.status === "aprovada" || sendMessageMutation.isPending} data-testid="button-send-message-popup">
                    {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>

          {isAutoescola && solicitation.status !== "aprovada" && (
            <div className="space-y-3">
              {solicitation.accessGranted ? (
                <Link href={`/solicitations/${solicitation.id}/edit`}>
                  <Button className="w-full bg-orange-600 hover:bg-orange-700" data-testid="button-go-to-edit">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    ACESSAR EDIÇÃO LIBERADA
                  </Button>
                </Link>
              ) : (
                <Dialog open={isAccessRequestOpen} onOpenChange={setIsAccessRequestOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white" data-testid="button-request-access">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      SOLICITAR ACESSO PARA CORREÇÃO
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Solicitar Acesso para Edição</DialogTitle>
                      <DialogDescription>
                        Selecione os campos e anexos que deseja corrigir. O DETRAN analisará seu pedido.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-4">
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Campos Cadastrais</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {fieldsList.map((field) => (
                            <div key={field.id} className="flex items-center space-x-2 border rounded-md px-3 py-2">
                              <Checkbox 
                                id={`field-${field.id}`}
                                checked={requestedFields.includes(field.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setRequestedFields([...requestedFields, field.id]);
                                    // Auto-select Renach Assinado for any field
                                    if (!requestedDocs.includes("renach_assinado")) {
                                      setRequestedDocs(prev => [...prev, "renach_assinado"]);
                                    }
                                    // Auto-select Comprovante de Residência for Endereço
                                    if (field.id === "endereco" && !requestedDocs.includes("comprovante_residencia")) {
                                      setRequestedDocs(prev => [...prev, "comprovante_residencia"]);
                                    }
                                    // Auto-select Documento de Identificação for RG
                                    if (field.id === "rg" && !requestedDocs.includes("documento_identificacao")) {
                                      setRequestedDocs(prev => [...prev, "documento_identificacao"]);
                                    }
                                  } else {
                                    const newFields = requestedFields.filter(f => f !== field.id);
                                    setRequestedFields(newFields);
                                    
                                    // Auto-uncheck documents logic
                                    let newDocs = [...requestedDocs];
                                    
                                    // If no fields are checked, uncheck Renach
                                    if (newFields.length === 0) {
                                      newDocs = newDocs.filter(d => d !== "renach_assinado");
                                    }
                                    
                                    // If Endereço is unchecked, uncheck Comprovante de Residência
                                    if (field.id === "endereco") {
                                      newDocs = newDocs.filter(d => d !== "comprovante_residencia");
                                    }
                                    
                                    // If RG is unchecked, uncheck Documento de Identificação
                                    if (field.id === "rg") {
                                      newDocs = newDocs.filter(d => d !== "documento_identificacao");
                                    }
                                    
                                    setRequestedDocs(newDocs);
                                  }
                                }}
                              />
                              <label htmlFor={`field-${field.id}`} className="text-sm leading-none cursor-pointer">
                                {field.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Anexos/Documentos</h4>
                        <div className="space-y-2">
                          {docsList.map((doc) => {
                            const isOutros = doc.id === "outros";
                            const isRenach = doc.id === "renach_assinado";
                            const hasExistingRenach = documents?.some(d => d.category === "renach_assinado");
                            const isAutoSelected = !isOutros && !isRenach;
                            const isRenachSelectable = isRenach && hasExistingRenach;
                            const isDisabled = isAutoSelected || (isRenach && !hasExistingRenach);
                            
                            return (
                              <div key={doc.id} className={`flex items-center space-x-2 border rounded-md px-3 py-2 ${isDisabled ? "opacity-80 bg-muted/30" : ""} ${isRenachSelectable ? "border-orange-300 bg-orange-50 dark:bg-orange-950/30" : ""}`}>
                                <Checkbox 
                                  id={`doc-${doc.id}`}
                                  checked={requestedDocs.includes(doc.id)}
                                  disabled={isDisabled}
                                  className={isDisabled ? "cursor-not-allowed" : ""}
                                  onCheckedChange={(checked) => {
                                    if (!isDisabled) {
                                      if (checked) {
                                        setRequestedDocs([...requestedDocs, doc.id]);
                                      } else {
                                        setRequestedDocs(requestedDocs.filter(d => d !== doc.id));
                                      }
                                    }
                                  }}
                                />
                                <label htmlFor={`doc-${doc.id}`} className={`text-sm leading-none ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                                  {doc.label}
                                  {isRenach && hasExistingRenach && (
                                    <span className="text-xs text-orange-600 ml-2">(Substituir)</span>
                                  )}
                                  {isRenach && !hasExistingRenach && (
                                    <span className="text-xs text-muted-foreground ml-2">(Não anexado ainda)</span>
                                  )}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAccessRequestOpen(false)}>Cancelar</Button>
                      <Button 
                        onClick={() => requestAccessMutation.mutate({ fields: requestedFields, documents: requestedDocs })}
                        disabled={requestAccessMutation.isPending || (requestedFields.length === 0 && requestedDocs.length === 0)}
                      >
                        Enviar Solicitação
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
