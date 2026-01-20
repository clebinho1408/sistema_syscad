import type { ChangeEvent, InputHTMLAttributes } from "react";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, X, FileIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { BRAZILIAN_CITIES, COUNTRIES } from "@/lib/location-data";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface UppercaseInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  value?: string;
}

function UppercaseInput({ onChange, value, ...props }: UppercaseInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const transformed = toUpperWithoutAccents(e.target.value);
    e.target.value = transformed;
    if (onChange) {
      onChange(e);
    }
  };
  return <Input {...props} value={value} onChange={handleChange} className="uppercase" />;
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

const SEXO_OPTIONS = ["MASCULINO", "FEMININO"];
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

const IDENTIDADE_OPTIONS = [
  "CARTEIRA DE IDENTIDADE",
  "CARTEIRA DE TRABALHO",
  "CARTEIRA DE RESERVISTA",
  "PASSAPORTE"
];

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

const solicitationSchema = z.object({
  type: z.enum(["novo_cadastro", "alteracao_dados", "atualizacao", "regularizacao"]),
  cpf: z.string().min(14, "CPF inválido").refine((val) => validateCpf(val), "CPF inválido"),
  nomeCompleto: z.string().min(2, "Nome é obrigatório").transform(toUpperWithoutAccents),
  nomeSocial: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  nomeMae: z.string().min(2, "Nome da mãe é obrigatório").transform(toUpperWithoutAccents),
  nomePai: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  filiacaoAfetiva1: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  filiacaoAfetiva2: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  sexo: z.string().min(1, "Sexo é obrigatório"),
  nacionalidade: z.string().min(2, "Nacionalidade é obrigatória"),
  tipoDocumento: z.string().min(1, "Tipo de documento é obrigatório"),
  rg: z.string().min(1, "Identidade é obrigatória"),
  orgaoEmissor: z.string().min(2, "Órgão emissor é obrigatório").transform(toUpperWithoutAccents),
  ufEmissor: z.string().min(2, "UF é obrigatória"),
  dataNascimento: z.string().min(8, "Data nascimento é obrigatória").refine((val) => {
    const date = parseDateLocal(val);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date <= today;
  }, "Data nascimento não pode ser no futuro").refine((val) => {
    const date = parseDateLocal(val);
    return calculateAge(date) >= 18;
  }, "O candidato deve ter pelo menos 18 anos completos"),
  ufNascimento: z.string().min(2, "UF é obrigatória"),
  cidadeNascimento: z.string().min(2, "Local nascimento é obrigatório").transform(toUpperWithoutAccents),
  cep: z.string().min(8, "CEP é obrigatório").transform(toUpperWithoutAccents),
  tipoLogradouro: z.string().min(2, "Tipo de logradouro é obrigatório").transform(toUpperWithoutAccents),
  logradouro: z.string().min(2, "Logradouro é obrigatório").transform(toUpperWithoutAccents),
  numero: z.string().min(1, "Número é obrigatório").transform(toUpperWithoutAccents),
  complemento: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  bairro: z.string().min(2, "Bairro é obrigatório").transform(toUpperWithoutAccents),
  uf: z.string().min(2, "UF é obrigatória"),
  cidade: z.string().min(2, "Cidade é obrigatória").transform(toUpperWithoutAccents),
  telefone1: z.string().optional().transform((val) => val ? toUpperWithoutAccents(val) : val),
  dddCelular: z.string().min(2, "DDD Telefone Celular é obrigatório").transform(toUpperWithoutAccents),
  telefone2: z.string().min(8, "Telefone Celular é obrigatório").transform(toUpperWithoutAccents),
  email: z.string().optional(),
  naoPossuiEmail: z.boolean().optional(),
  naoQuerInformarEmail: z.boolean().optional(),
});

type SolicitationFormData = z.infer<typeof solicitationSchema>;

interface FileUpload {
  name: string;
  data: string;
  type: string;
  category: string;
}

const DOCUMENT_CATEGORIES = [
  { id: "renach_assinado", label: "Renach Assinado", required: true },
  { id: "documento_identificacao", label: "Documento de Identificação", required: true },
  { id: "comprovante_residencia", label: "Comprovante de Residência", required: true },
  { id: "outros", label: "Outros Documentos/Declarações", required: false },
];

