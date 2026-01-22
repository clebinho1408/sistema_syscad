import { GoogleGenAI } from "@google/genai";
import { PDFDocument } from "pdf-lib";

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

export interface PdfMetadata {
  titulo?: string;
  autor?: string;
  assunto?: string;
  palavrasChave?: string;
  criador?: string;
  produtor?: string;
  dataCriacao?: string;
  dataModificacao?: string;
  versaoPdf?: string;
  numeroPaginas?: number;
}

export async function extractPdfMetadata(pdfBuffer: Buffer): Promise<PdfMetadata> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    
    const titulo = pdfDoc.getTitle();
    const autor = pdfDoc.getAuthor();
    const assunto = pdfDoc.getSubject();
    const palavrasChave = pdfDoc.getKeywords();
    const criador = pdfDoc.getCreator();
    const produtor = pdfDoc.getProducer();
    const dataCriacao = pdfDoc.getCreationDate();
    const dataModificacao = pdfDoc.getModificationDate();
    
    const metadata: PdfMetadata = {
      numeroPaginas: pdfDoc.getPageCount(),
    };
    
    if (titulo) metadata.titulo = titulo;
    if (autor) metadata.autor = autor;
    if (assunto) metadata.assunto = assunto;
    if (palavrasChave) metadata.palavrasChave = palavrasChave;
    if (criador) metadata.criador = criador;
    if (produtor) metadata.produtor = produtor;
    if (dataCriacao) metadata.dataCriacao = dataCriacao.toISOString();
    if (dataModificacao) metadata.dataModificacao = dataModificacao.toISOString();
    
    return metadata;
  } catch (error) {
    console.error("Failed to extract PDF metadata:", error);
    return {};
  }
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
    metadados?: { status: string; descricao: string };
  };
  recomendacao: string;
  observacoes: string;
  metadatasPdf?: PdfMetadata;
}

