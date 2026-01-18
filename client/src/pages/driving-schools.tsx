import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building2, Search, Ban, CheckCircle, MapPin, Phone, Mail } from "lucide-react";
import type { DrivingSchool } from "@shared/schema";

export default function DrivingSchoolsPage() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schools, isLoading } = useQuery<DrivingSchool[]>({
    queryKey: ["/api/driving-schools"],
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/driving-schools/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/driving-schools"] });
      toast({ title: "Status atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const filteredSchools = schools?.filter((s) =>
    s.nomeFantasia.toLowerCase().includes(search.toLowerCase()) ||
    s.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
    s.cnpj.includes(search)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Autoescolas</h1>
        <p className="text-muted-foreground">
          Gerencie as autoescolas cadastradas no sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Autoescola</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, razão social ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-schools"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Autoescolas</CardTitle>
          <CardDescription>
            {filteredSchools?.length || 0} autoescolas cadastradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSchools && filteredSchools.length > 0 ? (
            <div className="space-y-4">
              {filteredSchools.map((school) => (
                <div
                  key={school.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                  data-testid={`school-row-${school.id}`}
                >
                  <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{school.nomeFantasia}</p>
                      <Badge variant={school.isActive ? "default" : "secondary"}>
                        {school.isActive ? "Ativa" : "Bloqueada"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{school.razaoSocial}</p>
                    <p className="text-sm text-muted-foreground">CNPJ: {school.cnpj}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {school.cidade}/{school.uf}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {school.telefone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {school.email}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant={school.isActive ? "outline" : "default"}
                          size="sm"
                          data-testid={`button-toggle-${school.id}`}
                        >
                          {school.isActive ? (
                            <>
                              <Ban className="w-4 h-4 mr-2" />
                              Bloquear
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Desbloquear
                            </>
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {school.isActive ? "Bloquear Autoescola" : "Desbloquear Autoescola"}
                          </DialogTitle>
                          <DialogDescription>
                            {school.isActive
                              ? `Tem certeza que deseja bloquear a autoescola "${school.nomeFantasia}"? Ela não poderá criar novas solicitações.`
                              : `Tem certeza que deseja desbloquear a autoescola "${school.nomeFantasia}"?`}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant={school.isActive ? "destructive" : "default"}
                            onClick={() => toggleStatusMutation.mutate({ id: school.id, isActive: !school.isActive })}
                            disabled={toggleStatusMutation.isPending}
                          >
                            {school.isActive ? "Bloquear" : "Desbloquear"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/30" />
              <p className="mt-4 text-lg font-medium">Nenhuma autoescola encontrada</p>
              <p className="text-muted-foreground mt-1">
                {search ? "Tente ajustar a busca" : "Aguarde cadastros de autoescolas"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
