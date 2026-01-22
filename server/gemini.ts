import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não está configurada");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export interface DocumentData {
  tipoDocumento?: string;
  nome?: string;
  cpf?: string;
  rg?: string;
  orgaoEmissor?: string;
  ufEmissor?: string;
  dataNascimento?: string;
  sexo?: string;
  nomeMae?: string;
  nomePai?: string;
  nacionalidade?: string;
  naturalidade?: string;
  ufNascimento?: string;
}

export async function analyzeDocument(imageBase64: string, mimeType: string): Promise<DocumentData> {
  try {
    const systemPrompt = `Você é um especialista em análise de documentos brasileiros.
Analise esta imagem de documento de identificação (RG, CNH, CNH Digital, Passaporte, Identidade ou similar) e extraia as seguintes informações:
- tipoDocumento: tipo do documento (RG, CNH, PASSAPORTE, IDENTIDADE_DIGITAL)
- nome: nome completo da pessoa (nome civil)
- cpf: número do CPF (apenas números, 11 dígitos)
- rg: número do RG/Identidade ou número do Passaporte
- orgaoEmissor: órgão emissor do documento (ex: SSP, DETRAN, PC, DPF, SR/DPF, etc.)
- ufEmissor: UF do órgão emissor (sigla de 2 letras)
- dataNascimento: data de nascimento no formato YYYY-MM-DD
- sexo: MASCULINO ou FEMININO
- nomeMae: nome da mãe (campo "Filiação" no passaporte)
- nomePai: nome do pai
- nacionalidade: nacionalidade (ex: BRASILEIRO)
- naturalidade: cidade de nascimento
- ufNascimento: UF de nascimento (sigla de 2 letras)

IMPORTANTE sobre PASSAPORTE:
- Se for passaporte, coloque tipoDocumento como "PASSAPORTE"
- O número do passaporte tem formato: 2 letras + 6 números (ex: AA123456) - coloque no campo "rg" COMPLETO com as letras
- O órgão emissor do passaporte geralmente é "SR/DPF" ou "DPF" seguido da UF
- No passaporte, o nome está dividido em "Sobrenome / Surname" e "Nome / Given Names".
- O PRIMEIRO NOME sempre vem abaixo do SOBRENOME.
- Você DEVE juntar os dois na ordem correta: [Nome / Given Names] [Sobrenome / Surname] para formar o nome completo no campo "nome".
- Exemplo: Sobrenome "ALBERTO DA SILVA OLIVEIRA FILHO" e Nome "ANTONIO JOAO" deve resultar em "ANTONIO JOAO ALBERTO DA SILVA OLIVEIRA FILHO".
- No passaporte, o CPF pode estar no campo "CPF / Personal Number"

IMPORTANTE sobre CNH Digital:
- Na CNH Digital, o nome civil está no campo "2 e 1 Nome e Sobrenome" ou similar - extraia esse valor para o campo "nome"
- Após o número do RG, há um campo com o órgão emissor (ex: SSP, DETRAN, PC) - extraia para "orgaoEmissor"
- Após o órgão emissor, há a UF emissora (ex: SP, SC, RJ) - extraia para "ufEmissor"

IMPORTANTE sobre documentos "RG e CPF" ou "Identidade Digital":
- Alguns estados emitem RG onde o número do documento É o próprio CPF (documento "RG e CPF" ou "Identidade Digital")
- Nesses documentos, o número do RG/Identidade tem 11 dígitos e é igual ao CPF
- Se identificar esse tipo de documento, use o mesmo número para ambos os campos (rg e cpf)
- Se o documento mostrar apenas um número de 11 dígitos como identificador principal, coloque esse número em ambos os campos

Responda APENAS com JSON válido no formato especificado. Se algum campo não for legível ou não existir no documento, omita-o do JSON.
Todos os textos devem estar em MAIÚSCULAS, sem acentos.`;

    const contents = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      },
      systemPrompt,
    ];

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
    });

    const rawText = response.text || "{}";
    
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("No JSON found in response:", rawText);
      return {};
    }

    const data: DocumentData = JSON.parse(jsonMatch[0]);
    
    // Verificar se é passaporte (número começa com 2 letras seguidas de números)
    const isPassaporte = data.tipoDocumento === "PASSAPORTE" || 
                         (data.rg && /^[A-Za-z]{2}\d+/.test(data.rg));
    
    // Pós-processamento do RG: remover letras e dígito verificador (exceto passaporte)
    if (data.rg) {
      let rg = data.rg;
      
      if (isPassaporte) {
        // Para passaporte: manter letras, apenas remover caracteres especiais
        // Formato esperado: AA123456 (2 letras + 6 números)
        rg = rg.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      } else {
        // Para outros documentos: remover letras e dígito verificador
        // Remove o dígito verificador se houver (após traço ou letra no final)
        // Exemplos: "12345678-9" -> "12345678", "12345678-X" -> "12345678", "12345678X" -> "12345678"
        rg = rg.replace(/[-.]?\s*[A-Za-z]$/i, ""); // Remove letra no final
        rg = rg.replace(/-\d$/, ""); // Remove dígito verificador após traço
        
        // Remove todas as letras e caracteres especiais, mantendo apenas números
        rg = rg.replace(/\D/g, "");
      }
      
      data.rg = rg;
    }
    
    // Pós-processamento do CPF: apenas números
    if (data.cpf) {
      data.cpf = data.cpf.replace(/\D/g, "");
    }
    
    // Se tiver RG de 11 dígitos e não tiver CPF, usa o RG como CPF (documento "RG e CPF")
    if (data.rg && !data.cpf) {
      if (data.rg.length === 11) {
        data.cpf = data.rg;
      }
    }
    
    // Se tiver CPF e não tiver RG, usa o CPF como RG (para documentos "RG e CPF")
    if (data.cpf && !data.rg) {
      data.rg = data.cpf;
    }
    
    return data;
  } catch (error) {
    console.error("Failed to analyze document:", error);
    throw new Error(`Falha ao analisar documento: ${error}`);
  }
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export interface AuthenticityAnalysis {
  nivelRisco: "BAIXO" | "MEDIO" | "ALTO";
  pontuacaoConfianca: number;
  pontosSuspeitos: string[];
  detalhesAnalise: {
    fontes: { status: string; descricao: string };
    alinhamento: { status: string; descricao: string };
    qualidadeImagem: { status: string; descricao: string };
    elementosSeguranca: { status: string; descricao: string };
    consistenciaDados: { status: string; descricao: string };
  };
  recomendacao: string;
  observacoes: string;
}

