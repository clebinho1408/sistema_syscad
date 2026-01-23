import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, X, FileIcon, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BRAZILIAN_CITIES, COUNTRIES } from "@/lib/location-data";
import type { SolicitationWithDetails } from "@shared/schema";

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toUpperWithoutAccents(str: string): string {
  return removeAccents(str).toUpperCase();
}

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const UF_NASCIMENTO_OPTIONS = [
  "ESTRANGEIRO",
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const TIPO_LOGRADOURO_OPTIONS = [
  "RUA", "AVENIDA", "ALAMEDA", "TRAVESSA", "PRACA", "RODOVIA", "ESTRADA", "LARGO", "VIA", "OUTRO"
];

const SEXO_OPTIONS = ["MASCULINO", "FEMININO", "OUTROS"];

const TIPO_DOCUMENTO_OPTIONS = [
  "CARTEIRA DE IDENTIDADE",
  "CARTEIRA DE TRABALHO",
  "CARTEIRA DE RESERVISTA",
  "PASSAPORTE",
];

const NACIONALIDADE_OPTIONS = [
  "BRASILEIRO",
  "BRASILEIRO NASCIDO NO EXTERIOR",
  "BRASILEIRO NATURALIZADO",
  "ESTRANGEIRO"
];

const editSolicitationSchema = z.object({
  cpf: z.string().min(11).transform(toUpperWithoutAccents),
  nomeCompleto: z.string().min(2).transform(toUpperWithoutAccents),
  nomeSocial: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  nomeMae: z.string().min(2).transform(toUpperWithoutAccents),
  nomePai: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  filiacaoAfetiva1: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  filiacaoAfetiva2: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  sexo: z.string().optional(),
  nacionalidade: z.string().min(2),
  tipoDocumento: z.string().optional(),
  rg: z.string().min(1).transform(toUpperWithoutAccents),
  orgaoEmissor: z.string().min(2).transform(toUpperWithoutAccents),
  ufEmissor: z.string().min(2),
  dataNascimento: z.string().min(8),
  ufNascimento: z.string().min(2),
  cidadeNascimento: z.string().min(2).transform(toUpperWithoutAccents),
  cep: z.string().min(8).transform(toUpperWithoutAccents),
  tipoLogradouro: z.string().min(2).transform(toUpperWithoutAccents),
  logradouro: z.string().min(2).transform(toUpperWithoutAccents),
  numero: z.string().min(1).transform(toUpperWithoutAccents),
  complemento: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  bairro: z.string().min(2).transform(toUpperWithoutAccents),
  cidade: z.string().min(2).transform(toUpperWithoutAccents),
  uf: z.string().min(2),
  telefone1: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  dddCelular: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  telefone2: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  email: z.string().optional(),
});

type EditFormData = z.infer<typeof editSolicitationSchema>;

interface FileUpload {
  name: string;
  data: string;
  type: string;
  category: string;
}

const DOCUMENT_CATEGORIES = [
  { id: "renach_assinado", label: "Renach Assinado" },
  { id: "documento_identificacao", label: "Documento de Identificação" },
  { id: "comprovante_residencia", label: "Comprovante de Residência" },
  { id: "outros", label: "Outros Documentos/Declarações" },
];

export default function SolicitationEditPage() {
  const [, params] = useRoute("/solicitations/:id/edit");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newFiles, setNewFiles] = useState<Record<string, FileUpload | null>>({
    renach_assinado: null,
    documento_identificacao: null,
    comprovante_residencia: null,
    outros: null,
  });
  const [customCidade, setCustomCidade] = useState<string>("");
  const [customCidadeNascimento, setCustomCidadeNascimento] = useState<string>("");

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
        nomeSocial: solicitation.conductor.nomeSocial || "",
        nomeMae: solicitation.conductor.nomeMae,
        nomePai: solicitation.conductor.nomePai || "",
        filiacaoAfetiva1: solicitation.conductor.filiacaoAfetiva1 || "",
        filiacaoAfetiva2: solicitation.conductor.filiacaoAfetiva2 || "",
        sexo: solicitation.conductor.sexo || "",
        nacionalidade: solicitation.conductor.nacionalidade,
        tipoDocumento: solicitation.conductor.tipoDocumento || "",
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
        telefone1: solicitation.conductor.telefone1 || "",
        dddCelular: solicitation.conductor.dddCelular || "",
        telefone2: solicitation.conductor.telefone2 || "",
        email: solicitation.conductor.email || "",
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

  const isFieldEnabled = (fieldId: string) => {
    if (requestedFields.includes(fieldId)) return true;
    if (fieldId === 'cep' || fieldId === 'tipoLogradouro' || fieldId === 'logradouro' || 
        fieldId === 'numero' || fieldId === 'complemento' || fieldId === 'bairro' || 
        fieldId === 'cidade' || fieldId === 'uf') {
      return requestedFields.includes('endereco');
    }
    if (fieldId === 'orgaoEmissor' || fieldId === 'ufEmissor') {
      return requestedFields.includes('rg');
    }
    return false;
  };

  const onSubmit = (data: EditFormData) => {
    const documentsArray = Object.values(newFiles).filter((f): f is FileUpload => f !== null);
    updateMutation.mutate({ ...data, documents: documentsArray });
  };

  const handleFileChange = (category: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isPDF = selectedFile.type === 'application/pdf';
    const maxSize = isPDF ? 3 * 1024 * 1024 : 1 * 1024 * 1024;
    const maxSizeLabel = isPDF ? '3MB' : '1MB';
    
    if (selectedFile.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: `${selectedFile.name} excede o limite de ${maxSizeLabel}`,
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNewFiles((prev) => ({
        ...prev,
        [category]: {
          name: selectedFile.name,
          data: reader.result as string,
          type: selectedFile.type,
          category,
        },
      }));
    };
    reader.readAsDataURL(selectedFile);
    e.target.value = "";
  };

  const removeFile = (category: string) => {
    setNewFiles((prev) => ({ ...prev, [category]: null }));
  };

  const getDocCategoryLabel = (categoryId: string) => {
    return DOCUMENT_CATEGORIES.find(c => c.id === categoryId)?.label || categoryId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/solicitations/${params?.id}`}>
          <Button variant="ghost" size="icon" data-testid="button-back"><ArrowLeft className="w-5 h-5" /></Button>
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
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="cpf" render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl><Input {...field} disabled className="uppercase" data-testid="input-cpf" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nomeCompleto" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Nome Civil</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('nomeCompleto')} className="uppercase" data-testid="input-nome" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nomeSocial" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Nome Social</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('nomeSocial')} className="uppercase" data-testid="input-nome-social" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nomeMae" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Nome da Mãe</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('nomeMae')} className="uppercase" data-testid="input-mae" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nomePai" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Nome do Pai</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('nomePai')} className="uppercase" data-testid="input-pai" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacaoAfetiva1" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Filiação Afetiva 1</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('filiacaoAfetiva1')} className="uppercase" data-testid="input-filiacao1" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="filiacaoAfetiva2" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Filiação Afetiva 2</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('filiacaoAfetiva2')} className="uppercase" data-testid="input-filiacao2" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sexo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sexo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isFieldEnabled('sexo')}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sexo">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEXO_OPTIONS.map((sexo) => (
                        <SelectItem key={sexo} value={sexo}>{sexo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="nacionalidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nacionalidade</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isFieldEnabled('nacionalidade')}>
                    <FormControl>
                      <SelectTrigger data-testid="select-nacionalidade">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NACIONALIDADE_OPTIONS.map((nac) => (
                        <SelectItem key={nac} value={nac}>{nac}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tipoDocumento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Documento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isFieldEnabled('tipoDocumento')}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tipo-documento">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIPO_DOCUMENTO_OPTIONS.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="rg" render={({ field }) => (
                <FormItem>
                  <FormLabel>Identidade</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('rg')} className="uppercase" data-testid="input-rg" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="orgaoEmissor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Órgão Emissor</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('orgaoEmissor')} className="uppercase" data-testid="input-orgao" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ufEmissor" render={({ field }) => (
                <FormItem>
                  <FormLabel>UF Emissor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isFieldEnabled('ufEmissor')}>
                    <FormControl>
                      <SelectTrigger data-testid="select-uf-emissor">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UF_OPTIONS.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dataNascimento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Nascimento</FormLabel>
                  <FormControl><Input type="date" {...field} disabled={!isFieldEnabled('dataNascimento')} data-testid="input-nascimento" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ufNascimento" render={({ field }) => (
                <FormItem>
                  <FormLabel>UF Nascimento</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("cidadeNascimento", "");
                      setCustomCidadeNascimento("");
                    }} 
                    value={field.value} 
                    disabled={!isFieldEnabled('ufNascimento')}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-uf-nasc">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UF_NASCIMENTO_OPTIONS.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cidadeNascimento" render={({ field }) => {
                const ufNascimento = form.watch("ufNascimento");
                const isEstrangeiro = ufNascimento === "ESTRANGEIRO";
                const baseOptions = isEstrangeiro ? COUNTRIES : (BRAZILIAN_CITIES[ufNascimento] || []);
                const options = customCidadeNascimento && !baseOptions.includes(customCidadeNascimento)
                  ? [customCidadeNascimento, ...baseOptions]
                  : baseOptions;
                return (
                  <FormItem>
                    <FormLabel>Local Nascimento</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        options={options}
                        placeholder={isEstrangeiro ? "Selecione o país" : "Selecione a cidade"}
                        searchPlaceholder={isEstrangeiro ? "Buscar país..." : "Buscar cidade..."}
                        emptyMessage={isEstrangeiro ? "País não encontrado." : "Cidade não encontrada."}
                        disabled={!isFieldEnabled('cidadeNascimento') || !ufNascimento}
                        allowCustom={false}
                        data-testid="select-cidade-nasc"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
              <CardDescription>Endereço residencial do candidato/condutor</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="cep" render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('cep')} className="uppercase" data-testid="input-cep" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tipoLogradouro" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Logradouro</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isFieldEnabled('tipoLogradouro')}>
                    <FormControl>
                      <SelectTrigger data-testid="select-tipo-logradouro">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIPO_LOGRADOURO_OPTIONS.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="logradouro" render={({ field }) => (
                <FormItem>
                  <FormLabel>Logradouro</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('logradouro')} className="uppercase" data-testid="input-logradouro" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="numero" render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('numero')} className="uppercase" data-testid="input-numero" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="complemento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Complemento</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('complemento')} className="uppercase" data-testid="input-complemento" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bairro" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bairro</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('bairro')} className="uppercase" data-testid="input-bairro" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="uf" render={({ field }) => (
                <FormItem>
                  <FormLabel>UF</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("cidade", "");
                      setCustomCidade("");
                    }} 
                    value={field.value} 
                    disabled={!isFieldEnabled('uf')}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-uf">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UF_OPTIONS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cidade" render={({ field }) => {
                const uf = form.watch("uf");
                const baseOptions = BRAZILIAN_CITIES[uf] || [];
                const options = customCidade && !baseOptions.includes(customCidade)
                  ? [customCidade, ...baseOptions]
                  : baseOptions;
                return (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        options={options}
                        placeholder="Selecione a cidade"
                        searchPlaceholder="Buscar cidade..."
                        emptyMessage="Cidade não encontrada."
                        disabled={!isFieldEnabled('cidade') || !uf}
                        allowCustom={false}
                        data-testid="select-cidade"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
              <CardDescription>Informações de contato do candidato/condutor</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField control={form.control} name="telefone1" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone 1</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('telefone1')} className="uppercase" data-testid="input-telefone1" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dddCelular" render={({ field }) => (
                <FormItem>
                  <FormLabel>DDD Celular</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('dddCelular')} className="uppercase" data-testid="input-ddd" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="telefone2" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone Celular</FormLabel>
                  <FormControl><Input {...field} disabled={!isFieldEnabled('telefone2')} className="uppercase" data-testid="input-telefone2" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><Input type="email" {...field} disabled={!isFieldEnabled('email')} data-testid="input-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {requestedDocs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Novos Anexos</CardTitle>
                <CardDescription>Envie os documentos solicitados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {requestedDocs.map((docCategory) => {
                  const file = newFiles[docCategory];
                  return (
                    <div key={docCategory} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">{getDocCategoryLabel(docCategory)}</h4>
                      {file ? (
                        <div className="flex items-center justify-between p-2 border rounded bg-muted/30">
                          <div className="flex items-center gap-2">
                            <FileIcon className="w-4 h-4" />
                            <span className="text-sm">{file.name}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeFile(docCategory)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-4 text-center">
                          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                          <input
                            type="file"
                            className="hidden"
                            id={`file-upload-${docCategory}`}
                            onChange={handleFileChange(docCategory)}
                            accept=".pdf,.jpg,.jpeg,.png"
                          />
                          <label
                            htmlFor={`file-upload-${docCategory}`}
                            className="mt-2 block text-sm font-medium text-primary cursor-pointer hover:underline"
                          >
                            Clique para fazer upload
                          </label>
                          <p className="text-xs text-muted-foreground mt-1">PDF (máx. 3MB), JPG ou PNG (máx. 1MB)</p>
                        </div>
                      )}
                    </div>
                  );
                })}
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
