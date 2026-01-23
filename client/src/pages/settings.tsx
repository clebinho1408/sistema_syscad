import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, FileText, Shield, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documentos Obrigatórios
            </CardTitle>
            <CardDescription>
              Configure quais documentos são obrigatórios por requerimento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Novo Cadastro</h4>
              <div className="grid gap-2 pl-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="doc-rg">RG ou CNH</Label>
                  <Switch id="doc-rg" defaultChecked data-testid="switch-doc-rg" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="doc-cpf">CPF</Label>
                  <Switch id="doc-cpf" defaultChecked data-testid="switch-doc-cpf" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="doc-residencia">Comprovante de Residência</Label>
                  <Switch id="doc-residencia" defaultChecked data-testid="switch-doc-residencia" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="doc-foto">Foto 3x4</Label>
                  <Switch id="doc-foto" defaultChecked data-testid="switch-doc-foto" />
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Alteração de Dados</h4>
              <div className="grid gap-2 pl-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="doc-alt-rg">RG ou CNH</Label>
                  <Switch id="doc-alt-rg" defaultChecked data-testid="switch-alt-rg" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="doc-alt-comprovante">Documento comprobatório</Label>
                  <Switch id="doc-alt-comprovante" defaultChecked data-testid="switch-alt-comprovante" />
                </div>
              </div>
            </div>
            <Button className="w-full mt-4" data-testid="button-save-docs">
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure as notificações por e-mail
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notify-new">Nova solicitação</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar operadores quando novas solicitações chegarem
                </p>
              </div>
              <Switch id="notify-new" defaultChecked data-testid="switch-notify-new" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notify-status">Mudança de status</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar autoescolas sobre mudanças de status
                </p>
              </div>
              <Switch id="notify-status" defaultChecked data-testid="switch-notify-status" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notify-chat">Novas mensagens</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar sobre novas mensagens no chat
                </p>
              </div>
              <Switch id="notify-chat" data-testid="switch-notify-chat" />
            </div>
            <Button className="w-full mt-4" data-testid="button-save-notifications">
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Regras do Sistema
            </CardTitle>
            <CardDescription>
              Configure regras gerais do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="rule-block-chat">Bloquear chat após finalização</Label>
                <p className="text-sm text-muted-foreground">
                  Impedir envio de mensagens em solicitações finalizadas
                </p>
              </div>
              <Switch id="rule-block-chat" defaultChecked data-testid="switch-block-chat" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="rule-require-docs">Exigir todos os documentos</Label>
                <p className="text-sm text-muted-foreground">
                  Bloquear análise sem todos os documentos obrigatórios
                </p>
              </div>
              <Switch id="rule-require-docs" defaultChecked data-testid="switch-require-docs" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="rule-justify">Justificativa obrigatória</Label>
                <p className="text-sm text-muted-foreground">
                  Exigir justificativa para reprovação
                </p>
              </div>
              <Switch id="rule-justify" defaultChecked data-testid="switch-justify" />
            </div>
            <Button className="w-full mt-4" data-testid="button-save-rules">
              Salvar Configurações
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Sistema
            </CardTitle>
            <CardDescription>
              Informações e manutenção do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Versão do Sistema</span>
                <span className="font-medium">1.0.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Última atualização</span>
                <span className="font-medium">18/01/2026</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status do banco</span>
                <span className="font-medium text-emerald-600">Conectado</span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Button variant="outline" className="w-full" data-testid="button-clear-cache">
                Limpar Cache
              </Button>
              <Button variant="outline" className="w-full" data-testid="button-backup">
                Fazer Backup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
