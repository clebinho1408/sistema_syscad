# Guia de Deploy - SysCad para VPS Hostinger

Este guia explica como fazer o deploy do SysCad em uma VPS da Hostinger (ou qualquer VPS Linux).

## Requisitos

- VPS com Ubuntu 20.04+ ou Debian 11+
- Node.js 18+ 
- PostgreSQL 14+
- Nginx (para proxy reverso)
- Certbot (para SSL gratuito)
- Git

## 1. Preparar a VPS

### 1.1 Atualizar o sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Deve mostrar v20.x
```

### 1.3 Instalar PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 1.4 Criar banco de dados
```bash
sudo -u postgres psql

# No prompt do PostgreSQL:
CREATE USER syscad WITH PASSWORD 'sua_senha_segura';
CREATE DATABASE syscad OWNER syscad;
GRANT ALL PRIVILEGES ON DATABASE syscad TO syscad;
\q
```

### 1.5 Instalar Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.6 Instalar PM2 (gerenciador de processos)
```bash
sudo npm install -g pm2
```

## 2. Baixar e Configurar o Projeto

### 2.1 Clonar o repositório
```bash
cd /var/www
sudo git clone https://seu-repositorio.git syscad
cd syscad
sudo chown -R $USER:$USER .
```

### 2.2 Instalar dependências
```bash
npm install
```

### 2.3 Configurar variáveis de ambiente
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

### 2.4 Criar diretório de uploads
```bash
mkdir -p uploads
chmod 755 uploads
```

### 2.5 Configurar o banco de dados
```bash
npm run db:push
```

### 2.6 Build do projeto
```bash
npm run build
```

## 3. Configurar PM2

### 3.1 Criar arquivo de configuração
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

### 3.2 Criar diretório de logs
```bash
mkdir -p logs
```

### 3.3 Iniciar aplicação
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 4. Configurar Nginx

### 4.1 Criar configuração do site
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

### 4.2 Habilitar o site
```bash
sudo ln -s /etc/nginx/sites-available/syscad /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Configurar SSL (HTTPS)

### 5.1 Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 Obter certificado SSL
```bash
sudo certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br
```

### 5.3 Configurar renovação automática
```bash
sudo certbot renew --dry-run
```

## 6. Configurar Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 7. Criar Usuário Admin Inicial

Após o primeiro deploy, acesse o sistema e crie o primeiro usuário admin via banco de dados:

```bash
sudo -u postgres psql syscad

-- Criar hash da senha (exemplo: "admin123")
-- Use bcrypt para gerar o hash. No Node.js:
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
\q
```

Ou use o script de criação de admin se disponível.

## 8. Manutenção

### Atualizar a aplicação
```bash
cd /var/www/syscad
git pull origin main
npm install
npm run build
pm2 restart syscad
```

### Ver logs
```bash
pm2 logs syscad
```

### Monitorar processos
```bash
pm2 monit
```

### Backup do banco de dados
```bash
pg_dump -U syscad syscad > backup_$(date +%Y%m%d).sql
```

## 9. Estrutura de Arquivos em Produção

```
/var/www/syscad/
├── dist/              # Código compilado
├── uploads/           # Documentos enviados
├── logs/              # Logs da aplicação
├── .env               # Configurações
├── ecosystem.config.js # Config PM2
└── ...
```

## 10. Troubleshooting

### Aplicação não inicia
```bash
pm2 logs syscad --lines 100
```

### Erro de conexão com banco
```bash
sudo -u postgres psql -c "\l"  # Listar bancos
sudo systemctl status postgresql
```

### WebSocket não funciona
Verifique se a configuração do Nginx tem suporte a WebSocket (location /ws).

### Arquivos não fazem upload
```bash
ls -la uploads/
chmod 755 uploads/
```

## Contato

Em caso de problemas, verifique os logs em:
- `/var/www/syscad/logs/`
- `/var/log/nginx/error.log`
- `pm2 logs`
