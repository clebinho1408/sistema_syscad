import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Settings, FileText, Shield, Info, Database, Users, Plus, Pencil, Trash2, Loader2, GripVertical, Ban, Check, Key } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { SolicitationType, User } from "@shared/schema";

interface UserWithoutPassword {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "autoescola" | "operador" | "admin";
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check OCR availability
  const { data: ocrStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/documents/ocr-status"],
  });

  // ============ SOLICITATION TYPES STATE ============
  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
  const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);
  const [isDeleteTypeOpen, setIsDeleteTypeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SolicitationType | null>(null);
  const [typeFormData, setTypeFormData] = useState({ label: "", sortOrder: "0", isActive: true });

  // ============ USERS STATE ============
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithoutPassword | null>(null);
  const [userFormData, setUserFormData] = useState({ name: "", email: "", role: "operador" as "autoescola" | "operador" | "admin" });

  // Document categories used in the system
  const documentCategories = [
    { id: "documento_identificacao", label: "Documento de Identificação", description: "RG, CNH ou outro documento com foto" },
    { id: "comprovante_residencia", label: "Comprovante de Residência", description: "Conta de luz, água, telefone ou similar" },
    { id: "renach_assinado", label: "Renach Assinado", description: "Formulário RENACH com assinatura do candidato" },
  ];

  // System rules that are actually implemented
  const systemRules = [
    { 
      id: "chat-block", 
      label: "Chat bloqueado após finalização", 
      description: "Mensagens são bloqueadas quando o status é 'Cadastro Finalizado'",
      status: true 
    },
    { 
      id: "cpf-unique", 
      label: "CPF único no sistema", 
      description: "Cada CPF só pode ser cadastrado uma vez em todo o sistema",
      status: true 
    },
    { 
      id: "visual-analysis", 
      label: "Análise visual de documentos de identificação", 
      description: "Operadores podem analisar qualidade visual (conservação, rasuras, cortes) de documentos de identificação",
      status: true 
    },
    { 
      id: "authenticity-check", 
      label: "Verificação de autenticidade", 
      description: "Operadores podem verificar autenticidade de comprovantes de residência via IA",
      status: true 
    },
  ];

  // Solicitation statuses in the system
  const solicitationStatuses = [
    { id: "em_analise", label: "Em Análise", description: "Solicitação aguardando análise do operador", color: "bg-blue-500" },
    { id: "pendente_correcao", label: "Pendente de Correção", description: "Aguardando correção pela autoescola", color: "bg-yellow-500" },
    { id: "cadastro_finalizado", label: "Cadastro Finalizado", description: "Processamento concluído", color: "bg-emerald-500" },
    { id: "aguardando_penalidade", label: "Aguardando Penalidade", description: "Aguardando liberação de penalidade", color: "bg-orange-500" },
  ];

  // ============ SOLICITATION TYPES QUERIES ============
  const { data: types, isLoading: typesLoading } = useQuery<SolicitationType[]>({
    queryKey: ["/api/solicitation-types"],
    enabled: currentUser?.role === "admin",
  });

  const generateValue = (label: string): string => {
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  };

  const createTypeMutation = useMutation({
    mutationFn: async (data: { label: string; sortOrder: string; isActive: boolean }) => {
      const value = generateValue(data.label);
      return apiRequest("POST", "/api/solicitation-types", { ...data, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitation-types"] });
      toast({ title: "Tipo criado com sucesso" });
      setIsCreateTypeOpen(false);
      setTypeFormData({ label: "", sortOrder: "0", isActive: true });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar tipo", description: error.message, variant: "destructive" });
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SolicitationType> }) => {
      return apiRequest("PATCH", `/api/solicitation-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitation-types"] });
      toast({ title: "Tipo atualizado com sucesso" });
      setIsEditTypeOpen(false);
      setSelectedType(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar tipo", description: error.message, variant: "destructive" });
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/solicitation-types/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitation-types"] });
      toast({ title: "Tipo removido com sucesso" });
      setIsDeleteTypeOpen(false);
      setSelectedType(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover tipo", description: error.message, variant: "destructive" });
    },
  });

  // ============ USERS QUERIES ============
  const { data: users, isLoading: usersLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/users"],
    enabled: currentUser?.role === "admin",
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserWithoutPassword> }) => {
      return apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário atualizado com sucesso" });
      setIsEditUserOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar usuário", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/users/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário excluído com sucesso" });
      setIsDeleteUserOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir usuário", description: error.message, variant: "destructive" });
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/users/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Status atualizado" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/users/${id}/reset-password`, {});
    },
    onSuccess: () => {
      toast({ title: "Senha resetada para o padrão (123456)" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao resetar senha", description: error.message, variant: "destructive" });
    },
  });

  // ============ TYPE HANDLERS ============
  const handleCreateType = () => {
    if (!typeFormData.label) {
      toast({ title: "Preencha o nome do tipo", variant: "destructive" });
      return;
    }
    createTypeMutation.mutate(typeFormData);
  };

  const handleEditType = (type: SolicitationType) => {
    setSelectedType(type);
    setTypeFormData({
      label: type.label,
      sortOrder: type.sortOrder,
      isActive: type.isActive,
    });
    setIsEditTypeOpen(true);
  };

  const handleUpdateType = () => {
    if (!selectedType) return;
    updateTypeMutation.mutate({
      id: selectedType.id,
      data: typeFormData,
    });
  };

  const handleDeleteType = (type: SolicitationType) => {
    setSelectedType(type);
    setIsDeleteTypeOpen(true);
  };

  const confirmDeleteType = () => {
    if (!selectedType) return;
    deleteTypeMutation.mutate(selectedType.id);
  };

  const handleToggleTypeActive = (type: SolicitationType) => {
    updateTypeMutation.mutate({
      id: type.id,
      data: { isActive: !type.isActive },
    });
  };

  // ============ USER HANDLERS ============
  const handleEditUser = (user: UserWithoutPassword) => {
    setSelectedUser(user);
    setUserFormData({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setIsEditUserOpen(true);
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;
    updateUserMutation.mutate({
      id: selectedUser.id,
      data: userFormData,
    });
  };

  const handleDeleteUser = (user: UserWithoutPassword) => {
    setSelectedUser(user);
    setIsDeleteUserOpen(true);
  };

  const confirmDeleteUser = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id);
  };

  const handleToggleUserActive = (user: UserWithoutPassword) => {
    toggleUserActiveMutation.mutate({
      id: user.id,
      isActive: !user.isActive,
    });
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-600";
      case "operador": return "bg-purple-600";
      case "autoescola": return "bg-blue-600";
      default: return "";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "operador": return "Operador";
      case "autoescola": return "Autoescola";
      default: return role;
    }
  };

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Informações sobre configurações e regras do sistema
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general" data-testid="tab-general">
            <Settings className="w-4 h-4 mr-2" />
            Geral
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="types" data-testid="tab-types">
                <FileText className="w-4 h-4 mr-2" />
                Requerimentos
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">
                <Users className="w-4 h-4 mr-2" />
                Usuários
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* ============ GENERAL TAB ============ */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Document Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Categorias de Documentos
                </CardTitle>
                <CardDescription>
                  Tipos de documentos aceitos pelo sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {documentCategories.map((doc, index) => (
                  <div key={doc.id}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{doc.label}</p>
                        <p className="text-xs text-muted-foreground">{doc.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                    </div>
                    {index < documentCategories.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* System Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Regras do Sistema
                </CardTitle>
                <CardDescription>
                  Regras de negócio implementadas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {systemRules.map((rule, index) => (
                  <div key={rule.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{rule.label}</p>
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      </div>
                      <Badge 
                        variant={rule.status ? "default" : "secondary"} 
                        className="text-xs shrink-0"
                      >
                        {rule.status ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {index < systemRules.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Solicitation Statuses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Status de Solicitações
                </CardTitle>
                <CardDescription>
                  Estados possíveis para solicitações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {solicitationStatuses.map((status, index) => (
                  <div key={status.id}>
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full ${status.color} mt-1 shrink-0`} />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{status.label}</p>
                        <p className="text-xs text-muted-foreground">{status.description}</p>
                      </div>
                    </div>
                    {index < solicitationStatuses.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Sistema
                </CardTitle>
                <CardDescription>
                  Informações do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Versão do Sistema</span>
                    <span className="font-medium">1.3.0</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Última atualização</span>
                    <span className="font-medium">23/01/2026</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Banco de Dados</span>
                    <Badge variant="default" className="text-xs bg-emerald-600">Conectado</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">OCR (Leitura de Documentos)</span>
                    <Badge 
                      variant={ocrStatus?.available ? "default" : "secondary"} 
                      className={`text-xs ${ocrStatus?.available ? 'bg-emerald-600' : ''}`}
                    >
                      {ocrStatus?.available ? "Disponível" : "Não configurado"}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Armazenamento de Arquivos</span>
                    <Badge variant="default" className="text-xs bg-emerald-600">Object Storage</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Roles Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Perfis de Usuário
              </CardTitle>
              <CardDescription>
                Níveis de acesso disponíveis no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">Autoescola</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Criar e acompanhar solicitações</li>
                    <li>• Enviar documentos</li>
                    <li>• Comunicar-se via chat</li>
                    <li>• Solicitar alterações de dados</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-600">Operador</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Analisar solicitações</li>
                    <li>• Atualizar status</li>
                    <li>• Verificar autenticidade de documentos</li>
                    <li>• Comunicar-se via chat</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-red-600">Admin</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Gerenciar usuários e autoescolas</li>
                    <li>• Gerenciar tipos de solicitação</li>
                    <li>• Transferir candidatos entre autoescolas</li>
                    <li>• Excluir solicitações</li>
                    <li>• Acesso a relatórios e auditoria</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ SOLICITATION TYPES TAB ============ */}
        {isAdmin && (
          <TabsContent value="types" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Tipos de Requerimento</h2>
                <p className="text-sm text-muted-foreground">
                  Gerencie os tipos de solicitação disponíveis no sistema
                </p>
              </div>
              <Dialog open={isCreateTypeOpen} onOpenChange={setIsCreateTypeOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-type">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Tipo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Tipo</DialogTitle>
                    <DialogDescription>
                      Adicione um novo requerimento ao sistema
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="label">Nome do Tipo</Label>
                      <Input
                        id="label"
                        placeholder="ex: Primeira Habilitação"
                        value={typeFormData.label}
                        onChange={(e) => setTypeFormData({ ...typeFormData, label: e.target.value })}
                        data-testid="input-type-label"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sortOrder">Ordem de Exibição</Label>
                      <Input
                        id="sortOrder"
                        type="number"
                        placeholder="0"
                        value={typeFormData.sortOrder}
                        onChange={(e) => setTypeFormData({ ...typeFormData, sortOrder: e.target.value })}
                        data-testid="input-type-order"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={typeFormData.isActive}
                        onCheckedChange={(checked) => setTypeFormData({ ...typeFormData, isActive: checked })}
                        data-testid="switch-type-active"
                      />
                      <Label htmlFor="isActive">Ativo</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateTypeOpen(false)} data-testid="button-cancel-create-type">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateType} disabled={createTypeMutation.isPending} data-testid="button-confirm-create-type">
                      {createTypeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Criar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="pt-6">
                {typesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {types?.map((type) => (
                        <TableRow key={type.id} data-testid={`row-type-${type.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                              {type.sortOrder}
                            </div>
                          </TableCell>
                          <TableCell>{type.label}</TableCell>
                          <TableCell>
                            <Badge variant={type.isActive ? "default" : "secondary"}>
                              {type.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleTypeActive(type)}
                                data-testid={`button-toggle-type-${type.id}`}
                              >
                                <Switch checked={type.isActive} className="pointer-events-none" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditType(type)}
                                data-testid={`button-edit-type-${type.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteType(type)}
                                data-testid={`button-delete-type-${type.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Edit Type Dialog */}
            <Dialog open={isEditTypeOpen} onOpenChange={setIsEditTypeOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Tipo</DialogTitle>
                  <DialogDescription>
                    Altere as informações do requerimento
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-label">Nome do Tipo</Label>
                    <Input
                      id="edit-label"
                      value={typeFormData.label}
                      onChange={(e) => setTypeFormData({ ...typeFormData, label: e.target.value })}
                      data-testid="input-edit-type-label"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sortOrder">Ordem de Exibição</Label>
                    <Input
                      id="edit-sortOrder"
                      type="number"
                      value={typeFormData.sortOrder}
                      onChange={(e) => setTypeFormData({ ...typeFormData, sortOrder: e.target.value })}
                      data-testid="input-edit-type-order"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="edit-isActive"
                      checked={typeFormData.isActive}
                      onCheckedChange={(checked) => setTypeFormData({ ...typeFormData, isActive: checked })}
                      data-testid="switch-edit-type-active"
                    />
                    <Label htmlFor="edit-isActive">Ativo</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditTypeOpen(false)} data-testid="button-cancel-edit-type">
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateType} disabled={updateTypeMutation.isPending} data-testid="button-confirm-edit-type">
                    {updateTypeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Type Dialog */}
            <Dialog open={isDeleteTypeOpen} onOpenChange={setIsDeleteTypeOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar Exclusão</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja remover o tipo "{selectedType?.label}"? Esta ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteTypeOpen(false)} data-testid="button-cancel-delete-type">
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={confirmDeleteType} disabled={deleteTypeMutation.isPending} data-testid="button-confirm-delete-type">
                    {deleteTypeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Remover
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {/* ============ USERS TAB ============ */}
        {isAdmin && (
          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Gerenciar Usuários</h2>
                <p className="text-sm text-muted-foreground">
                  Visualize e gerencie os usuários do sistema
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6">
                {usersLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Papel</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user) => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeClass(user.role)}>
                              {getRoleLabel(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Ativo" : "Bloqueado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => resetPasswordMutation.mutate(user.id)}
                                disabled={resetPasswordMutation.isPending}
                                title="Resetar Senha"
                                data-testid={`button-reset-password-${user.id}`}
                              >
                                <Key className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleUserActive(user)}
                                disabled={user.id === currentUser?.id}
                                title={user.isActive ? "Bloquear" : "Desbloquear"}
                                data-testid={`button-toggle-user-${user.id}`}
                              >
                                {user.isActive ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditUser(user)}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(user)}
                                disabled={user.id === currentUser?.id}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Edit User Dialog */}
            <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Usuário</DialogTitle>
                  <DialogDescription>
                    Altere as informações do usuário "{selectedUser?.username}"
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-name">Nome</Label>
                    <Input
                      id="edit-user-name"
                      value={userFormData.name}
                      onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                      data-testid="input-edit-user-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-email">Email</Label>
                    <Input
                      id="edit-user-email"
                      type="email"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                      data-testid="input-edit-user-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-user-role">Papel</Label>
                    <Select
                      value={userFormData.role}
                      onValueChange={(value: "autoescola" | "operador" | "admin") => setUserFormData({ ...userFormData, role: value })}
                    >
                      <SelectTrigger data-testid="select-edit-user-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="autoescola">Autoescola</SelectItem>
                        <SelectItem value="operador">Operador</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditUserOpen(false)} data-testid="button-cancel-edit-user">
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateUser} disabled={updateUserMutation.isPending} data-testid="button-confirm-edit-user">
                    {updateUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete User Dialog */}
            <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar Exclusão</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja excluir o usuário "{selectedUser?.username}"? Esta ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteUserOpen(false)} data-testid="button-cancel-delete-user">
                    Cancelar
                  </Button>
                  <Button variant="destructive" onClick={confirmDeleteUser} disabled={deleteUserMutation.isPending} data-testid="button-confirm-delete-user">
                    {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Excluir
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
