# Guia de Deploy - SysCad

Este guia explica como fazer o deploy do SysCad em diferentes ambientes.

## Opção 1: Deploy com Dokploy (Recomendado)

Dokploy é uma plataforma PaaS self-hosted que simplifica o deploy de aplicações.

### 1.1 Pré-requisitos

- VPS com Dokploy instalado (https://dokploy.com)
- PostgreSQL configurado no Dokploy ou externo

### 1.2 Criar Aplicação no Dokploy

1. No painel do Dokploy, clique em **Create Application**
2. Escolha **Docker Compose** ou **Dockerfile**
3. Conecte ao repositório Git ou faça upload do código

### 1.3 Dockerfile

Crie um `Dockerfile` na raiz do projeto:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p uploads && chmod 755 uploads

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
```

### 1.4 Docker Compose (Alternativa)

Se preferir usar docker-compose, crie `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - LOCAL_STORAGE_PATH=/app/uploads
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes:
      - uploads:/app/uploads
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=syscad
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=syscad
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  uploads:
  postgres_data:
```

### 1.5 Variáveis de Ambiente no Dokploy

No painel do Dokploy, vá em **Environment Variables** e configure:

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://syscad:senha@db:5432/syscad` | Sim |
| `SESSION_SECRET` | Chave aleatória de 32+ caracteres | Sim |
| `NODE_ENV` | `production` | Sim |
| `PORT` | `5000` | Sim |
| `LOCAL_STORAGE_PATH` | `/app/uploads` | Sim |
| `GEMINI_API_KEY` | Sua chave da API Gemini | Não (para OCR) |

### 1.6 Configurar Volumes

No Dokploy, configure o volume para persistir os uploads:
- **Container Path:** `/app/uploads`
- **Host Path:** Volume nomeado ou path absoluto

### 1.7 Configurar Domínio e SSL

1. Vá em **Domains** no Dokploy
2. Adicione seu domínio (ex: `syscad.seudominio.com.br`)
3. Habilite SSL (Let's Encrypt automático)

### 1.8 Inicializar Banco de Dados

Após o primeiro deploy, execute as migrations:

```bash
# No terminal do container ou via Dokploy CLI
npm run db:push
```

### 1.9 Criar Usuário Admin

Acesse o banco de dados PostgreSQL e execute:

```sql
-- Gerar hash da senha no Node.js primeiro:
-- require('bcryptjs').hashSync('sua_senha', 10)

INSERT INTO users (id, username, name, email, password, role)
VALUES (
  gen_random_uuid(),
  'admin',
  'Administrador',
  'admin@seudominio.com.br',
  '$2a$10$HASH_DA_SENHA_AQUI',
  'admin'
);
```

---

## Opção 2: Deploy Manual em VPS

Para deploy manual sem Dokploy, siga as instruções abaixo.

### 2.1 Requisitos

- VPS com Ubuntu 20.04+ ou Debian 11+
- Node.js 18+ 
- PostgreSQL 14+
- Nginx (para proxy reverso)
- Certbot (para SSL gratuito)
- Git

### 2.2 Preparar a VPS

#### Atualizar o sistema
```bash
sudo apt update && sudo apt upgrade -y
```

#### Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Deve mostrar v20.x
```

#### Instalar PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Criar banco de dados
```bash
sudo -u postgres psql

# No prompt do PostgreSQL:
CREATE USER syscad WITH PASSWORD 'sua_senha_segura';
CREATE DATABASE syscad OWNER syscad;
GRANT ALL PRIVILEGES ON DATABASE syscad TO syscad;
\q
```

#### Instalar Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### Instalar PM2 (gerenciador de processos)
```bash
sudo npm install -g pm2
```

### 2.3 Baixar e Configurar o Projeto

#### Clonar o repositório
```bash
cd /var/www
sudo git clone https://seu-repositorio.git syscad
cd syscad
sudo chown -R $USER:$USER .
```

#### Instalar dependências
```bash
npm install
```

#### Configurar variáveis de ambiente
```bash
cp .env.example .env
nano .env
```

Preencha as variáveis obrigatórias:
```env
DATABASE_URL=postgresql://syscad:sua_senha_segura@localhost:5432/syscad
SESSION_SECRET=chave_aleatoria_de_32_caracteres_ou_mais
LOCAL_STORAGE_PATH=./uploads
PORT=5000
NODE_ENV=production
```

#### Criar diretório de uploads
```bash
mkdir -p uploads
chmod 755 uploads
```

#### Configurar o banco de dados
```bash
npm run db:push
```

#### Build do projeto
```bash
npm run build
```

### 2.4 Configurar PM2

#### Criar arquivo de configuração
```bash
nano ecosystem.config.js
```

Conteúdo:
```javascript
module.exports = {
  apps: [{
    name: 'syscad',
    script: 'dist/index.cjs',
    cwd: '/var/www/syscad',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

#### Criar diretório de logs
```bash
mkdir -p logs
```

#### Iniciar aplicação
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 2.5 Configurar Nginx

#### Criar configuração do site
```bash
sudo nano /etc/nginx/sites-available/syscad
```

Conteúdo (substitua `seu-dominio.com.br`):
```nginx
server {
    listen 80;
    server_name seu-dominio.com.br www.seu-dominio.com.br;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support (para o chat)
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    client_max_body_size 50M;
}
```

#### Habilitar o site
```bash
sudo ln -s /etc/nginx/sites-available/syscad /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2.6 Configurar SSL (HTTPS)

#### Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

#### Obter certificado SSL
```bash
sudo certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br
```

#### Configurar renovação automática
```bash
sudo certbot renew --dry-run
```

### 2.7 Configurar Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 3. Manutenção

### Atualizar a aplicação

**Com Dokploy:**
- Faça push para o repositório Git
- Dokploy detecta e faz redeploy automaticamente

**Manual:**
```bash
cd /var/www/syscad
git pull origin main
npm install
npm run build
pm2 restart syscad
```

### Ver logs

**Com Dokploy:**
- Acesse o painel e vá em **Logs**

**Manual:**
```bash
pm2 logs syscad
```

### Backup do banco de dados
```bash
pg_dump -U syscad syscad > backup_$(date +%Y%m%d).sql
```

---

## 4. Estrutura de Arquivos em Produção

```
/app/ (ou /var/www/syscad/)
├── dist/              # Código compilado
├── uploads/           # Documentos enviados (volume persistente!)
├── logs/              # Logs da aplicação
├── .env               # Configurações
└── ...
```

---

## 5. Troubleshooting

### Aplicação não inicia
```bash
# Dokploy: Ver logs no painel
# Manual:
pm2 logs syscad --lines 100
```

### Erro de conexão com banco
- Verifique se o PostgreSQL está rodando
- Confirme a `DATABASE_URL` está correta
- No Dokploy, verifique se o serviço `db` está no mesmo network

### WebSocket não funciona
- Verifique configuração de proxy para WebSocket
- No Dokploy, confirme que a porta 5000 está exposta

### Arquivos não fazem upload
```bash
ls -la uploads/
chmod 755 uploads/
```
- No Dokploy, verifique se o volume está configurado corretamente

### OCR não funciona
- Confirme que `GEMINI_API_KEY` está configurada
- Verifique os logs para erros da API Gemini

---

## 6. Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `DATABASE_URL` | URL de conexão PostgreSQL | Sim |
| `SESSION_SECRET` | Chave para criptografia de sessão | Sim |
| `NODE_ENV` | Ambiente (production) | Sim |
| `PORT` | Porta da aplicação (5000) | Sim |
| `LOCAL_STORAGE_PATH` | Caminho para uploads | Sim |
| `GEMINI_API_KEY` | Chave API Google Gemini | Não |