export async function analyzeDocumentAuthenticity(imageBase64: string, mimeType: string): Promise<AuthenticityAnalysis> {
  try {
    const systemPrompt = `Você é um especialista forense em análise de documentos brasileiros, especializado em detectar adulterações e falsificações.

Analise esta imagem de documento e verifique sinais de adulteração ou falsificação. Examine cuidadosamente:

1. **FONTES E TIPOGRAFIA:**
   - Consistência das fontes usadas no documento
   - Tamanho e espaçamento uniformes
   - Fontes que não correspondem ao padrão oficial do documento

2. **ALINHAMENTO E LAYOUT:**
   - Textos desalinhados ou inclinados
   - Espaçamento irregular entre elementos
   - Posicionamento incorreto de campos

3. **QUALIDADE DA IMAGEM:**
   - Áreas com qualidade/resolução diferente
   - Borrões localizados ou artefatos de edição
   - Diferenças de iluminação em partes específicas
   - Sinais de recorte e colagem (copy-paste)

4. **ELEMENTOS DE SEGURANÇA:**
   - Marcas d'água ausentes ou irregulares
   - Hologramas ou elementos especiais (se visíveis)
   - Padrões de fundo inconsistentes

5. **CONSISTÊNCIA DOS DADOS:**
   - Formatos de data incorretos
   - Números de documento com formato inválido
   - Informações contraditórias

Responda APENAS com JSON válido no seguinte formato:
{
  "nivelRisco": "BAIXO" | "MEDIO" | "ALTO",
  "pontuacaoConfianca": (número de 0 a 100, onde 100 = documento aparenta ser autêntico),
  "pontosSuspeitos": ["lista de pontos suspeitos encontrados, se houver"],
  "detalhesAnalise": {
    "fontes": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação" },
    "alinhamento": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação" },
    "qualidadeImagem": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação" },
    "elementosSeguranca": { "status": "OK" | "SUSPEITO" | "NAO_VISIVEL", "descricao": "explicação" },
    "consistenciaDados": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação" }
  },
  "recomendacao": "APROVAR" | "SOLICITAR_NOVO_DOCUMENTO" | "INVESTIGAR",
  "observacoes": "observações gerais sobre o documento"
}

IMPORTANTE:
- Seja criterioso mas justo. Nem toda imperfeição é sinal de fraude.
- Considere que fotos de documentos podem ter reflexos, sombras ou distorções naturais.
- Documentos mais antigos podem ter desgaste natural.
- Se não conseguir analisar algum aspecto por limitação da imagem, indique isso.`;

    const contents = [
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      },
      systemPrompt,
    ];

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
    });

    const rawText = response.text || "{}";
    
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("No JSON found in authenticity response:", rawText);
      throw new Error("Não foi possível analisar o documento");
    }

    const data: AuthenticityAnalysis = JSON.parse(jsonMatch[0]);
    return data;
  } catch (error) {
    console.error("Failed to analyze document authenticity:", error);
    throw new Error(`Falha ao verificar autenticidade: ${error}`);
  }
}
