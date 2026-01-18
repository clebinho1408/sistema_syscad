import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireRole, hashPassword } from "./auth";
import passport from "passport";
import { WebSocketServer, WebSocket } from "ws";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Map<string, Set<WebSocket>>();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const solicitationId = url.searchParams.get("solicitationId");
    
    if (solicitationId) {
      if (!clients.has(solicitationId)) {
        clients.set(solicitationId, new Set());
      }
      clients.get(solicitationId)!.add(ws);

      ws.on("close", () => {
        clients.get(solicitationId)?.delete(ws);
      });
    }
  });

  function broadcastToSolicitation(solicitationId: string, message: any) {
    const solicitationClients = clients.get(solicitationId);
    if (solicitationClients) {
      const data = JSON.stringify(message);
      solicitationClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  }

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Falha na autenticação" });
      }
      req.login(user, async (err) => {
        if (err) return next(err);
        
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

  app.post("/api/auth/register", async (req, res) => {
    try {
      const {
        username, password, name, email,
        cnpj, razaoSocial, nomeFantasia, cep, logradouro, numero,
        complemento, bairro, cidade, uf, responsavelLegal, telefone
      } = req.body;

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
        role: "autoescola",
        isActive: true,
      });

      await storage.createDrivingSchool({
        userId: user.id,
        cnpj,
        razaoSocial,
        nomeFantasia,
        cep,
        logradouro,
        numero,
        complemento: complemento || null,
        bairro,
        cidade,
        uf,
        responsavelLegal,
        telefone,
        email,
        isActive: true,
      });

      await storage.createAuditLog({
        userId: user.id,
        action: "create",
        entity: "driving_school",
        entityId: user.id,
        details: `Autoescola cadastrada: ${nomeFantasia}`,
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

      res.json(solicitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/solicitations", requireAuth, requireRole("autoescola"), async (req, res) => {
    try {
      const school = await storage.getDrivingSchoolByUserId(req.user!.id);
      if (!school) {
        return res.status(400).json({ message: "Autoescola não encontrada" });
      }
      if (!school.isActive) {
        return res.status(403).json({ message: "Autoescola bloqueada" });
      }

      const {
        type, cpf, nomeCompleto, nomeMae, nomePai, nacionalidade, rg, orgaoEmissor,
        ufEmissor, dataNascimento, cidadeNascimento, ufNascimento, cep, tipoLogradouro,
        logradouro, numero, complemento, bairro, cidade, uf, telefone1, telefone2, email,
        documents: documentsList
      } = req.body;

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
        details: `Solicitação criada: ${type} - ${nomeCompleto}`,
      });

      const fullSolicitation = await storage.getSolicitation(solicitation.id);
      res.status(201).json(fullSolicitation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/solicitations/:id/status", requireAuth, requireRole("operador", "admin"), async (req, res) => {
    try {
      const { status, justificativa, observacoesExternas } = req.body;
      
      const solicitation = await storage.getSolicitation(req.params.id);
      if (!solicitation) {
        return res.status(404).json({ message: "Solicitação não encontrada" });
      }

      const updateData: any = { status, operadorId: req.user!.id };
      if (justificativa) updateData.justificativaReprovacao = justificativa;
      if (observacoesExternas) updateData.observacoesExternas = observacoesExternas;

      const updated = await storage.updateSolicitation(req.params.id, updateData);

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "status_change",
        entity: "solicitation",
        entityId: req.params.id,
        details: `Status alterado para: ${status}`,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/solicitations/:id/messages", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getChatMessages(req.params.id);
      res.json(messages);
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

  return httpServer;
}
