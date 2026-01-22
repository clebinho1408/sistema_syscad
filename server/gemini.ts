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
Analise esta imagem de documento de identificação (RG, CNH, CNH Digital, Identidade ou similar) e extraia as seguintes informações:
- nome: nome completo da pessoa (nome civil)
- cpf: número do CPF (apenas números, 11 dígitos)
- rg: número do RG/Identidade (apenas números)
- orgaoEmissor: órgão emissor do RG (ex: SSP, DETRAN, PC, etc.)
- ufEmissor: UF do órgão emissor (sigla de 2 letras)
- dataNascimento: data de nascimento no formato YYYY-MM-DD
- sexo: MASCULINO ou FEMININO
- nomeMae: nome da mãe
- nomePai: nome do pai
- nacionalidade: nacionalidade (ex: BRASILEIRO)
- naturalidade: cidade de nascimento
- ufNascimento: UF de nascimento (sigla de 2 letras)

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
    
    // Pós-processamento do RG: remover letras e dígito verificador
    if (data.rg) {
      let rg = data.rg;
      
      // Remove o dígito verificador se houver (após traço ou letra no final)
      // Exemplos: "12345678-9" -> "12345678", "12345678-X" -> "12345678", "12345678X" -> "12345678"
      rg = rg.replace(/[-.]?\s*[A-Za-z]$/i, ""); // Remove letra no final
      rg = rg.replace(/-\d$/, ""); // Remove dígito verificador após traço
      
      // Remove todas as letras e caracteres especiais, mantendo apenas números
      rg = rg.replace(/\D/g, "");
      
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
