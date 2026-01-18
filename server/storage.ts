import {
  users, drivingSchools, conductors, solicitations, documents, chatMessages, auditLogs, requiredDocuments,
  type User, type InsertUser, type DrivingSchool, type InsertDrivingSchool,
  type Conductor, type InsertConductor, type Solicitation, type InsertSolicitation,
  type Document, type InsertDocument, type ChatMessage, type InsertChatMessage,
  type AuditLog, type InsertAuditLog, type RequiredDocument, type InsertRequiredDocument,
  type SolicitationWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

  getDrivingSchool(id: string): Promise<DrivingSchool | undefined>;
  getDrivingSchoolByUserId(userId: string): Promise<DrivingSchool | undefined>;
  getDrivingSchools(): Promise<DrivingSchool[]>;
  createDrivingSchool(data: InsertDrivingSchool): Promise<DrivingSchool>;
  updateDrivingSchool(id: string, data: Partial<InsertDrivingSchool>): Promise<DrivingSchool | undefined>;

  getConductor(id: string): Promise<Conductor | undefined>;
  createConductor(data: InsertConductor): Promise<Conductor>;

  getSolicitation(id: string): Promise<SolicitationWithDetails | undefined>;
  getSolicitations(filters?: { drivingSchoolId?: string; status?: string; type?: string }): Promise<SolicitationWithDetails[]>;
  createSolicitation(data: InsertSolicitation): Promise<Solicitation>;
  updateSolicitation(id: string, data: Partial<InsertSolicitation>): Promise<Solicitation | undefined>;

  getDocuments(solicitationId: string): Promise<Document[]>;
  createDocument(data: InsertDocument): Promise<Document>;
  updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined>;

  getChatMessages(solicitationId: string): Promise<ChatMessage[]>;
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;

  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(): Promise<AuditLog[]>;

  getRequiredDocuments(solicitationType?: string): Promise<RequiredDocument[]>;
  createRequiredDocument(data: InsertRequiredDocument): Promise<RequiredDocument>;

  getDashboardStats(userId?: string, role?: string): Promise<any>;
  getReportStats(period: number): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getDrivingSchool(id: string): Promise<DrivingSchool | undefined> {
    const [school] = await db.select().from(drivingSchools).where(eq(drivingSchools.id, id));
    return school || undefined;
  }

  async getDrivingSchoolByUserId(userId: string): Promise<DrivingSchool | undefined> {
    const [school] = await db.select().from(drivingSchools).where(eq(drivingSchools.userId, userId));
    return school || undefined;
  }

  async getDrivingSchools(): Promise<DrivingSchool[]> {
    return db.select().from(drivingSchools).orderBy(desc(drivingSchools.createdAt));
  }

  async createDrivingSchool(data: InsertDrivingSchool): Promise<DrivingSchool> {
    const [school] = await db.insert(drivingSchools).values(data).returning();
    return school;
  }

  async updateDrivingSchool(id: string, data: Partial<InsertDrivingSchool>): Promise<DrivingSchool | undefined> {
    const [school] = await db.update(drivingSchools).set(data).where(eq(drivingSchools.id, id)).returning();
    return school || undefined;
  }

  async getConductor(id: string): Promise<Conductor | undefined> {
    const [conductor] = await db.select().from(conductors).where(eq(conductors.id, id));
    return conductor || undefined;
  }

  async createConductor(data: InsertConductor): Promise<Conductor> {
    const [conductor] = await db.insert(conductors).values(data).returning();
    return conductor;
  }

  async getSolicitation(id: string): Promise<SolicitationWithDetails | undefined> {
    const [solicitation] = await db.select().from(solicitations).where(eq(solicitations.id, id));
    if (!solicitation) return undefined;

    const [drivingSchool] = await db.select().from(drivingSchools).where(eq(drivingSchools.id, solicitation.drivingSchoolId));
    const [conductor] = await db.select().from(conductors).where(eq(conductors.id, solicitation.conductorId));
    const docs = await db.select().from(documents).where(eq(documents.solicitationId, id));
    let operador: User | null = null;
    if (solicitation.operadorId) {
      const [op] = await db.select().from(users).where(eq(users.id, solicitation.operadorId));
      operador = op || null;
    }

    return {
      ...solicitation,
      drivingSchool: drivingSchool!,
      conductor: conductor!,
      documents: docs,
      operador,
    };
  }

  async getSolicitations(filters?: { drivingSchoolId?: string; status?: string; type?: string }): Promise<SolicitationWithDetails[]> {
    let query = db.select().from(solicitations).orderBy(desc(solicitations.createdAt));

    const solicitationsList = await query;
    const result: SolicitationWithDetails[] = [];

    for (const s of solicitationsList) {
      if (filters?.drivingSchoolId && s.drivingSchoolId !== filters.drivingSchoolId) continue;
      if (filters?.status && s.status !== filters.status) continue;
      if (filters?.type && s.type !== filters.type) continue;

      const [drivingSchool] = await db.select().from(drivingSchools).where(eq(drivingSchools.id, s.drivingSchoolId));
      const [conductor] = await db.select().from(conductors).where(eq(conductors.id, s.conductorId));
      const docs = await db.select().from(documents).where(eq(documents.solicitationId, s.id));
      let operador: User | null = null;
      if (s.operadorId) {
        const [op] = await db.select().from(users).where(eq(users.id, s.operadorId));
        operador = op || null;
      }

      result.push({
        ...s,
        drivingSchool: drivingSchool!,
        conductor: conductor!,
        documents: docs,
        operador,
      });
    }

    return result;
  }

  async createSolicitation(data: InsertSolicitation): Promise<Solicitation> {
    const [solicitation] = await db.insert(solicitations).values(data).returning();
    return solicitation;
  }

  async updateSolicitation(id: string, data: Partial<InsertSolicitation>): Promise<Solicitation | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [solicitation] = await db.update(solicitations).set(updateData).where(eq(solicitations.id, id)).returning();
    return solicitation || undefined;
  }

  async getDocuments(solicitationId: string): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.solicitationId, solicitationId));
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const [doc] = await db.update(documents).set(data).where(eq(documents.id, id)).returning();
    return doc || undefined;
  }

  async getChatMessages(solicitationId: string): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.solicitationId, solicitationId)).orderBy(chatMessages.createdAt);
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db.insert(chatMessages).values(data).returning();
    return message;
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(500);
    const result = [];
    for (const log of logs) {
      const [user] = await db.select().from(users).where(eq(users.id, log.userId));
      result.push({ ...log, user });
    }
    return result;
  }

  async getRequiredDocuments(solicitationType?: string): Promise<RequiredDocument[]> {
    if (solicitationType) {
      return db.select().from(requiredDocuments).where(eq(requiredDocuments.solicitationType, solicitationType as any));
    }
    return db.select().from(requiredDocuments);
  }

  async createRequiredDocument(data: InsertRequiredDocument): Promise<RequiredDocument> {
    const [doc] = await db.insert(requiredDocuments).values(data).returning();
    return doc;
  }

  async getDashboardStats(userId?: string, role?: string): Promise<any> {
    let allSolicitations = await db.select().from(solicitations);
    
    if (role === "autoescola" && userId) {
      const school = await this.getDrivingSchoolByUserId(userId);
      if (school) {
        allSolicitations = allSolicitations.filter(s => s.drivingSchoolId === school.id);
      }
    }

    const total = allSolicitations.length;
    const emAnalise = allSolicitations.filter(s => s.status === "em_analise").length;
    const pendentes = allSolicitations.filter(s => s.status === "pendente_correcao").length;
    const aprovadas = allSolicitations.filter(s => s.status === "aprovada").length;
    const reprovadas = allSolicitations.filter(s => s.status === "reprovada").length;

    const schoolsCount = (await db.select().from(drivingSchools)).length;
    const operadoresCount = (await db.select().from(users).where(eq(users.role, "operador"))).length;

    return {
      total,
      emAnalise,
      pendentes,
      aprovadas,
      reprovadas,
      autoescolas: schoolsCount,
      operadores: operadoresCount,
    };
  }

  async getReportStats(period: number): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const allSolicitations = await db.select().from(solicitations).where(gte(solicitations.createdAt, startDate));

    const byStatus = {
      em_analise: allSolicitations.filter(s => s.status === "em_analise").length,
      pendente_correcao: allSolicitations.filter(s => s.status === "pendente_correcao").length,
      aprovada: allSolicitations.filter(s => s.status === "aprovada").length,
      reprovada: allSolicitations.filter(s => s.status === "reprovada").length,
    };

    const byType = {
      novo_cadastro: allSolicitations.filter(s => s.type === "novo_cadastro").length,
      alteracao_dados: allSolicitations.filter(s => s.type === "alteracao_dados").length,
      atualizacao: allSolicitations.filter(s => s.type === "atualizacao").length,
      regularizacao: allSolicitations.filter(s => s.type === "regularizacao").length,
    };

    const schoolIds = [...new Set(allSolicitations.map(s => s.drivingSchoolId))];
    const bySchool: { name: string; count: number }[] = [];
    for (const schoolId of schoolIds) {
      const school = await this.getDrivingSchool(schoolId);
      if (school) {
        bySchool.push({
          name: school.nomeFantasia,
          count: allSolicitations.filter(s => s.drivingSchoolId === schoolId).length,
        });
      }
    }
    bySchool.sort((a, b) => b.count - a.count);

    return {
      totalSolicitations: allSolicitations.length,
      byStatus,
      byType,
      bySchool,
      averageAnalysisTime: 2,
    };
  }
}

export const storage = new DatabaseStorage();
