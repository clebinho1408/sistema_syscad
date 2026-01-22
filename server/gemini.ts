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
Analise esta imagem de documento de identificação (RG, CNH ou similar) e extraia as seguintes informações:
- nome: nome completo da pessoa
- cpf: número do CPF (apenas números, 11 dígitos)
- rg: número do RG
- dataNascimento: data de nascimento no formato YYYY-MM-DD
- sexo: MASCULINO ou FEMININO
- nomeMae: nome da mãe
- nomePai: nome do pai
- nacionalidade: nacionalidade (ex: BRASILEIRO)
- naturalidade: cidade de nascimento
- ufNascimento: UF de nascimento (sigla de 2 letras)

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
    return data;
  } catch (error) {
    console.error("Failed to analyze document:", error);
    throw new Error(`Falha ao analisar documento: ${error}`);
  }
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