export async function analyzeDocumentAuthenticity(
  imageBase64: string, 
  mimeType: string,
  pdfMetadata?: PdfMetadata
): Promise<AuthenticityAnalysis> {
  try {
    // Lista de softwares suspeitos para criação de documentos oficiais
    // Inclui editores de imagem, OCR, editores online e processadores de texto
    const suspiciousSoftware = [
      // Editores gráficos
      "canva", "photoshop", "adobe photoshop", "gimp", "paint", "corel", "coreldraw", "inkscape", "affinity",
      // Processadores de texto
      "word", "microsoft word", "libreoffice", "openoffice", "google docs", "wps office",
      // Editores online
      "pixlr", "fotor", "befunky", "picmonkey", "canva.com", "remove.bg", "photopea", "lunapic",
      "iloveimg", "smallpdf", "ilovepdf", "sejda", "pdf24", "pdfcandy", "cleverpdf",
      // Softwares OCR
      "abbyy", "finereader", "ocr", "tesseract", "readiris", "omnipage", "scansoft",
      "adobe scan", "microsoft lens", "camscanner", "scanbot", "genius scan",
      // Conversores PDF
      "nitro", "pdf-xchange", "pdfforge", "pdfelement", "foxit phantompdf",
      // Editores de PDF
      "pdfescape", "pdf-editor", "pdf editor", "pdf pro", "pdfpen", "formswift"
    ];
    
    let metadataWarnings: string[] = [];
    let metadataAnalysis = { status: "NAO_DISPONIVEL", descricao: "Metadados não disponíveis para análise" };
    let isFalseDocument = false;
    
    if (pdfMetadata) {
      const criador = (pdfMetadata.criador || "").toLowerCase();
      
      // REGRA 1: Software deve ser Adobe LiveCycle Designer - qualquer outro = FALSO
      if (pdfMetadata.criador) {
        if (!criador.includes("adobe livecycle") && !criador.includes("livecycle designer")) {
          // Verifica se é software suspeito de edição
          for (const software of suspiciousSoftware) {
            if (criador.includes(software)) {
              metadataWarnings.push(`Software de edição detectado: ${pdfMetadata.criador}`);
              isFalseDocument = true;
              break;
            }
          }
          // Se não é LiveCycle e não é software de edição conhecido, ainda é suspeito
          if (!isFalseDocument && metadataWarnings.length === 0) {
            metadataWarnings.push(`Software não é Adobe LiveCycle Designer: ${pdfMetadata.criador}`);
          }
        }
      }
      
      // REGRA 2: Campos vazios = OK, campos preenchidos = SUSPEITO
      // Documentos oficiais geralmente têm esses campos vazios
      if (pdfMetadata.titulo) {
        metadataWarnings.push(`Título preenchido: "${pdfMetadata.titulo}"`);
      }
      if (pdfMetadata.autor) {
        metadataWarnings.push(`Autor preenchido: "${pdfMetadata.autor}"`);
      }
      if (pdfMetadata.assunto) {
        metadataWarnings.push(`Assunto preenchido: "${pdfMetadata.assunto}"`);
      }
      if (pdfMetadata.palavrasChave) {
        metadataWarnings.push(`Palavras-chave preenchidas: "${pdfMetadata.palavrasChave}"`);
      }
      
      // Define status dos metadados
      if (isFalseDocument) {
        metadataAnalysis = { status: "IRREGULAR", descricao: metadataWarnings.join("; ") };
      } else if (metadataWarnings.length === 0) {
        metadataAnalysis = { status: "OK", descricao: "Metadados limpos - padrão de documento oficial" };
      } else if (metadataWarnings.length <= 2) {
        metadataAnalysis = { status: "SUSPEITO", descricao: metadataWarnings.join("; ") };
      } else {
        metadataAnalysis = { status: "IRREGULAR", descricao: metadataWarnings.join("; ") };
      }
    }

    let metadataSection = "";
    if (pdfMetadata && Object.keys(pdfMetadata).length > 0) {
      metadataSection = `

5. **METADADOS DO PDF (ANÁLISE JÁ REALIZADA PELO SISTEMA):**
   Os metadados já foram analisados automaticamente. Foque na análise visual do documento.
   ${metadataWarnings.length > 0 ? `⚠️ ALERTAS: ${metadataWarnings.join("; ")}` : "✓ Metadados OK"}`;
    }

    const systemPrompt = `Você é um especialista forense em análise de documentos brasileiros.

REGRAS IMPORTANTES:
- Documentos escaneados NATURALMENTE perdem nitidez - isso é NORMAL
- Desalinhamento leve em scans é NORMAL (scanners não são perfeitos)
- FOQUE principalmente na CONSISTÊNCIA DOS DADOS - esta é a análise mais importante

Analise esta imagem de documento:

1. **FONTES E TIPOGRAFIA:** (peso baixo)
   - Consistência das fontes
   - SUSPEITO apenas se: texto muito nítido em documento borrado (sinal de edição digital)

2. **ALINHAMENTO:** (peso muito baixo - apenas 1% de impacto)
   - Desalinhamento leve é NORMAL em scans
   - Marque OK a menos que haja desalinhamento EXTREMO e óbvio

3. **QUALIDADE DA IMAGEM:** (peso baixo)
   - Scan borrado uniforme = OK/NORMAL
   - SUSPEITO apenas se: diferenças de nitidez entre áreas (texto nítido em fundo borrado)

4. **CONSISTÊNCIA DOS DADOS:** (PESO ALTO - ANÁLISE PRINCIPAL)
   - Verifique CADA informação visível no documento
   - Datas: formato correto? datas fazem sentido cronologicamente?
   - Números: CPF/RG/CNPJ com formato válido?
   - Valores: números batem com totais?
   - Nomes: consistentes ao longo do documento?
   - SE ENCONTRAR INCONSISTÊNCIA: descreva EXATAMENTE qual é (ex: "CPF com 10 dígitos", "data futura", "total não bate com soma")
${metadataSection}

Responda APENAS com JSON válido no seguinte formato:
{
  "nivelRisco": "BAIXO" | "MEDIO" | "ALTO",
  "pontuacaoConfianca": (número de 0 a 100, onde 100 = documento aparenta ser autêntico),
  "pontosSuspeitos": ["lista de pontos suspeitos encontrados, se houver"],
  "detalhesAnalise": {
    "fontes": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação" },
    "alinhamento": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação" },
    "qualidadeImagem": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação" },
    "consistenciaDados": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação" }${pdfMetadata ? `,
    "metadados": { "status": "OK" | "SUSPEITO" | "IRREGULAR", "descricao": "explicação sobre os metadados do PDF" }` : ""}
  },
  "recomendacao": "APROVAR" | "SOLICITAR_NOVO_DOCUMENTO" | "INVESTIGAR",
  "observacoes": "observações gerais sobre o documento"
}

IMPORTANTE:
- Seja criterioso mas justo. Nem toda imperfeição é sinal de fraude.
- Considere que fotos de documentos podem ter reflexos, sombras ou distorções naturais.
- Documentos mais antigos podem ter desgaste natural.
- Se não conseguir analisar algum aspecto por limitação da imagem, indique isso.
${metadataWarnings.length > 0 ? "- ATENÇÃO: Foram detectados alertas nos metadados do PDF. Considere isso fortemente na sua análise." : ""}`;

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
    
    // Adiciona os metadados do PDF ao resultado
    if (pdfMetadata && Object.keys(pdfMetadata).length > 0) {
      data.metadatasPdf = pdfMetadata;
    }
    
    return data;
  } catch (error: any) {
    console.error("Failed to analyze document authenticity:", error);
    
    // Verifica se é erro de rate limit
    const errorStr = String(error);
    if (errorStr.includes("RESOURCE_EXHAUSTED") || errorStr.includes("rate-limit") || errorStr.includes("quota")) {
      throw new Error("Limite de uso da API atingido. Aguarde alguns segundos e tente novamente.");
    }
    
    throw new Error("Falha ao verificar autenticidade. Tente novamente em alguns instantes.");
  }
}
