import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, FileText, Shield, Info, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";

export default function SettingsPage() {
  // Check OCR availability
  const { data: ocrStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/documents/ocr-status"],
  });

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
      label: "Chat bloqueado após aprovação", 
      description: "Mensagens são bloqueadas apenas quando o status é 'Aprovada'",
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
    { id: "cadastro_finalizado", label: "Cadastro Finalizado", description: "Processamento concluído, chat ainda habilitado", color: "bg-emerald-500" },
    { id: "aprovada", label: "Aprovada", description: "Totalmente aprovada, chat desabilitado", color: "bg-green-600" },
    { id: "aguardando_penalidade", label: "Aguardando Penalidade", description: "Aguardando liberação de penalidade", color: "bg-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Informações sobre configurações e regras do sistema
        </p>
      </div>

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
                <span className="font-medium">1.2.0</span>
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
    </div>
  );
}
