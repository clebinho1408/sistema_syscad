import sharp from "sharp";
import * as path from "path";
import * as os from "os";
import * as fsp from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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

// Always available - uses local Tesseract OCR via CLI
export function isOcrConfigured(): boolean {
  return true;
}

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(text: string): string {
  return removeAccents(text).toUpperCase().trim();
}

function extractCpf(text: string): string | undefined {
  const cpfPattern = /\b(\d{3}[.\s]?\d{3}[.\s]?\d{3}[-.\s]?\d{2})\b/g;
  const matches = [...text.matchAll(cpfPattern)];

  for (const match of matches) {
    const digits = match[1].replace(/\D/g, "");
    if (digits.length === 11) {
      return digits;
    }
  }
  return undefined;
}

function extractRg(text: string, cpf?: string): string | undefined {
  const normalized = normalizeText(text);

  // Try labeled RG
  const labeled = normalized.match(
    /(?:RG|R\.G\.|IDENTIDADE|REGISTRO GERAL)[:\s#]*([0-9.\-X\/\s]{5,15})/i
  );
  if (labeled) {
    const rg = labeled[1].replace(/\D/g, "");
    if (rg.length >= 6 && rg.length <= 9) return rg;
  }

  // Try to find 7-9 digit sequences that aren't the CPF
  const pattern = /\b(\d{7,9})\b/g;
  const matches = [...normalized.matchAll(pattern)];
  for (const match of matches) {
    const digits = match[1];
    if (cpf && digits === cpf) continue;
    if (digits.length >= 7 && digits.length <= 9) return digits;
  }

  return undefined;
}

function extractDate(text: string): string | undefined {
  const datePattern = /\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/g;
  const matches = [...text.matchAll(datePattern)];

  for (const match of matches) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);

    if (
      day >= 1 && day <= 31 &&
      month >= 1 && month <= 12 &&
      year >= 1920 && year <= 2010
    ) {
      return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    }
  }
  return undefined;
}

function extractName(text: string): string | undefined {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 3);
  const nameIndicators = ["NOME CIVIL", "NOME:", "NAME:", "NOME COMPLETO"];

  for (let i = 0; i < lines.length; i++) {
    const upper = normalizeText(lines[i]);

    for (const indicator of nameIndicators) {
      if (upper.includes(indicator)) {
        const afterIndicator = upper.replace(new RegExp(`.*${indicator}[:\\s]*`), "").trim();
        if (afterIndicator.length > 5 && /^[A-Z\s]+$/.test(afterIndicator)) {
          return afterIndicator;
        }
        if (i + 1 < lines.length) {
          const nextLine = normalizeText(lines[i + 1]);
          if (nextLine.length > 5 && /^[A-Z\s]+$/.test(nextLine)) {
            return nextLine;
          }
        }
        break;
      }
    }
  }

  // Find standalone uppercase name-like lines (2-5 words)
  for (const line of lines) {
    const normalized = normalizeText(line);
    if (normalized.length >= 10 && normalized.length <= 60 && /^[A-Z][A-Z\s]+$/.test(normalized)) {
      const words = normalized.split(" ").filter((w) => w.length > 1);
      if (words.length >= 2 && words.length <= 5) {
        return normalized;
      }
    }
  }

  return undefined;
}

function extractMotherName(text: string): string | undefined {
  const normalized = normalizeText(text);
  const patterns = [
    /(?:MAE|NOME DA MAE|FILIACAO|MOM|MOTHER)[:\s]+([A-Z][A-Z\s]{8,55})/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]?.trim().length > 8) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractFatherName(text: string): string | undefined {
  const normalized = normalizeText(text);
  const patterns = [/(?:PAI|NOME DO PAI|FATHER)[:\s]+([A-Z][A-Z\s]{8,55})/];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]?.trim().length > 8) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractSexo(text: string): string | undefined {
  const normalized = normalizeText(text);
  if (/\bMASCULINO\b|\bMASC\b/.test(normalized)) return "MASCULINO";
  if (/\bFEMININO\b|\bFEM\b/.test(normalized)) return "FEMININO";
  // Check single M/F near "SEXO"
  const sexMatch = normalized.match(/(?:SEXO|SEX)[:\s]+([MF])\b/);
  if (sexMatch) {
    return sexMatch[1] === "M" ? "MASCULINO" : "FEMININO";
  }
  return undefined;
}

