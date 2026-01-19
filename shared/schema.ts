import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["autoescola", "operador", "admin"]);
export const solicitationStatusEnum = pgEnum("solicitation_status", ["em_analise", "pendente_correcao", "aprovada", "reprovada"]);
export const solicitationTypeEnum = pgEnum("solicitation_type", ["novo_cadastro", "alteracao_dados", "atualizacao", "regularizacao"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: userRoleEnum("role").notNull().default("autoescola"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const drivingSchools = pgTable("driving_schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  nome: text("nome").notNull().unique(),
  cep: text("cep").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  bairro: text("bairro").notNull(),
  cidade: text("cidade").notNull(),
  uf: text("uf").notNull(),
  telefone: text("telefone").notNull(),
  email: text("email").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conductors = pgTable("conductors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cpf: text("cpf").notNull(),
  nomeCompleto: text("nome_completo").notNull(),
  nomeSocial: text("nome_social"),
  filiacaoAfetiva1: text("filiacao_afetiva_1"),
  filiacaoAfetiva2: text("filiacao_afetiva_2"),
  sexo: text("sexo"),
  nomeMae: text("nome_mae").notNull(),
  nomePai: text("nome_pai"),
  nacionalidade: text("nacionalidade").notNull(),
  tipoDocumento: text("tipo_documento"),
  rg: text("rg").notNull(),
  orgaoEmissor: text("orgao_emissor").notNull(),
  ufEmissor: text("uf_emissor").notNull(),
  dataNascimento: text("data_nascimento").notNull(),
  ufNascimento: text("uf_nascimento").notNull(),
  cidadeNascimento: text("cidade_nascimento").notNull(),
  cep: text("cep").notNull(),
  tipoLogradouro: text("tipo_logradouro").notNull(),
  logradouro: text("logradouro").notNull(),
  numero: text("numero").notNull(),
  complemento: text("complemento"),
  bairro: text("bairro").notNull(),
  uf: text("uf").notNull(),
  cidade: text("cidade").notNull(),
  telefone1: text("telefone1").notNull(),
  dddCelular: text("ddd_celular"),
  telefone2: text("telefone2"),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const solicitations = pgTable("solicitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  drivingSchoolId: varchar("driving_school_id").notNull().references(() => drivingSchools.id),
  conductorId: varchar("conductor_id").notNull().references(() => conductors.id),
  type: solicitationTypeEnum("type").notNull(),
  status: solicitationStatusEnum("status").notNull().default("em_analise"),
  operadorId: varchar("operador_id").references(() => users.id),
  observacoesInternas: text("observacoes_internas"),
  observacoesExternas: text("observacoes_externas"),
  justificativaReprovacao: text("justificativa_reprovacao"),
  accessRequestedFields: text("access_requested_fields").array(),
  accessRequestedDocuments: text("access_requested_documents").array(),
  accessGranted: boolean("access_granted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  solicitationId: varchar("solicitation_id").notNull().references(() => solicitations.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileData: text("file_data").notNull(),
  isLegible: boolean("is_legible"),
  isValid: boolean("is_valid"),
  isCompatible: boolean("is_compatible"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  solicitationId: varchar("solicitation_id").notNull().references(() => solicitations.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: varchar("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const requiredDocuments = pgTable("required_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  solicitationType: solicitationTypeEnum("solicitation_type").notNull(),
  documentName: text("document_name").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  drivingSchool: one(drivingSchools, {
    fields: [users.id],
    references: [drivingSchools.userId],
  }),
  chatMessages: many(chatMessages),
  auditLogs: many(auditLogs),
  assignedSolicitations: many(solicitations),
}));

export const drivingSchoolsRelations = relations(drivingSchools, ({ one, many }) => ({
  user: one(users, {
    fields: [drivingSchools.userId],
    references: [users.id],
  }),
  solicitations: many(solicitations),
}));

export const solicitationsRelations = relations(solicitations, ({ one, many }) => ({
  drivingSchool: one(drivingSchools, {
    fields: [solicitations.drivingSchoolId],
    references: [drivingSchools.id],
  }),
  conductor: one(conductors, {
    fields: [solicitations.conductorId],
    references: [conductors.id],
  }),
  operador: one(users, {
    fields: [solicitations.operadorId],
    references: [users.id],
  }),
  documents: many(documents),
  chatMessages: many(chatMessages),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  solicitation: one(solicitations, {
    fields: [documents.solicitationId],
    references: [solicitations.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  solicitation: one(solicitations, {
    fields: [chatMessages.solicitationId],
    references: [solicitations.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertDrivingSchoolSchema = createInsertSchema(drivingSchools).omit({ id: true, createdAt: true });
export const insertConductorSchema = createInsertSchema(conductors).omit({ id: true, createdAt: true });
export const insertSolicitationSchema = createInsertSchema(solicitations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertRequiredDocumentSchema = createInsertSchema(requiredDocuments).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertDrivingSchool = z.infer<typeof insertDrivingSchoolSchema>;
export type DrivingSchool = typeof drivingSchools.$inferSelect;
export type InsertConductor = z.infer<typeof insertConductorSchema>;
export type Conductor = typeof conductors.$inferSelect;
export type InsertSolicitation = z.infer<typeof insertSolicitationSchema>;
export type Solicitation = typeof solicitations.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertRequiredDocument = z.infer<typeof insertRequiredDocumentSchema>;
export type RequiredDocument = typeof requiredDocuments.$inferSelect;

export const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const registerAutoescolaSchema = insertUserSchema.extend({
  cnpj: z.string().min(14, "CNPJ inválido"),
  razaoSocial: z.string().min(1, "Razão Social é obrigatória"),
  nomeFantasia: z.string().min(1, "Nome Fantasia é obrigatório"),
  cep: z.string().min(8, "CEP inválido"),
  logradouro: z.string().min(1, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional(),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  uf: z.string().min(2, "UF é obrigatória"),
  responsavelLegal: z.string().min(1, "Responsável Legal é obrigatório"),
  telefone: z.string().min(10, "Telefone inválido"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterAutoescolaInput = z.infer<typeof registerAutoescolaSchema>;

export type SolicitationWithDetails = Solicitation & {
  drivingSchool: DrivingSchool;
  conductor: Conductor;
  documents: Document[];
  operador?: User | null;
};

export type ChatMessageWithSender = ChatMessage & {
  senderName: string;
  senderRole: string;
};
