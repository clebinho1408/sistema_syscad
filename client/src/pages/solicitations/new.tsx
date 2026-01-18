import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, X, FileIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const TIPO_LOGRADOURO_OPTIONS = [
  "Rua", "Avenida", "Alameda", "Travessa", "Praça", "Rodovia", "Estrada", "Largo", "Via", "Outro"
];

const solicitationSchema = z.object({
  type: z.enum(["novo_cadastro", "alteracao_dados", "atualizacao", "regularizacao"]),
  cpf: z.string().min(11, "CPF inválido"),
  nomeCompleto: z.string().min(2, "Nome é obrigatório"),
  nomeMae: z.string().min(2, "Nome da mãe é obrigatório"),
  nomePai: z.string().optional(),
  nacionalidade: z.string().min(2, "Nacionalidade é obrigatória"),
  rg: z.string().min(5, "RG é obrigatório"),
  orgaoEmissor: z.string().min(2, "Órgão emissor é obrigatório"),
  ufEmissor: z.string().min(2, "UF é obrigatória"),
  dataNascimento: z.string().min(8, "Data de nascimento é obrigatória"),
  cidadeNascimento: z.string().min(2, "Cidade é obrigatória"),
  ufNascimento: z.string().min(2, "UF é obrigatória"),
  cep: z.string().min(8, "CEP é obrigatório"),
  tipoLogradouro: z.string().min(2, "Tipo de logradouro é obrigatório"),
  logradouro: z.string().min(2, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional(),
  bairro: z.string().min(2, "Bairro é obrigatório"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  uf: z.string().min(2, "UF é obrigatória"),
  telefone1: z.string().min(10, "Telefone é obrigatório"),
  telefone2: z.string().optional(),
  email: z.string().email("E-mail inválido"),
});

type SolicitationFormData = z.infer<typeof solicitationSchema>;

interface FileUpload {
  name: string;
  data: string;
  type: string;
}

export default function NewSolicitationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileUpload[]>([]);

  const form = useForm<SolicitationFormData>({
    resolver: zodResolver(solicitationSchema),
    defaultValues: {
      type: "novo_cadastro",
      cpf: "",
      nomeCompleto: "",
      nomeMae: "",
      nomePai: "",
      nacionalidade: "Brasileira",
      rg: "",
      orgaoEmissor: "",
      ufEmissor: "",
      dataNascimento: "",
      cidadeNascimento: "",
      ufNascimento: "",
      cep: "",
      tipoLogradouro: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      telefone1: "",
      telefone2: "",
      email: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SolicitationFormData & { documents: FileUpload[] }) => {
      return apiRequest("POST", "/api/solicitations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/solicitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Solicitação criada!",
        description: "Sua solicitação foi enviada com sucesso.",
      });
      setLocation("/solicitations");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar solicitação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    Array.from(selectedFiles).forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o limite de 5MB`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setFiles((prev) => [
          ...prev,
          {
            name: file.name,
            data: reader.result as string,
            type: file.type,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = (data: SolicitationFormData) => {
    if (files.length === 0) {
      toast({
        title: "Documentos obrigatórios",
        description: "Anexe pelo menos um documento para continuar.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate({ ...data, documents: files });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/solicitations">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nova Solicitação</h1>
          <p className="text-muted-foreground">
            Preencha os dados do candidato/condutor
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Solicitação</CardTitle>
              <CardDescription>Selecione o tipo de solicitação que deseja criar</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full md:w-80" data-testid="select-type">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="novo_cadastro">Novo Cadastro de Candidato/Condutor</SelectItem>
                        <SelectItem value="alteracao_dados">Alteração de Dados Cadastrais</SelectItem>
                        <SelectItem value="atualizacao">Atualização Cadastral</SelectItem>
                        <SelectItem value="regularizacao">Regularização</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
              <CardDescription>Informações pessoais do candidato/condutor</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} data-testid="input-cpf" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomeCompleto"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo do candidato" {...field} data-testid="input-nome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomeMae"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome da Mãe *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo da mãe" {...field} data-testid="input-mae" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomePai"
                render={({ field }) => (
                  <FormItem className="md:col-span-1">
                    <FormLabel>Nome do Pai</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo do pai" {...field} data-testid="input-pai" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nacionalidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nacionalidade *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nacionalidade" {...field} data-testid="input-nacionalidade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dataNascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-nascimento" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cidadeNascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade de Nascimento *</FormLabel>
                    <FormControl>
                      <Input placeholder="Cidade" {...field} data-testid="input-cidade-nasc" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ufNascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF Nascimento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-uf-nasc">
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
                )}
              />
              <FormField
                control={form.control}
                name="rg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RG *</FormLabel>
                    <FormControl>
                      <Input placeholder="Número do RG" {...field} data-testid="input-rg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orgaoEmissor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Órgão Emissor *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: SSP" {...field} data-testid="input-orgao" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ufEmissor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF Emissor *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-uf-emissor">
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
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
              <CardDescription>Endereço residencial do candidato/condutor</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP *</FormLabel>
                    <FormControl>
                      <Input placeholder="00000-000" {...field} data-testid="input-cep" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipoLogradouro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Logradouro *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                )}
              />
              <FormField
                control={form.control}
                name="logradouro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logradouro *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da rua" {...field} data-testid="input-logradouro" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nº" {...field} data-testid="input-numero" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="complemento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input placeholder="Apto, Bloco, etc." {...field} data-testid="input-complemento" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bairro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro *</FormLabel>
                    <FormControl>
                      <Input placeholder="Bairro" {...field} data-testid="input-bairro" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Cidade *</FormLabel>
                    <FormControl>
                      <Input placeholder="Cidade" {...field} data-testid="input-cidade" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
              <CardDescription>Informações de contato do candidato/condutor</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="telefone1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone 1 *</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} data-testid="input-telefone1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefone2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone 2</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} data-testid="input-telefone2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>Anexe os documentos obrigatórios (PDF, JPG, PNG - máx. 5MB cada)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Arraste arquivos ou clique para selecionar
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ position: "relative" }}
                  data-testid="input-files"
                />
                <Button type="button" variant="outline" className="mt-4" onClick={() => document.querySelector<HTMLInputElement>('[data-testid="input-files"]')?.click()}>
                  Selecionar Arquivos
                </Button>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Arquivos selecionados:</p>
                  <div className="grid gap-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                      >
                        <FileIcon className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="flex-1 text-sm truncate">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                          data-testid={`button-remove-file-${index}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Link href="/solicitations" className="flex-1">
              <Button type="button" variant="outline" className="w-full" data-testid="button-cancel">
                Cancelar
              </Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending} data-testid="button-submit">
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Solicitação
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
