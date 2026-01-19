import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, X, FileIcon, Save, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import type { SolicitationWithDetails } from "@shared/schema";

// Reusing helper functions from new.tsx
function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toUpperWithoutAccents(str: string): string {
  return removeAccents(str).toUpperCase();
}

function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const TIPO_LOGRADOURO_OPTIONS = [
  "RUA", "AVENIDA", "ALAMEDA", "TRAVESSA", "PRACA", "RODOVIA", "ESTRADA", "LARGO", "VIA", "OUTRO"
];

// Simplified schema for editing (making fields optional if not being edited)
const editSolicitationSchema = z.object({
  cpf: z.string().min(11).transform(toUpperWithoutAccents),
  nomeCompleto: z.string().min(2).transform(toUpperWithoutAccents),
  nomeMae: z.string().min(2).transform(toUpperWithoutAccents),
  nomePai: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  nacionalidade: z.string().min(2).transform(toUpperWithoutAccents),
  rg: z.string().min(5).transform(toUpperWithoutAccents),
  orgaoEmissor: z.string().min(2).transform(toUpperWithoutAccents),
  ufEmissor: z.string().min(2),
  dataNascimento: z.string().min(8),
  cidadeNascimento: z.string().min(2).transform(toUpperWithoutAccents),
  ufNascimento: z.string().min(2),
  cep: z.string().min(8).transform(toUpperWithoutAccents),
  tipoLogradouro: z.string().min(2).transform(toUpperWithoutAccents),
  logradouro: z.string().min(2).transform(toUpperWithoutAccents),
  numero: z.string().min(1).transform(toUpperWithoutAccents),
  complemento: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  bairro: z.string().min(2).transform(toUpperWithoutAccents),
  cidade: z.string().min(2).transform(toUpperWithoutAccents),
  uf: z.string().min(2),
  telefone1: z.string().min(10).transform(toUpperWithoutAccents),
  telefone2: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  email: z.string().email(),
});

type EditFormData = z.infer<typeof editSolicitationSchema>;

interface FileUpload {
  name: string;
  data: string;
  type: string;
}

export default function SolicitationEditPage() {
  const [, params] = useRoute("/solicitations/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newFiles, setNewFiles] = useState<FileUpload[]>([]);

  const { data: solicitation, isLoading: isLoadingSolicitation } = useQuery<SolicitationWithDetails>({
    queryKey: ["/api/solicitations", params?.id],
    enabled: !!params?.id,
  });

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSolicitationSchema),
  });

  useEffect(() => {
    if (solicitation) {
      form.reset({
        cpf: solicitation.conductor.cpf,
        nomeCompleto: solicitation.conductor.nomeCompleto,
        nomeMae: solicitation.conductor.nomeMae,
        nomePai: solicitation.conductor.nomePai || "",
        nacionalidade: solicitation.conductor.nacionalidade,
        rg: solicitation.conductor.rg,
        orgaoEmissor: solicitation.conductor.orgaoEmissor,
        ufEmissor: solicitation.conductor.ufEmissor,
        dataNascimento: solicitation.conductor.dataNascimento,
        cidadeNascimento: solicitation.conductor.cidadeNascimento,
        ufNascimento: solicitation.conductor.ufNascimento,
        cep: solicitation.conductor.cep,
        tipoLogradouro: solicitation.conductor.tipoLogradouro,
        logradouro: solicitation.conductor.logradouro,
        numero: solicitation.conductor.numero,
        complemento: solicitation.conductor.complemento || "",
        bairro: solicitation.conductor.bairro,
        cidade: solicitation.conductor.cidade,
        uf: solicitation.conductor.uf,
        telefone1: solicitation.conductor.telefone1,
        telefone2: solicitation.conductor.telefone2 || "",
        email: solicitation.conductor.email,
      });
    }
  }, [solicitation, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: EditFormData & { documents: FileUpload[] }) => {
      return apiRequest("PATCH", `/api/solicitations/${params?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations", params?.id] });
      toast({ title: "Solicitação atualizada!", description: "As correções foram enviadas." });
      setLocation(`/solicitations/${params?.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  if (isLoadingSolicitation) {
    return <div className="p-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!solicitation || !solicitation.accessGranted) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p>Você não tem permissão para editar esta solicitação no momento.</p>
        <Link href={`/solicitations/${params?.id}`}><Button className="mt-4">Voltar</Button></Link>
      </div>
    );
  }

  const requestedFields = solicitation.accessRequestedFields || [];
  const requestedDocs = solicitation.accessRequestedDocuments || [];

  const isFieldEnabled = (fieldId: string) => requestedFields.includes(fieldId) || requestedFields.includes('endereco') || requestedFields.includes('contato');

  const onSubmit = (data: EditFormData) => {
    updateMutation.mutate({ ...data, documents: newFiles });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setNewFiles((prev) => [...prev, { name: file.name, data: reader.result as string, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/solicitations/${params?.id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Realizar Correções</h1>
          <p className="text-muted-foreground">Apenas os campos liberados pelo DETRAN podem ser editados.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Dados do Condutor</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField control={form.control} name="nomeCompleto" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('nomeCompleto')} className="uppercase" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cpf" render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('cpf')} className="uppercase" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rg" render={({ field }) => (
                <FormItem>
                  <FormLabel>RG</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('rg')} className="uppercase" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="orgaoEmissor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Órgão Emissor</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('rg')} className="uppercase" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ufEmissor" render={({ field }) => (
                <FormItem>
                  <FormLabel>UF Emissor</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isFieldEnabled('rg')}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UF_OPTIONS.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {/* Add more fields as needed following the same pattern */}
            </CardContent>
          </Card>

          {requestedDocs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Novos Anexos</CardTitle>
                <CardDescription>Envie os documentos solicitados: {requestedDocs.join(", ")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                  <input type="file" multiple className="hidden" id="file-upload" onChange={handleFileChange} />
                  <label htmlFor="file-upload" className="mt-2 block text-sm font-medium text-primary cursor-pointer hover:underline">Clique para fazer upload</label>
                </div>
                <div className="mt-4 space-y-2">
                  {newFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2"><FileIcon className="w-4 h-4" /><span className="text-sm">{file.name}</span></div>
                      <Button variant="ghost" size="icon" onClick={() => setNewFiles(newFiles.filter((_, idx) => idx !== i))}><X className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-4">
            <Link href={`/solicitations/${params?.id}`}><Button variant="outline">Cancelar</Button></Link>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Enviar Correções
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