function extractOrgaoEmissor(text: string): { orgaoEmissor?: string; ufEmissor?: string } {
  const normalized = normalizeText(text);
  const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  const patterns = [
    /\b(SSP|DETRAN|PC|DIC|SDS|SESP)[\/\s-]*([A-Z]{2})\b/,
    /(?:ORGAO EMISSOR|ORG\. EMISSOR)[:\s]*([A-Z\/\s]{3,15})/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const org = match[1]?.trim();
      const uf = match[2]?.trim();
      if (uf && ufs.includes(uf)) {
        return { orgaoEmissor: org, ufEmissor: uf };
      }
      if (org && org.length >= 2) {
        return { orgaoEmissor: org };
      }
    }
  }

  return {};
}

function extractNaturalidade(text: string): { naturalidade?: string; ufNascimento?: string } {
  const normalized = normalizeText(text);
  const ufs = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  const patterns = [
    /(?:NATURALIDADE|NATURAL DE|LOCAL DE NASCIMENTO)[:\s]+([A-Z\s]{4,30})[\/\s-]+([A-Z]{2})\b/,
    /(?:NATURALIDADE|NATURAL DE)[:\s]+([A-Z\s]{4,30})/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const cidade = match[1]?.trim();
      const uf = match[2]?.trim();
      if (cidade && cidade.length > 3) {
        const result: { naturalidade?: string; ufNascimento?: string } = { naturalidade: cidade };
        if (uf && ufs.includes(uf)) {
          result.ufNascimento = uf;
        }
        return result;
      }
    }
  }

  return {};
}

function detectDocumentType(text: string): string {
  const normalized = normalizeText(text);
  if (/CNH|CARTEIRA NACIONAL DE HABILITACAO/.test(normalized)) return "CNH";
  if (/PASSAPORTE|PASSPORT/.test(normalized)) return "PASSAPORTE";
  if (/IDENTIDADE DIGITAL/.test(normalized)) return "IDENTIDADE_DIGITAL";
  return "RG";
}

async function runTesseract(imagePath: string): Promise<string> {
  const outputBase = imagePath.replace(/\.[^.]+$/, "_ocr");

  try {
    // Run tesseract CLI
    await execFileAsync("tesseract", [
      imagePath,
      outputBase,
      "-l", "por+eng",
      "--oem", "3",
      "--psm", "3",
      "txt",
    ], { timeout: 30000 });

    const outputFile = `${outputBase}.txt`;
    const text = await fsp.readFile(outputFile, "utf-8");
    await fsp.unlink(outputFile).catch(() => {});
    return text;
  } catch (error) {
    console.error("Tesseract CLI error:", error);
    throw new Error("Falha ao executar OCR local");
  }
}

export async function analyzeDocumentOcr(
  imageBase64: string,
  mimeType: string
): Promise<DocumentData> {
  const tmpDir = os.tmpdir();
  const tmpId = Date.now().toString();
  const tmpInput = path.join(tmpDir, `ocr_input_${tmpId}.png`);

  try {
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, "base64");

    // Pre-process image with sharp for better OCR
    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(imageBuffer)
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.5 })
        .resize({ width: 1600, withoutEnlargement: true })
        .png({ compressionLevel: 6 })
        .toBuffer();
    } catch (sharpError) {
      console.error("Sharp processing failed:", sharpError);
      // If sharp fails, try to convert directly
      processedBuffer = imageBuffer;
    }

    // Write to temp file
    await fsp.writeFile(tmpInput, processedBuffer);

    // Run OCR
    const text = await runTesseract(tmpInput);
    console.log("OCR extracted text (first 400 chars):", text.substring(0, 400));

    // Parse extracted text
    const cpf = extractCpf(text);
    const rg = extractRg(text, cpf);
    const dataNascimento = extractDate(text);
    const nome = extractName(text);
    const nomeMae = extractMotherName(text);
    const nomePai = extractFatherName(text);
    const sexo = extractSexo(text);
    const { orgaoEmissor, ufEmissor } = extractOrgaoEmissor(text);
    const { naturalidade, ufNascimento } = extractNaturalidade(text);
    const tipoDocumento = detectDocumentType(text);

    const result: DocumentData = {};
    if (tipoDocumento) result.tipoDocumento = tipoDocumento;
    if (nome) result.nome = nome;
    if (cpf) result.cpf = cpf;
    if (rg) result.rg = rg;
    if (orgaoEmissor) result.orgaoEmissor = orgaoEmissor;
    if (ufEmissor) result.ufEmissor = ufEmissor;
    if (dataNascimento) result.dataNascimento = dataNascimento;
    if (sexo) result.sexo = sexo;
    if (nomeMae) result.nomeMae = nomeMae;
    if (nomePai) result.nomePai = nomePai;
    if (naturalidade) result.naturalidade = naturalidade;
    if (ufNascimento) result.ufNascimento = ufNascimento;
    result.nacionalidade = "BRASILEIRO";

    return result;
  } finally {
    // Cleanup temp file
    await fsp.unlink(tmpInput).catch(() => {});
  }
}