export default function NewSolicitationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<Record<string, FileUpload | null>>({
    renach_assinado: null,
    documento_identificacao: null,
    comprovante_residencia: null,
    outros: null,
  });

  const form = useForm<SolicitationFormData>({
    resolver: zodResolver(solicitationSchema),
    defaultValues: {
      type: "novo_cadastro",
      cpf: "",
      nomeCompleto: "",
      nomeSocial: "",
      nomeMae: "",
      nomePai: "",
      filiacaoAfetiva1: "",
      filiacaoAfetiva2: "",
      sexo: "",
      nacionalidade: "",
      tipoDocumento: "",
      rg: "",
      orgaoEmissor: "",
      ufEmissor: "",
      dataNascimento: "",
      ufNascimento: "",
      cidadeNascimento: "",
      cep: "",
      tipoLogradouro: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      uf: "SC",
      cidade: "",
      telefone1: "",
      dddCelular: "",
      telefone2: "",
      email: "",
      naoPossuiEmail: false,
      naoQuerInformarEmail: false,
    },
  });

  const [cpfError, setCpfError] = useState<string | null>(null);
  const [isValidatingCpf, setIsValidatingCpf] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<SolicitationFormData | null>(null);

  const validateCpfOnBlur = async (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, "");
    
    if (cleanCpf.length === 0) {
      setCpfError(null);
      return;
    }
    
    if (!validateCpf(cpf)) {
      setCpfError("CPF inválido");
      return;
    }
    
    setCpfError(null);
    
    if (cleanCpf.length < 11) return;

    setIsValidatingCpf(true);
    try {
      const response = await fetch(`/api/solicitations/check-cpf/${cleanCpf}`);
      const data = await response.json();
      
      if (data.exists && data.differentSchool) {
        setCpfError("Este Candidato/Condutor já está cadastrado em outra Autoescola, favor solicitar via Chat a Administração a transferência dessa Solicitação.");
      }
    } catch {
      console.error("Erro ao validar CPF");
    } finally {
      setIsValidatingCpf(false);
    }
  };

  const validateDateOnBlur = (dateStr: string) => {
    if (!dateStr) {
      setDateError(null);
      return;
    }
    
    const date = parseDateLocal(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date > today) {
      setDateError("Data nascimento não pode ser no futuro");
      return;
    }
    
    if (calculateAge(date) < 18) {
      setDateError("O candidato deve ter pelo menos 18 anos completos");
      return;
    }
    
    setDateError(null);
  };

  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [customCidade, setCustomCidade] = useState<string>("");
  const [customCidadeNascimento, setCustomCidadeNascimento] = useState<string>("");

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        const streetName = data.logradouro ? data.logradouro.replace(/^(RUA|AVENIDA|AV|ALAMEDA|AL|TRAVESSA|TRV|PRACA|PRC|RODOVIA|ROD|ESTRADA|EST|LARGO|LRG|VIA)\s+/i, "") : "";
        const uf = data.uf || "";
        const cidade = toUpperWithoutAccents(data.localidade || "");
        
        form.setValue("logradouro", toUpperWithoutAccents(streetName));
        form.setValue("bairro", toUpperWithoutAccents(data.bairro || ""));
        form.setValue("uf", uf);
        
        const citiesForUf = BRAZILIAN_CITIES[uf] || [];
        if (!citiesForUf.includes(cidade) && cidade) {
          setCustomCidade(cidade);
        }
        form.setValue("cidade", cidade);
      }
    } catch {
      console.error("Erro ao buscar CEP");
    } finally {
      setIsLoadingCep(false);
    }
  };

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

  const handleFileChange = (category: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: `${selectedFile.name} excede o limite de 5MB`,
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFiles((prev) => ({
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
    setFiles((prev) => ({ ...prev, [category]: null }));
  };

  const onSubmit = (data: SolicitationFormData) => {
    const requiredCategories = DOCUMENT_CATEGORIES.filter(c => c.required).map(c => c.id);
    const missingDocs = requiredCategories.filter(cat => !files[cat]);
    
    if (missingDocs.length > 0) {
      const missingNames = missingDocs.map(id => DOCUMENT_CATEGORIES.find(c => c.id === id)?.label).join(", ");
      toast({
        title: "Documentos obrigatórios",
        description: `Anexe os seguintes documentos: ${missingNames}`,
        variant: "destructive",
      });
      return;
    }
    
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = () => {
    if (pendingFormData) {
      const documentsArray = Object.values(files).filter((f): f is FileUpload => f !== null);
      createMutation.mutate({ ...pendingFormData, documents: documentsArray });
    }
    setShowConfirmDialog(false);
    setPendingFormData(null);
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
                      <div className="relative">
                        <Input 
                          placeholder="000.000.000-00" 
                          value={field.value}
                          onChange={(e) => {
                            const formatted = formatCpf(e.target.value);
                            field.onChange(formatted);
                          }}
                          data-testid="input-cpf"
                          onBlur={(e) => {
                            field.onBlur();
                            validateCpfOnBlur(e.target.value);
                          }}
                        />
                        {isValidatingCpf && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </FormControl>
                    {cpfError && <p className="text-sm font-medium text-destructive">{cpfError}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomeCompleto"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome Civil *</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="NOME COMPLETO DO CANDIDATO" {...field} data-testid="input-nome" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomeSocial"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Nome Social</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="NOME SOCIAL (OPCIONAL)" {...field} data-testid="input-nome-social" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomeMae"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Nome da Mãe *</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="NOME COMPLETO DA MAE" {...field} data-testid="input-mae" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomePai"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Nome do Pai</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="NOME COMPLETO DO PAI" {...field} data-testid="input-pai" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="filiacaoAfetiva1"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Filiação Afetiva 1</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="NOME COMPLETO" {...field} data-testid="input-filiacao1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="filiacaoAfetiva2"
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel>Filiação Afetiva 2</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="NOME COMPLETO" {...field} data-testid="input-filiacao2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sexo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                )}
              />
              <FormField
                control={form.control}
                name="nacionalidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nacionalidade *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                )}
              />
              <FormField
                control={form.control}
                name="tipoDocumento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Documento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                )}
              />
              <FormField
                control={form.control}
                name="rg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identidade *</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="NUMERO DA IDENTIDADE" {...field} data-testid="input-rg" />
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
                      <UppercaseInput placeholder="SSP" {...field} data-testid="input-orgao" />
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
              <FormField
                control={form.control}
                name="dataNascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Nascimento *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        data-testid="input-nascimento"
                        onBlur={(e) => {
                          field.onBlur();
                          validateDateOnBlur(e.target.value);
                        }}
                      />
                    </FormControl>
                    {dateError && <p className="text-sm font-medium text-destructive">{dateError}</p>}
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
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("cidadeNascimento", "");
                        setCustomCidadeNascimento("");
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-uf-nasc">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UF_NASCIMENTO_OPTIONS.map((uf) => (
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
                name="cidadeNascimento"
                render={({ field }) => {
                  const ufNascimento = form.watch("ufNascimento");
                  const isEstrangeiro = ufNascimento === "ESTRANGEIRO";
                  const baseOptions = isEstrangeiro ? COUNTRIES : (BRAZILIAN_CITIES[ufNascimento] || []);
                  const options = customCidadeNascimento && !baseOptions.includes(customCidadeNascimento)
                    ? [customCidadeNascimento, ...baseOptions]
                    : baseOptions;
                  return (
                    <FormItem>
                      <FormLabel>Local Nascimento *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          options={options}
                          placeholder={isEstrangeiro ? "Selecione o país" : "Selecione a cidade"}
                          searchPlaceholder={isEstrangeiro ? "Buscar país..." : "Buscar cidade..."}
                          emptyMessage={isEstrangeiro ? "País não encontrado." : "Cidade não encontrada."}
                          disabled={!ufNascimento}
                          allowCustom={false}
                          data-testid="select-cidade-nasc"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
                      <div className="relative">
                        <UppercaseInput 
                          placeholder="00000-000" 
                          {...field} 
                          data-testid="input-cep"
                          onBlur={(e) => {
                            field.onBlur();
                            fetchAddressByCep(e.target.value);
                          }}
                        />
                        {isLoadingCep && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
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
                      <UppercaseInput placeholder="NOME DA RUA" {...field} data-testid="input-logradouro" />
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
                      <UppercaseInput placeholder="N" {...field} data-testid="input-numero" />
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
                      <UppercaseInput placeholder="APTO, BLOCO, ETC." {...field} data-testid="input-complemento" />
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
                      <UppercaseInput placeholder="BAIRRO" {...field} data-testid="input-bairro" />
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
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("cidade", "");
                        setCustomCidade("");
                      }} 
                      value={field.value}
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
                )}
              />
              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => {
                  const uf = form.watch("uf");
                  const baseCities = BRAZILIAN_CITIES[uf] || [];
                  const cities = customCidade && !baseCities.includes(customCidade) 
                    ? [customCidade, ...baseCities] 
                    : baseCities;
                  return (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          options={cities}
                          placeholder="Selecione a cidade"
                          searchPlaceholder="Buscar cidade..."
                          emptyMessage="Cidade não encontrada."
                          disabled={!uf}
                          allowCustom={false}
                          data-testid="select-cidade"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="(00) 0000-0000" {...field} data-testid="input-telefone1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dddCelular"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DDD Telefone Celular *</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="00" {...field} data-testid="input-ddd-celular" maxLength={2} />
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
                    <FormLabel>Telefone Celular *</FormLabel>
                    <FormControl>
                      <UppercaseInput placeholder="00000-0000" {...field} data-testid="input-telefone2" />
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
                    <FormLabel>E-mail {!form.watch("naoPossuiEmail") && !form.watch("naoQuerInformarEmail") && "*"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="email@exemplo.com" 
                        {...field} 
                        data-testid="input-email"
                        disabled={form.watch("naoPossuiEmail") || form.watch("naoQuerInformarEmail")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="md:col-span-2 flex items-center gap-6 pt-6">
                <FormField
                  control={form.control}
                  name="naoPossuiEmail"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox 
                          checked={field.value} 
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (checked) {
                              form.setValue("naoQuerInformarEmail", false);
                              form.setValue("email", "");
                            }
                          }}
                          data-testid="checkbox-nao-possui-email"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">Não possui E-mail</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="naoQuerInformarEmail"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox 
                          checked={field.value} 
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (checked) {
                              form.setValue("naoPossuiEmail", false);
                              form.setValue("email", "");
                            }
                          }}
                          data-testid="checkbox-nao-quer-informar-email"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">Não quis informar o E-mail</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentação</CardTitle>
              <CardDescription>Anexe os documentos necessários digitalizados (máximo 5MB por arquivo)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {DOCUMENT_CATEGORIES.map((category) => (
                <div key={category.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {category.label}
                      {category.required && <span className="text-destructive ml-1">*</span>}
                    </p>
                  </div>
                  
                  {files[category.id] ? (
                    <div className="flex items-center justify-between p-2 border rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileIcon className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-xs truncate">{files[category.id]!.name}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeFile(category.id)} 
                        className="h-7 w-7 text-destructive"
                        type="button"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                      <input 
                        type="file" 
                        className="hidden" 
                        id={`file-upload-${category.id}`} 
                        onChange={handleFileChange(category.id)}
                        accept=".pdf,.jpg,.jpeg,.png"
                      />
                      <label 
                        htmlFor={`file-upload-${category.id}`} 
                        className="mt-2 block text-xs font-medium text-primary cursor-pointer hover:underline"
                      >
                        Selecionar arquivo
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4 pb-12">
            <Link href="/solicitations">
              <Button variant="outline" type="button">Cancelar</Button>
            </Link>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Criar Solicitação"
              )}
            </Button>
          </div>
        </form>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Criação de Solicitação</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Você conferiu todos os dados informados?</p>
              <p className="font-medium text-foreground">
                Atenção: Após a criação da solicitação, só será possível alterar algum dado solicitando ACESSO PARA CORREÇÃO ao Detran.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">Revisar Dados</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit} data-testid="button-confirm-submit">
              Confirmar e Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
