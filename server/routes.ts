import { conductors, solicitations, solicitationTypeEnum } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireRole, hashPassword } from "./auth";
import passport from "passport";
import { WebSocketServer, WebSocket } from "ws";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { analyzeDocument, analyzeDocumentAuthenticity, analyzeDocumentVisualQuality, extractPdfMetadata, isGeminiConfigured, PdfMetadata } from "./gemini";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);
  
  // Register Object Storage routes
  registerObjectStorageRoutes(app);
  const objectStorageService = new ObjectStorageService();
  
  // Store pending upload tokens (objectPath -> { userId, solicitationId, expiresAt })
  const pendingUploadTokens = new Map<string, { userId: string; solicitationId: string; expiresAt: number }>();
  
  // Clean up expired tokens every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const entries = Array.from(pendingUploadTokens.entries());
    for (const [key, value] of entries) {
      if (value.expiresAt < now) {
        pendingUploadTokens.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Map<string, Set<{ ws: WebSocket; userId: string; userName: string; userRole: string }>>();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const solicitationId = url.searchParams.get("solicitationId");
    const userId = url.searchParams.get("userId") || "";
    const userName = url.searchParams.get("userName") || "";
    const userRole = url.searchParams.get("userRole") || "";
    
    if (solicitationId) {
      if (!clients.has(solicitationId)) {
        clients.set(solicitationId, new Set());
      }
      const clientInfo = { ws, userId, userName, userRole };
      clients.get(solicitationId)!.add(clientInfo);

      broadcastPresence(solicitationId);

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "typing") {
            broadcastToSolicitation(solicitationId, {
              type: "typing",
              userId: message.userId,
              userName: message.userName,
              isTyping: message.isTyping,
            });
          }
        } catch (e) {
        }
      });

      ws.on("close", () => {
        clients.get(solicitationId)?.delete(clientInfo);
        broadcastPresence(solicitationId);
      });
    }
  });

  function broadcastPresence(solicitationId: string) {
    const solicitationClients = clients.get(solicitationId);
    if (solicitationClients) {
      const onlineUsers = Array.from(solicitationClients).map(c => ({
        id: c.userId,
        name: c.userName,
        role: c.userRole,
      }));
      const data = JSON.stringify({ type: "presence", onlineUsers });
      solicitationClients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(data);
        }
      });
    }
  }

  function broadcastToSolicitation(solicitationId: string, message: any) {
    const solicitationClients = clients.get(solicitationId);
    if (solicitationClients) {
      const data = JSON.stringify(message);
      solicitationClients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(data);
        }
      });
    }
  }

  app.post("/api/auth/login", (req, res, next) => {
    console.log("Login attempt:", req.body.username);
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log("Login failed - user not found or invalid password:", info?.message);
        return res.status(401).json({ message: info?.message || "Falha na autenticação" });
      }
      console.log("Login success, creating session for:", user.username);
      req.login(user, async (err) => {
        if (err) {
          console.error("Session creation error:", err);
          return next(err);
        }
        console.log("Session created successfully");
        
        await storage.createAuditLog({
          userId: user.id,
          action: "login",
          entity: "user",
          entityId: user.id,
          details: `Login realizado: ${user.username}`,
        });

        const { password, ...userWithoutPassword } = user;
        const drivingSchool = await storage.getDrivingSchoolByUserId(user.id);
        return res.json({ ...userWithoutPassword, drivingSchool: drivingSchool || null });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    await storage.createAuditLog({
      userId,
      action: "logout",
      entity: "user",
      entityId: userId,
      details: `Logout realizado`,
    });
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Erro ao fazer logout" });
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    return res.status(401).json({ message: "Não autenticado" });
  });

  app.post("/api/auth/register", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const {
        username, password, name, email,
        nomeAutoescola, cep, logradouro, numero,
        complemento, bairro, cidade, uf, telefone
      } = req.body;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Usuário já existe" });
      }

      const existingSchool = await storage.getDrivingSchoolByName(nomeAutoescola);
      if (existingSchool) {
        return res.status(400).json({ message: "Já existe uma autoescola com este nome" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        email,
        role: "autoescola",
        isActive: true,
      });

      await storage.createDrivingSchool({
        userId: user.id,
        nome: nomeAutoescola,
        cep,
        logradouro,
        numero,
        complemento: complemento || null,
        bairro,
        cidade,
        uf,
        telefone,
        email,
        isActive: true,
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "create",
        entity: "driving_school",
        entityId: user.id,
        details: `Autoescola cadastrada pelo admin: ${nomeAutoescola}`,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Erro ao cadastrar" });
    }
  });

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats(req.user!.id, req.user!.role);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/solicitations/check-cpf/:cpf", requireAuth, requireRole("autoescola"), async (req, res) => {
    try {
      const cpf = req.params.cpf.replace(/\D/g, "");
      const school = await storage.getDrivingSchoolByUserId(req.user!.id);
      
      if (!school) {
        return res.json({ exists: false, differentSchool: false, sameSchool: false });
      }

      const existingConductor = await storage.getConductorByCpf(cpf);
      
      if (!existingConductor) {
        return res.json({ exists: false, differentSchool: false, sameSchool: false });
      }

      const existingSolicitation = await storage.getSolicitationByConductorId(existingConductor.id);
      
      if (existingSolicitation && existingSolicitation.drivingSchoolId !== school.id) {
        return res.json({ exists: true, differentSchool: true, sameSchool: false });
      }

      if (existingSolicitation && existingSolicitation.drivingSchoolId === school.id) {
        return res.json({ exists: true, differentSchool: false, sameSchool: true });
      }

      return res.json({ exists: true, differentSchool: false, sameSchool: false });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/solicitations", requireAuth, async (req, res) => {
    try {
      let filters: any = {};
      
      if (req.user!.role === "autoescola") {
        const school = await storage.getDrivingSchoolByUserId(req.user!.id);
        if (school) {
          filters.drivingSchoolId = school.id;
        }
      }
      
      if (req.query.status) filters.status = req.query.status;
      if (req.query.type) filters.type = req.query.type;

      const solicitations = await storage.getSolicitations(filters);
      res.json(solicitations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/solicitations/:id", requireAuth, async (req, res) => {
    try {
      let solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }
      
      if (req.user!.role === "autoescola") {
        const school = await storage.getDrivingSchoolByUserId(req.user!.id);
        if (!school || solicitation.drivingSchoolId !== school.id) {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }

      // Check if penalty release date has passed and auto-update status
      if (solicitation.status === "aguardando_penalidade" && solicitation.penaltyReleaseDate) {
        const releaseDate = new Date(solicitation.penaltyReleaseDate);
        const now = new Date();
        if (now >= releaseDate) {
          await storage.updateSolicitation(req.params.id, {
            status: "em_analise",
            penaltyReleaseDate: null,
          });
          
          await storage.createChatMessage({
            solicitationId: req.params.id,
            senderId: req.user!.id,
            message: `[SISTEMA] Período de penalidade encerrado. Status alterado automaticamente para Em Análise.`,
          });
          
          // Refetch the updated solicitation
          solicitation = await storage.getSolicitation(req.params.id);
        }
      }

      res.json(solicitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get valid solicitation type enum values from schema
  const validSolicitationTypes = solicitationTypeEnum.enumValues;

  app.post("/api/solicitations", requireAuth, requireRole("autoescola"), async (req, res) => {
    try {
      const school = await storage.getDrivingSchoolByUserId(req.user!.id);
      if (!school) {
        return res.status(400).json({ message: "Autoescola não encontrada" });
      }
      if (!school.isActive) {
        return res.status(403).json({ message: "Autoescola bloqueada" });
      }

      let {
        type, cpf, nomeCompleto, nomeMae, nomePai, nacionalidade, rg, orgaoEmissor,
        ufEmissor, dataNascimento, cidadeNascimento, ufNascimento, cep, tipoLogradouro,
        logradouro, numero, complemento, bairro, cidade, uf, telefone1, dddCelular, telefone2, email,
        documents: documentsList
      } = req.body;

      // Validate solicitation type - if not a valid enum, try to resolve from solicitation_types table
      if (!validSolicitationTypes.includes(type)) {
        // Try to find by ID in solicitation_types table and use its value
        const solicitationType = await storage.getSolicitationType(type);
        if (solicitationType && validSolicitationTypes.includes(solicitationType.value as any)) {
          type = solicitationType.value;
          console.log(`Resolved solicitation type from ID "${solicitationType.id}" to value "${type}"`);
        } else {
          return res.status(400).json({ 
            message: `Requerimento inválido: "${type}". Por favor, selecione um requerimento válido da lista.` 
          });
        }
      }

      // Check if CPF already exists in the system (global uniqueness)
      const existingConductor = await storage.getConductorByCpf(cpf);
      if (existingConductor) {
        return res.status(400).json({ 
          message: "Este CPF já está cadastrado no sistema. Cada CPF só pode ser cadastrado uma única vez." 
        });
      }

      const conductor = await storage.createConductor({
        cpf,
        nomeCompleto,
        nomeMae,
        nomePai: nomePai || null,
        nacionalidade,
        rg,
        orgaoEmissor,
        ufEmissor,
        dataNascimento,
        cidadeNascimento,
        ufNascimento,
        cep,
        tipoLogradouro,
        logradouro,
        numero,
        complemento: complemento || null,
        bairro,
        cidade,
        uf,
        telefone1,
        dddCelular: dddCelular || null,
        telefone2: telefone2 || null,
        email,
      });

      const solicitation = await storage.createSolicitation({
        drivingSchoolId: school.id,
        conductorId: conductor.id,
        type,
        status: "em_analise",
        operadorId: null,
        observacoesInternas: null,
        observacoesExternas: null,
        justificativaReprovacao: null,
      });

      if (documentsList && Array.isArray(documentsList)) {
        for (const doc of documentsList) {
          await storage.createDocument({
            solicitationId: solicitation.id,
            fileName: doc.name,
            fileType: doc.type,
            fileData: doc.data,
            category: doc.category || null,
            isLegible: null,
            isValid: null,
            isCompatible: null,
          });
        }
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "create",
        entity: "solicitation",
        entityId: solicitation.id,
        details: `Requerimento criado: ${type} - ${nomeCompleto}`,
      });

      const fullSolicitation = await storage.getSolicitation(solicitation.id);
      res.status(201).json(fullSolicitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete solicitation (admin only)
  app.delete("/api/solicitations/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }

      const deleted = await storage.deleteSolicitation(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Erro ao excluir solicitação" });
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "delete",
        entity: "solicitation",
        entityId: req.params.id,
        details: `Solicitação excluída: ${solicitation.type} - ${solicitation.conductor?.nomeCompleto}`,
      });

      res.json({ message: "Solicitação excluída com sucesso" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Transfer solicitation to another driving school (admin only)
  app.post("/api/solicitations/:id/transfer", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { newDrivingSchoolId } = req.body;
      
      if (!newDrivingSchoolId) {
        return res.status(400).json({ message: "ID da nova autoescola é obrigatório" });
      }

      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }

      const newDrivingSchool = await storage.getDrivingSchool(newDrivingSchoolId);
      if (!newDrivingSchool) {
        return res.status(404).json({ message: "Autoescola de destino não encontrada" });
      }

      if (solicitation.drivingSchoolId === newDrivingSchoolId) {
        return res.status(400).json({ message: "A solicitação já pertence a esta autoescola" });
      }

      const oldDrivingSchool = solicitation.drivingSchool;
      const updated = await storage.transferSolicitation(req.params.id, newDrivingSchoolId);

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "transfer",
        entity: "solicitation",
        entityId: req.params.id,
        details: `Candidato transferido de "${oldDrivingSchool?.nome}" para "${newDrivingSchool.nome}"`,
      });

      const fullSolicitation = await storage.getSolicitation(req.params.id);
      res.json(fullSolicitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/solicitations/:id/status", requireAuth, requireRole("operador", "admin"), async (req, res) => {
    try {
      const { status, justificativa, observacoesExternas, sendChatNotification, accessGranted } = req.body;
      
      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ message: "Solicitacao nao encontrada" });
      }

      const updateData: any = { status, operadorId: req.user!.id };
      if (justificativa) updateData.justificativaReprovacao = justificativa;
      if (observacoesExternas) updateData.observacoesExternas = observacoesExternas;
      if (accessGranted !== undefined) updateData.accessGranted = accessGranted;

      const updated = await storage.updateSolicitation(req.params.id, updateData);

      const statusLabels: Record<string, string> = {
        "aprovada": "APROVADA",
        "pendente_correcao": "PENDENTE",
        "em_analise": "EM ANALISE",
        "reprovada": "REPROVADA",
        "cadastro_finalizado": "CADASTRO FINALIZADO",
        "aguardando_penalidade": "AGUARDANDO PENALIDADE",
      };

      if (sendChatNotification) {
        const statusLabel = statusLabels[status] || status.toUpperCase();
        let notificationMessage = `[SISTEMA] Status alterado para: ${statusLabel}`;
        if (observacoesExternas) {
          notificationMessage += `\nMotivo: ${observacoesExternas}`;
        }
        await storage.createChatMessage({
          solicitationId: req.params.id,
          senderId: req.user!.id,
          message: notificationMessage,
        });
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "status_change",
        entity: "solicitation",
        entityId: req.params.id,
        details: `Status do requerimento alterado para: ${status}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/solicitations/:id", requireAuth, requireRole("autoescola"), async (req, res) => {
    try {
      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) return res.status(404).json({ message: "Solicitação não encontrada" });
      if (!solicitation.accessGranted) return res.status(403).json({ message: "Acesso negado" });

      const { documents: documentsList, ...conductorData } = req.body;
      
      // Update conductor
      const { id: _, ...conductorUpdateData } = conductorData;
      await db.update(conductors).set(conductorUpdateData).where(eq(conductors.id, solicitation.conductorId));
      
      // Handle documents if any - replace old documents with new ones for each category
      if (documentsList && Array.isArray(documentsList)) {
        for (const doc of documentsList) {
          // Delete old documents in the same category
          if (doc.category) {
            await storage.deleteDocumentsByCategory(solicitation.id, doc.category);
          }
          // Create new document
          await storage.createDocument({
            solicitationId: solicitation.id,
            fileName: doc.name,
            fileType: doc.type,
            fileData: doc.data,
            category: doc.category || null,
            isLegible: null,
            isValid: null,
            isCompatible: null,
          });
        }
      }

      // Update solicitation status back to em_analise and revoke access
      const updated = await storage.updateSolicitation(req.params.id, {
        status: "em_analise",
        accessGranted: false,
        accessRequestedFields: [],
        accessRequestedDocuments: [],
      });

      await storage.createChatMessage({
        solicitationId: solicitation.id,
        senderId: req.user!.id,
        message: `[SISTEMA] Correções enviadas pela autoescola. Requerimento retornou para análise.`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Route for analyzing document with OCR (Gemini AI)
  app.post("/api/documents/analyze", requireAuth, async (req, res) => {
    try {
      if (!isGeminiConfigured()) {
        return res.status(503).json({ 
          error: "Reconhecimento de documentos não configurado",
          message: "A chave GEMINI_API_KEY não está configurada no sistema"
        });
      }

      const { imageBase64, mimeType } = req.body;

      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "Imagem e tipo MIME são obrigatórios" });
      }

      const result = await analyzeDocument(imageBase64, mimeType);
      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing document:", error);
      res.status(500).json({ 
        error: "Falha ao analisar documento", 
        message: error.message 
      });
    }
  });

  // Route to check if OCR is available
  app.get("/api/documents/ocr-status", requireAuth, async (req, res) => {
    res.json({ available: isGeminiConfigured() });
  });

  // Route for requesting presigned URL for document upload
  app.post("/api/documents/request-upload-url", requireAuth, async (req, res) => {
    try {
      const { name, size, contentType, solicitationId, category } = req.body;

      if (!name || !solicitationId) {
        return res.status(400).json({ error: "Nome do arquivo e ID da solicitação são obrigatórios" });
      }

      // Verify user has access to the solicitation
      const solicitation = await storage.getSolicitation(solicitationId);
      if (!solicitation) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      const user = req.user!;
      if (user.role === "autoescola") {
        const school = await storage.getDrivingSchoolByUserId(user.id);
        if (!school || solicitation.drivingSchoolId !== school.id) {
          return res.status(403).json({ error: "Acesso negado" });
        }
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      // Store the pending upload token (expires in 15 minutes)
      pendingUploadTokens.set(objectPath, {
        userId: user.id,
        solicitationId,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType, solicitationId, category },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Falha ao gerar URL de upload" });
    }
  });

  // Route for saving document metadata after upload to object storage
  app.post("/api/documents/save", requireAuth, async (req, res) => {
    try {
      const { solicitationId, fileName, fileType, fileKey, fileSize, category } = req.body;

      if (!solicitationId || !fileName || !fileKey) {
        return res.status(400).json({ error: "Dados obrigatórios não informados" });
      }

      const user = req.user!;

      // Validate the upload token - ensures fileKey was issued by request-upload-url
      const pendingToken = pendingUploadTokens.get(fileKey);
      if (!pendingToken) {
        return res.status(400).json({ error: "Token de upload inválido ou expirado" });
      }
      
      // Validate token ownership and solicitation match
      if (pendingToken.userId !== user.id) {
        return res.status(403).json({ error: "Token de upload não pertence a este usuário" });
      }
      
      if (pendingToken.solicitationId !== solicitationId) {
        return res.status(400).json({ error: "Token de upload não corresponde ao requerimento" });
      }
      
      if (pendingToken.expiresAt < Date.now()) {
        pendingUploadTokens.delete(fileKey);
        return res.status(400).json({ error: "Token de upload expirado" });
      }

      // Remove the token after validation (one-time use)
      pendingUploadTokens.delete(fileKey);

      // Set ACL policy for the uploaded file
      await objectStorageService.trySetObjectEntityAclPolicy(fileKey, {
        owner: user.id,
        visibility: "private",
      });

      const document = await storage.createDocument({
        solicitationId,
        fileName,
        fileType: fileType || "application/octet-stream",
        fileData: null,
        fileKey,
        fileSize: fileSize?.toString() || null,
        category: category || null,
        isLegible: null,
        isValid: null,
        isCompatible: null,
      });

      res.status(201).json(document);
    } catch (error: any) {
      console.error("Error saving document:", error);
      res.status(500).json({ error: error.message || "Falha ao salvar documento" });
    }
  });

  // Route for serving document content (supports both base64 and object storage)
  app.get("/api/documents/:id/download", requireAuth, async (req, res) => {
    try {
      const document = await storage.getDocumentById(req.params.id);

      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      // Verify user has access to this document's solicitation
      const solicitation = await storage.getSolicitation(document.solicitationId);
      if (!solicitation) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      // Check authorization: admin/operador can see all, autoescola only their own
      const user = req.user!;
      if (user.role === "autoescola") {
        const school = await storage.getDrivingSchoolByUserId(user.id);
        if (!school || solicitation.drivingSchoolId !== school.id) {
          return res.status(403).json({ error: "Acesso negado" });
        }
      }

      // If document is in object storage
      if (document.fileKey) {
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(document.fileKey);
          await objectStorageService.downloadObject(objectFile, res);
          return;
        } catch (error) {
          console.error("Error fetching from object storage:", error);
          return res.status(404).json({ error: "Arquivo não encontrado no armazenamento" });
        }
      }

      // If document is in database (base64)
      if (document.fileData) {
        const base64Data = document.fileData.split(",")[1] || document.fileData;
        const buffer = Buffer.from(base64Data, "base64");
        res.set({
          "Content-Type": document.fileType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${document.fileName}"`,
        });
        return res.send(buffer);
      }

      return res.status(404).json({ error: "Conteúdo do documento não disponível" });
    } catch (error: any) {
      console.error("Error downloading document:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload Renach Assinado - only allowed when status is "cadastro_finalizado"
  app.post("/api/solicitations/:id/upload-renach", requireAuth, requireRole("autoescola"), async (req, res) => {
    try {
      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ error: "Requerimento não encontrado" });
      }

      // Verify the autoescola owns this solicitation
      const school = await storage.getDrivingSchoolByUserId(req.user!.id);
      if (!school || solicitation.drivingSchoolId !== school.id) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      // Only allow upload when status is "cadastro_finalizado"
      if (solicitation.status !== "cadastro_finalizado") {
        return res.status(400).json({ 
          error: "O Renach Assinado só pode ser anexado quando o status for 'Cadastro Finalizado'" 
        });
      }

      // Check if renach_assinado already exists - if so, require access permission
      const existingDocs = await storage.getDocuments(req.params.id);
      const existingRenach = existingDocs.find(d => d.category === "renach_assinado");
      
      if (existingRenach) {
        // Renach already uploaded - require access granted with renach_assinado in requested documents
        const hasRenachAccess = solicitation.accessGranted && 
          solicitation.accessRequestedDocuments?.includes("renach_assinado");
        
        if (!hasRenachAccess) {
          return res.status(403).json({ 
            error: "Para substituir o Renach Assinado, é necessário solicitar acesso para correção e aguardar aprovação do operador/admin.",
            needsAccessRequest: true
          });
        }
      }

      const { fileName, fileType, fileData } = req.body;
      if (!fileName || !fileData) {
        return res.status(400).json({ error: "Nome do arquivo e dados são obrigatórios" });
      }

      // Validate file type
      const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
      if (fileType && !allowedTypes.includes(fileType.toLowerCase())) {
        return res.status(400).json({ 
          error: "Tipo de arquivo não permitido. Apenas PDF, JPG e PNG são aceitos." 
        });
      }

      // Validate file size (max 5MB - base64 is ~33% larger than binary)
      const maxBase64Size = 5 * 1024 * 1024 * 1.4; // ~7MB for 5MB file in base64
      if (fileData.length > maxBase64Size) {
        return res.status(400).json({ 
          error: "Arquivo muito grande. O tamanho máximo é 5MB." 
        });
      }

      const isReplacement = !!existingRenach;

      // Delete any existing renach_assinado documents for this solicitation
      await storage.deleteDocumentsByCategory(req.params.id, "renach_assinado");

      // Create the new document
      const document = await storage.createDocument({
        solicitationId: req.params.id,
        fileName,
        fileType: fileType || "application/octet-stream",
        fileData,
        fileKey: null,
        fileSize: null,
        category: "renach_assinado",
        isLegible: null,
        isValid: null,
        isCompatible: null,
      });

      // If this was a replacement with access, revoke access for renach
      if (isReplacement && solicitation.accessGranted) {
        const remainingDocs = (solicitation.accessRequestedDocuments || []).filter(d => d !== "renach_assinado");
        const remainingFields = solicitation.accessRequestedFields || [];
        
        // If no more docs/fields to edit, revoke access entirely
        if (remainingDocs.length === 0 && remainingFields.length === 0) {
          await storage.updateSolicitation(req.params.id, {
            accessGranted: false,
            accessRequestedDocuments: [],
            accessRequestedFields: [],
          });
        } else {
          // Just remove renach from the list
          await storage.updateSolicitation(req.params.id, {
            accessRequestedDocuments: remainingDocs,
          });
        }
      }

      // Add system message to chat notifying operador/admin
      const chatMessage = isReplacement 
        ? `[SISTEMA] Renach Assinado SUBSTITUÍDO pela autoescola "${school.nome}". Favor verificar o novo documento.`
        : `[SISTEMA] Renach Assinado anexado pela autoescola "${school.nome}". Favor verificar o documento.`;
      
      await storage.createChatMessage({
        solicitationId: req.params.id,
        senderId: req.user!.id,
        message: chatMessage,
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "upload",
        entity: "document",
        entityId: document.id,
        details: isReplacement 
          ? `Renach Assinado substituído no requerimento` 
          : `Renach Assinado anexado ao requerimento`,
      });

      res.status(201).json(document);
    } catch (error: any) {
      console.error("Error uploading renach:", error);
      res.status(500).json({ error: error.message || "Falha ao anexar Renach Assinado" });
    }
  });

  // Verify document authenticity (operador/admin only)
  app.post("/api/documents/:id/verify-authenticity", requireAuth, requireRole("operador", "admin"), async (req, res) => {
    try {
      if (!isGeminiConfigured()) {
        return res.status(503).json({ 
          error: "Verificação de autenticidade não configurada",
          message: "A chave GEMINI_API_KEY não está configurada no sistema"
        });
      }

      const document = await storage.getDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      let imageBase64: string | null = null;
      let fileBuffer: Buffer | null = null;
      let mimeType = document.fileType || "image/jpeg";
      let pdfMetadata: PdfMetadata | undefined;

      // Get document content from object storage or base64
      if (document.fileKey) {
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(document.fileKey);
          const chunks: Buffer[] = [];
          for await (const chunk of objectFile.createReadStream()) {
            chunks.push(Buffer.from(chunk));
          }
          fileBuffer = Buffer.concat(chunks);
          imageBase64 = fileBuffer.toString("base64");
        } catch (error) {
          console.error("Error fetching from object storage:", error);
          return res.status(404).json({ error: "Arquivo não encontrado no armazenamento" });
        }
      } else if (document.fileData) {
        const base64Data = document.fileData.split(",")[1] || document.fileData;
        imageBase64 = base64Data;
        fileBuffer = Buffer.from(base64Data, "base64");
      }

      if (!imageBase64 || !fileBuffer) {
        return res.status(404).json({ error: "Conteúdo do documento não disponível" });
      }

      // Extract PDF metadata if the document is a PDF
      if (mimeType === "application/pdf") {
        try {
          pdfMetadata = await extractPdfMetadata(fileBuffer);
          console.log("PDF metadata extracted:", pdfMetadata);
        } catch (error) {
          console.error("Error extracting PDF metadata:", error);
          // Continue without metadata
        }
      }

      const result = await analyzeDocumentAuthenticity(imageBase64, mimeType, pdfMetadata);
      
      // Log the authenticity check
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "verify_authenticity",
        entity: "document",
        entityId: req.params.id,
        details: JSON.stringify({ 
          nivelRisco: result.nivelRisco, 
          recomendacao: result.recomendacao,
          pontuacaoConfianca: result.pontuacaoConfianca
        }),
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error verifying document authenticity:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Analyze document visual quality (automatic for ID documents)
  app.post("/api/documents/:id/analyze-visual-quality", requireAuth, async (req, res) => {
    try {
      if (!isGeminiConfigured()) {
        return res.status(503).json({ 
          error: "Análise visual não configurada",
          message: "A chave GEMINI_API_KEY não está configurada no sistema"
        });
      }

      const document = await storage.getDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      // Authorization check: only operador and admin can trigger visual analysis
      const user = req.user!;
      if (user.role !== "admin" && user.role !== "operador") {
        return res.status(403).json({ error: "Apenas operadores e administradores podem realizar análise visual" });
      }
      
      const solicitation = await storage.getSolicitation(document.solicitationId);
      if (!solicitation) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }

      // Only analyze "documento_identificacao" category
      if (document.category !== "documento_identificacao") {
        return res.status(400).json({ 
          error: "Análise visual automática disponível apenas para Documento de Identificação" 
        });
      }

      let imageBase64: string | null = null;
      let mimeType = document.fileType || "image/jpeg";

      // Get document content from object storage or base64
      if (document.fileKey) {
        try {
          const objectFile = await objectStorageService.getObjectEntityFile(document.fileKey);
          const chunks: Buffer[] = [];
          for await (const chunk of objectFile.createReadStream()) {
            chunks.push(Buffer.from(chunk));
          }
          imageBase64 = Buffer.concat(chunks).toString("base64");
        } catch (error) {
          console.error("Error fetching from object storage:", error);
          return res.status(404).json({ error: "Arquivo não encontrado no armazenamento" });
        }
      } else if (document.fileData) {
        imageBase64 = document.fileData.split(",")[1] || document.fileData;
      }

      if (!imageBase64) {
        return res.status(404).json({ error: "Conteúdo do documento não disponível" });
      }

      const result = await analyzeDocumentVisualQuality(imageBase64, mimeType);
      
      // Log the visual quality analysis
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "analyze_visual_quality",
        entity: "document",
        entityId: req.params.id,
        details: JSON.stringify({ 
          avaliacaoGeral: result.avaliacaoGeral, 
          conservacao: result.conservacao.status,
          nitidez: result.nitidez.status
        }),
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error analyzing document visual quality:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/solicitations/:id/messages", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.id);
      await storage.markMessagesAsRead(req.params.id, req.user!.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/unread-counts", requireAuth, async (req, res) => {
    try {
      const counts = await storage.getUnreadCounts(req.user!.id);
      res.json(counts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/solicitations/:id/mark-read", requireAuth, async (req, res) => {
    try {
      await storage.markMessagesAsRead(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/solicitations/:id/messages", requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      
      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }

      if (solicitation.status === "aprovada" || solicitation.status === "reprovada") {
        return res.status(400).json({ message: "Solicitação finalizada, chat bloqueado" });
      }

      const chatMessage = await storage.createChatMessage({
        solicitationId: req.params.id,
        senderId: req.user!.id,
        message,
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "message",
        entity: "chat_message",
        entityId: chatMessage.id,
        details: `Mensagem enviada na solicitação ${req.params.id}`,
      });

      broadcastToSolicitation(req.params.id, { type: "new_message", message: chatMessage });

      res.status(201).json(chatMessage);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/solicitations/:id/request-access", requireAuth, requireRole("autoescola"), async (req, res) => {
    try {
      const { fields, documents } = req.body;
      
      const accessRequest = await storage.createAccessRequest({
        solicitationId: req.params.id,
        requestedByUserId: req.user!.id,
        fields: fields || [],
        documents: documents || [],
        status: "pending",
      });

      await storage.updateSolicitation(req.params.id, {
        accessRequestedFields: fields,
        accessRequestedDocuments: documents,
        accessGranted: false
      });
      
      const labels: Record<string, string> = {
        nomeCompleto: "Nome Completo",
        nomeMae: "Nome da Mãe",
        nomePai: "Nome do Pai",
        nacionalidade: "Nacionalidade",
        dataNascimento: "Data de Nascimento",
        cidadeNascimento: "Cidade de Nascimento",
        ufNascimento: "UF Nascimento",
        rg: "RG/Órgão",
        endereco: "Endereço",
        telefone1: "Telefone 1",
        telefone2: "Telefone 2",
        dddCelular: "DDD Telefone Celular",
        email: "E-mail",
        renach_assinado: "Renach Assinado",
        documento_identificacao: "Documento de Identificação",
        comprovante_residencia: "Comprovante de Residência",
        outros: "Outros Documentos/Declarações"
      };

      const fieldLabels = (fields || []).map((f: string) => labels[f] || f);
      const docLabels = (documents || []).map((d: string) => labels[d] || d);

      await storage.createChatMessage({
        solicitationId: req.params.id,
        senderId: req.user!.id,
        message: `[PEDIDO DE ACESSO] A autoescola solicitou acesso para corrigir campos (${fieldLabels.join(", ")}) e anexos (${docLabels.join(", ")})`,
      });

      res.json(accessRequest);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Set penalty release date
  app.patch("/api/solicitations/:id/penalty", requireAuth, requireRole("operador", "admin"), async (req, res) => {
    try {
      const { penaltyReleaseDate } = req.body;
      
      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }

      const releaseDate = new Date(penaltyReleaseDate);
      
      const updated = await storage.updateSolicitation(req.params.id, {
        status: "aguardando_penalidade",
        penaltyReleaseDate: releaseDate,
      });

      const formattedDate = releaseDate.toLocaleDateString("pt-BR");
      
      await storage.createChatMessage({
        solicitationId: req.params.id,
        senderId: req.user!.id,
        message: `[SISTEMA] Status alterado para: AGUARDANDO PENALIDADE\nData de Liberação: ${formattedDate}`,
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "set_penalty",
        entity: "solicitation",
        entityId: req.params.id,
        details: `Status alterado para aguardando_penalidade. Data de liberação: ${formattedDate}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/solicitations/:id/access-requests", requireAuth, async (req, res) => {
    try {
      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }

      if (req.user!.role === "autoescola") {
        const school = await storage.getDrivingSchoolByUserId(req.user!.id);
        if (!school || solicitation.drivingSchoolId !== school.id) {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }

      const requests = await storage.getAccessRequests(req.params.id);
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/access-requests/:id/approve", requireAuth, requireRole("operador", "admin"), async (req, res) => {
    try {
      const existingRequest = await storage.getAccessRequest(req.params.id);
      if (!existingRequest) {
        return res.status(404).json({ message: "Pedido de acesso não encontrado" });
      }
      
      if (existingRequest.status !== "pending") {
        return res.status(400).json({ message: "Este pedido já foi processado" });
      }

      const updated = await storage.updateAccessRequest(req.params.id, {
        status: "approved",
        decidedByUserId: req.user!.id,
        decidedAt: new Date(),
      });

      if (!updated) {
        return res.status(404).json({ message: "Pedido de acesso não encontrado" });
      }

      // Get solicitation to check if status needs to change
      const solicitation = await storage.getSolicitation(updated.solicitationId);
      const updateData: any = { accessGranted: true };
      
      // If status is cadastro_finalizado, change to em_analise
      if (solicitation && solicitation.status === "cadastro_finalizado") {
        updateData.status = "em_analise";
      }

      await storage.updateSolicitation(updated.solicitationId, updateData);

      let chatMessage = `[ACESSO APROVADO] O pedido de acesso para correção foi aprovado.`;
      if (solicitation && solicitation.status === "cadastro_finalizado") {
        chatMessage += ` Status alterado para Em Análise.`;
      }

      await storage.createChatMessage({
        solicitationId: updated.solicitationId,
        senderId: req.user!.id,
        message: chatMessage,
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "approve_access_request",
        entity: "access_request",
        entityId: req.params.id,
        details: `Pedido de acesso aprovado para solicitação ${updated.solicitationId}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/access-requests/:id/reject", requireAuth, requireRole("operador", "admin"), async (req, res) => {
    try {
      const { reason } = req.body;
      
      if (!reason || reason.trim() === "") {
        return res.status(400).json({ message: "Motivo da rejeição é obrigatório" });
      }

      const existingRequest = await storage.getAccessRequest(req.params.id);
      if (!existingRequest) {
        return res.status(404).json({ message: "Pedido de acesso não encontrado" });
      }
      
      if (existingRequest.status !== "pending") {
        return res.status(400).json({ message: "Este pedido já foi processado" });
      }

      const updated = await storage.updateAccessRequest(req.params.id, {
        status: "rejected",
        rejectionReason: reason,
        decidedByUserId: req.user!.id,
        decidedAt: new Date(),
      });

      if (!updated) {
        return res.status(404).json({ message: "Pedido de acesso não encontrado" });
      }

      await storage.createChatMessage({
        solicitationId: updated.solicitationId,
        senderId: req.user!.id,
        message: `[ACESSO NEGADO] O pedido de acesso para correção foi negado. Motivo: ${reason}`,
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "reject_access_request",
        entity: "access_request",
        entityId: req.params.id,
        details: `Pedido de acesso rejeitado para solicitação ${updated.solicitationId}. Motivo: ${reason}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/solicitations/:id/documents", requireAuth, async (req, res) => {
    try {
      const documents = await storage.getDocuments(req.params.id);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/documents/:id", requireAuth, requireRole("operador", "admin"), async (req, res) => {
    try {
      const { isLegible, isValid, isCompatible } = req.body;
      const updated = await storage.updateDocument(req.params.id, { isLegible, isValid, isCompatible });
      
      if (!updated) {
        return res.status(404).json({ message: "Documento não encontrado" });
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "update",
        entity: "document",
        entityId: req.params.id,
        details: `Documento atualizado: legível=${isLegible}, válido=${isValid}, compatível=${isCompatible}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/driving-schools", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const schools = await storage.getDrivingSchools();
      res.json(schools);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/driving-schools/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { isActive } = req.body;
      const updated = await storage.updateDrivingSchool(req.params.id, { isActive });
      
      if (!updated) {
        return res.status(404).json({ message: "Autoescola não encontrada" });
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "update",
        entity: "driving_school",
        entityId: req.params.id,
        details: `Autoescola ${isActive ? "desbloqueada" : "bloqueada"}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPassword = users.map(({ password, ...u }) => u);
      res.json(usersWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { username, password, name, email, role } = req.body;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Usuário já existe" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        name,
        email,
        role,
        isActive: true,
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "create",
        entity: "user",
        entityId: user.id,
        details: `Usuário criado: ${username} (${role})`,
      });

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { isActive } = req.body;
      const updated = await storage.updateUser(req.params.id, { isActive });
      
      if (!updated) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "update",
        entity: "user",
        entityId: req.params.id,
        details: `Usuário ${isActive ? "desbloqueado" : "bloqueado"}`,
      });

      const { password, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/audit-logs", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const period = parseInt(req.query.period as string) || 30;
      const stats = await storage.getReportStats(period);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/solicitation-types", requireAuth, async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly === "true";
      const types = await storage.getSolicitationTypes(activeOnly);
      res.json(types);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/solicitation-types", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { value, label, isActive, sortOrder } = req.body;
      const type = await storage.createSolicitationType({ value, label, isActive: isActive ?? true, sortOrder: sortOrder ?? "0" });
      
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "create",
        entity: "solicitation_type",
        entityId: type.id,
        details: `Requerimento "${label}" criado`,
      });
      
      res.status(201).json(type);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/solicitation-types/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { value, label, isActive, sortOrder } = req.body;
      const updateData: any = {};
      if (value !== undefined) updateData.value = value;
      if (label !== undefined) updateData.label = label;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      
      const type = await storage.updateSolicitationType(req.params.id, updateData);
      
      if (!type) {
        return res.status(404).json({ message: "Tipo não encontrado" });
      }
      
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "update",
        entity: "solicitation_type",
        entityId: req.params.id,
        details: `Requerimento "${type.label}" atualizado`,
      });
      
      res.json(type);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/solicitation-types/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const type = await storage.getSolicitationType(req.params.id);
      if (!type) {
        return res.status(404).json({ message: "Tipo não encontrado" });
      }
      
      const deleted = await storage.deleteSolicitationType(req.params.id);
      
      if (deleted) {
        await storage.createAuditLog({
          userId: req.user!.id,
          action: "delete",
          entity: "solicitation_type",
          entityId: req.params.id,
          details: `Requerimento "${type.label}" removido`,
        });
      }
      
      res.json({ success: deleted });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
