import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "em_analise" | "pendente_correcao" | "reprovada" | "cadastro_finalizado" | "aguardando_penalidade";

const statusConfig: Record<Status, { label: string; className: string; icon: typeof Clock }> = {
  em_analise: {
    label: "Em Análise",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    icon: Clock,
  },
  pendente_correcao: {
    label: "Pendente de Correção",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    icon: AlertTriangle,
  },
  reprovada: {
    label: "Reprovada",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    icon: XCircle,
  },
  cadastro_finalizado: {
    label: "Cadastro Finalizado",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle2,
  },
  aguardando_penalidade: {
    label: "Aguardando Penalidade",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
    icon: AlertTriangle,
  },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-medium border",
        config.className,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </Badge>
  );
}

type SolicitationType = "novo_cadastro" | "alteracao_dados" | "atualizacao" | "regularizacao" | "transferencia_renovacao" | "reinicio" | "transferencia" | "renovacao" | "adicao_categoria" | "primeira_habilitacao" | "mudanca_categoria";

const typeConfig: Record<SolicitationType, { label: string; className: string }> = {
  novo_cadastro: {
    label: "Novo Cadastro",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  },
  alteracao_dados: {
    label: "Alteração de Dados",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800",
  },
  atualizacao: {
    label: "Atualização",
    className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800",
  },
  regularizacao: {
    label: "Regularização",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  },
  transferencia_renovacao: {
    label: "Transferência + Renovação",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
  },
  reinicio: {
    label: "Reinício",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800",
  },
  transferencia: {
    label: "Transferência",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
  },
  renovacao: {
    label: "Renovação",
    className: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400 border-lime-200 dark:border-lime-800",
  },
  adicao_categoria: {
    label: "Adição Categoria",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  primeira_habilitacao: {
    label: "Primeira Habilitação",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  mudanca_categoria: {
    label: "Mudança de Categoria",
    className: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-800",
  },
};

interface TypeBadgeProps {
  type: string;
  label?: string;
  className?: string;
}

export function TypeBadge({ type, label, className }: TypeBadgeProps) {
  const config = typeConfig[type as SolicitationType] || {
    label: label || type,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        config.className,
        className
      )}
    >
      {label || config.label}
    </Badge>
  );
}
