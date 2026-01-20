import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Pencil, Trash2, FileText, GripVertical, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { SolicitationType } from "@shared/schema";

export default function SolicitationTypesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SolicitationType | null>(null);
  const [formData, setFormData] = useState({ label: "", sortOrder: "0", isActive: true });

  const { data: types, isLoading } = useQuery<SolicitationType[]>({
    queryKey: ["/api/solicitation-types"],
  });

  const generateValue = (label: string): string => {
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  };

  const createMutation = useMutation({
    mutationFn: async (data: { label: string; sortOrder: string; isActive: boolean }) => {
      const value = generateValue(data.label);
      return apiRequest("POST", "/api/solicitation-types", { ...data, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitation-types"] });
      toast({ title: "Tipo criado com sucesso" });
      setIsCreateOpen(false);
      setFormData({ label: "", sortOrder: "0", isActive: true });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar tipo", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SolicitationType> }) => {
      return apiRequest("PATCH", `/api/solicitation-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitation-types"] });
      toast({ title: "Tipo atualizado com sucesso" });
      setIsEditOpen(false);
      setSelectedType(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar tipo", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/solicitation-types/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitation-types"] });
      toast({ title: "Tipo removido com sucesso" });
      setIsDeleteOpen(false);
      setSelectedType(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao remover tipo", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!formData.label) {
      toast({ title: "Preencha o nome do tipo", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (type: SolicitationType) => {
    setSelectedType(type);
    setFormData({
      label: type.label,
      sortOrder: type.sortOrder,
      isActive: type.isActive,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedType) return;
    updateMutation.mutate({
      id: selectedType.id,
      data: formData,
    });
  };

  const handleDelete = (type: SolicitationType) => {
    setSelectedType(type);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedType) return;
    deleteMutation.mutate(selectedType.id);
  };

  const handleToggleActive = (type: SolicitationType) => {
    updateMutation.mutate({
      id: type.id,
      data: { isActive: !type.isActive },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tipos de Solicitação</h1>
          <p className="text-muted-foreground">
            Gerencie os tipos de solicitação disponíveis no sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                Adicione um novo tipo de solicitação ao sistema
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="label">Nome do Tipo</Label>
                <Input
                  id="label"
                  placeholder="ex: Primeira Habilitação"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  data-testid="input-type-label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Ordem de Exibição</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  placeholder="0"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  data-testid="input-type-order"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-type-active"
                />
                <Label htmlFor="isActive">Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-create">
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-confirm-create">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Tipos Cadastrados
          </CardTitle>
          <CardDescription>
            Lista de todos os tipos de solicitação disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                        onClick={() => handleToggleActive(type)}
                        data-testid={`button-toggle-${type.id}`}
                      >
                        <Switch checked={type.isActive} className="pointer-events-none" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(type)}
                        data-testid={`button-edit-${type.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(type)}
                        data-testid={`button-delete-${type.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tipo</DialogTitle>
            <DialogDescription>
              Altere as informações do tipo de solicitação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-label">Nome do Tipo</Label>
              <Input
                id="edit-label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                data-testid="input-edit-type-label"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sortOrder">Ordem de Exibição</Label>
              <Input
                id="edit-sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                data-testid="input-edit-type-order"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-edit-type-active"
              />
              <Label htmlFor="edit-isActive">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} data-testid="button-cancel-edit">
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-confirm-edit">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o tipo "{selectedType?.label}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} data-testid="button-cancel-delete">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
