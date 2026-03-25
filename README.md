# SIAAC-LGPD v2.0
**TCC — IFBA Campus Feira de Santana · Wendell Paim · 2026**

---

## Versões utilizadas neste projeto

| Software | Versão | O que faz |
|---|---|---|
| Node.js | **20.x LTS** (recomendado) | Executa o servidor |
| npm | **10.x** (vem com o Node) | Instala pacotes |
| Express | 4.19.2 | Servidor web |
| lowdb | 1.0.0 | Banco de dados JSON (sem compilação) |
| bcryptjs | 2.4.3 | Criptografia de senhas |
| jsonwebtoken | 9.0.2 | Autenticação JWT |
| dotenv | 16.4.5 | Variáveis de ambiente |
| node-fetch | 2.7.0 | Chamadas HTTP para o Gemini |
| cors | 2.8.5 | Controle de origens |
| helmet | 7.1.0 | Segurança HTTP |
| express-rate-limit | 7.2.0 | Limite de requisições |
| nodemon | 3.1.0 | Reinício automático em dev |

> **Por que lowdb e não SQLite?**
> O `better-sqlite3` (SQLite) precisa compilar código C++ no Windows, o que exige
> Python e Visual Studio Build Tools instalados — causando falhas no `npm install`.
> O `lowdb` é JavaScript puro e não precisa de nada além do Node.js.

---

## Passo 1 — Instalar o Node.js 20 LTS

1. Abra o navegador e acesse **https://nodejs.org**
2. Clique no botão **"20.x.x LTS"** (lado esquerdo da página)

   > Se o site mostrar versão 22 como LTS, clique em "Other Downloads"
   > e baixe a versão 20 manualmente em: https://nodejs.org/en/download/

3. Execute o arquivo `.msi` baixado
4. Na tela de instalação, clique:
   **Next → aceite os termos → Next → Next → Next → Install → Finish**

   > Na tela "Tools for Native Modules" — **NÃO marque** essa caixa.
   > Ela instalaria Python e Visual Studio Build Tools (desnecessário aqui).

5. **Feche todos os terminais abertos** e abra um novo.

**Verificar se instalou corretamente:**

Pressione `Win + R`, digite `cmd`, pressione Enter. No terminal:

```
node --version
```

Resultado esperado: `v20.19.0` (ou similar começando com v20)

```
npm --version
```

Resultado esperado: `10.x.x`

Se aparecer esses números, o Node está instalado. Se não aparecer, reinicie o computador e tente novamente.

---

## Passo 2 — Baixar e extrair o projeto

1. Baixe o arquivo `siaac_lgpd_nodejs.zip`
2. Clique com o botão direito no arquivo → **Extrair tudo...**
3. Escolha um caminho **sem espaços e sem acento**, por exemplo:
   - `C:\projetos\siaac-lgpd`   ✅
   - `C:\Users\Wendell\Área de Trabalho\siaac lgpd`   ❌ (espaço no caminho causa erros)

---

## Passo 3 — Abrir o terminal na pasta do projeto

Abra o Explorador de Arquivos, navegue até a pasta extraída
(ex: `C:\projetos\siaac-lgpd`).

Clique na **barra de endereço** do Explorador de Arquivos
(onde aparece o caminho da pasta), delete o texto,
digite `cmd` e pressione **Enter**.

Um terminal abre já dentro da pasta correta.

**Confirme que está na pasta certa:**

```
dir
```

Deve listar arquivos como `package.json`, `README.md`, pasta `src`, pasta `public`.
Se não aparecer `package.json`, você está na pasta errada.

---

## Passo 4 — Instalar dependências

```
npm install
```

**O que vai acontecer:**
- npm lê o arquivo `package.json`
- Baixa todos os pacotes listados da internet
- Cria a pasta `node_modules` com os arquivos baixados
- Leva entre 30 segundos e 3 minutos dependendo da internet

**Resultado esperado no final:**
```
added 87 packages in 45s
```

O número de pacotes pode variar, mas não deve aparecer nenhum erro em vermelho.

### Se o npm install falhar — diagnóstico

**Erro: `npm : O termo 'npm' não é reconhecido`**
O Node.js não foi instalado corretamente ou o terminal não foi reaberto.
Feche o terminal, reinicie o Windows, abra um novo terminal e tente de novo.

**Erro: `ENOENT: no such file or directory`**
Você não está na pasta correta. Execute `dir` e verifique se `package.json` aparece.

**Erro: `EACCES` ou `permission denied`**
Feche o terminal. Abra o Menu Iniciar, procure `cmd`, clique com botão direito
no **Prompt de Comando** e escolha **"Executar como administrador"**.
Navegue até a pasta e repita `npm install`.

**Erro: `ETIMEDOUT` ou `ECONNREFUSED` (problema de rede)**
Verifique a conexão com a internet. Se estiver em rede do IFBA, pode haver
proxy ou firewall bloqueando. Tente em outra rede (rede móvel pelo celular,
por exemplo).

**Erro: `gyp ERR! build error` ou `node-gyp`**
Isso não deve ocorrer com esta versão do projeto (usamos `lowdb` que não
precisa de compilação). Se aparecer, verifique se baixou o arquivo correto
`siaac_lgpd_nodejs.zip` e extraiu sem modificações.

---

## Passo 5 — Criar o arquivo de configuração

```
copy .env.example .env
```

Depois abra o arquivo `.env` no Bloco de Notas:

```
notepad .env
```

O arquivo vai mostrar:

```
PORT=3000
JWT_SECRET=troque-por-uma-frase-secreta-longa-aqui
GEMINI_API_KEY=sua-chave-gemini-aqui
NODE_ENV=development
```

**Edite o campo `JWT_SECRET`** — substitua pelo texto entre aspas por qualquer frase longa:
```
JWT_SECRET=siaac-lgpd-ifba-feira-de-santana-wendell-2026
```

**Edite o campo `GEMINI_API_KEY`** com sua chave do Google Gemini:

1. Acesse **https://aistudio.google.com/apikey**
2. Faça login com uma conta Google
3. Clique em **"Create API Key"**
4. Copie a chave gerada
5. Cole no `.env` substituindo `sua-chave-gemini-aqui`

Exemplo de como deve ficar:
```
PORT=3000
JWT_SECRET=siaac-lgpd-ifba-feira-de-santana-wendell-2026
GEMINI_API_KEY=AIzaSyCnj68qgauPcBdWFz6EAMK2uzLQwkvG8bI
NODE_ENV=development
```

Salve o arquivo com **Ctrl + S** e feche o Bloco de Notas.

---

## Passo 6 — Criar o banco de dados com dados de exemplo

```
node src/seed.js
```

Resultado esperado:
```
Criando dados de demonstração...

   Usuário demo criado: demo@siaac.br / demo123
   2 avaliações de exemplo criadas

   Execute: npm start
   Acesse:  http://localhost:3000
```

Isso cria o arquivo `siaac.json` na pasta do projeto com os dados iniciais.

---

## Passo 7 — Iniciar o servidor

```
npm start
```

Resultado esperado:
```
SIAAC-LGPD rodando em http://localhost:3000
Ambiente: development
Gemini: configurado
```

Abra o navegador e acesse: **http://localhost:3000**

**Login de demonstração:**
- E-mail: `demo@siaac.br`
- Senha: `demo123`

Para parar o servidor: pressione **Ctrl + C** no terminal.

---

## Próximas vezes que for usar

Abra o terminal na pasta do projeto e rode apenas:

```
npm start
```

O `npm install` e o `seed.js` só precisam ser executados uma vez.

Para desenvolvimento (o servidor reinicia automaticamente quando você salvar um arquivo):

```
npm run dev
```

---

## Criar repositório no GitHub

### Instalar o Git

1. Acesse **https://git-scm.com/download/win**
2. Baixe e execute o instalador com todas as opções padrão
3. Feche e reabra o terminal após instalar

### Criar o repositório local

```
git init
git add .
git commit -m "feat: SIAAC-LGPD v2.0 Node.js"
```

### Conectar ao GitHub

1. Acesse **https://github.com/new**
2. Crie um repositório chamado `siaac-lgpd` (pode ser privado)
3. **Não** marque "Add a README file" (já temos um)
4. Copie a URL do repositório criado e execute:

```
git remote add origin https://github.com/SEU_USUARIO/siaac-lgpd.git
git branch -M main
git push -u origin main
```

> O arquivo `.env` e o `siaac.json` estão no `.gitignore` e nunca vão
> para o GitHub — sua chave Gemini fica protegida.

---

## Deploy no Railway (hospedagem gratuita)

1. Acesse **https://railway.app** e faça login com o GitHub
2. Clique em **New Project → Deploy from GitHub repo**
3. Selecione o repositório `siaac-lgpd`
4. Clique em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `GEMINI_API_KEY` | sua chave do Gemini |
| `JWT_SECRET` | sua frase secreta |
| `NODE_ENV` | `production` |

5. Clique em **Deploy** e aguarde
6. Clique em **Generate Domain** para obter a URL pública

> No Railway, o banco (`siaac.json`) é recriado a cada deploy.
> Para uso em produção real, considere migrar para um banco PostgreSQL
> (o Railway oferece gratuitamente). Consulte a documentação do Railway
> para adicionar o plugin PostgreSQL.

---

## Estrutura de arquivos

```
siaac-lgpd/
├── package.json          lista de dependências e comandos npm
├── .env.example          modelo — copie para .env e edite
├── .env                  suas configurações (NUNCA enviar ao GitHub)
├── .gitignore            arquivos ignorados pelo Git
├── siaac.json            banco de dados (criado pelo seed.js)
│
├── src/
│   ├── server.js         servidor Express — entry point
│   ├── db.js             banco lowdb + todas as operações de dados
│   ├── seed.js           cria banco e dados de demonstração
│   ├── middleware/
│   │   └── auth.js       valida token JWT em rotas protegidas
│   └── routes/
│       ├── auth.js       registro, login, perfis de usuário
│       ├── avaliacoes.js CRUD avaliações, rascunho, recomendações
│       └── gemini.js     proxy seguro para o Gemini (sem CORS)
│
└── public/
    ├── index.html        interface do sistema (SPA)
    ├── css/main.css      estilos visuais
    └── js/app.js         lógica do frontend
```

---

## Resumo dos comandos (referência rápida)

| Situação | Comando |
|---|---|
| Primeira instalação | `npm install` |
| Criar banco e dados demo | `node src/seed.js` |
| Iniciar servidor | `npm start` |
| Modo desenvolvimento | `npm run dev` |
| Subir para o GitHub | `git add . && git commit -m "msg" && git push` |

---

## Problemas comuns

**`node` ou `npm` não reconhecido**
→ Reinstale o Node.js 20 LTS e reinicie o Windows.

**Acesso negado / EACCES**
→ Abra o cmd como **Administrador** (clique direito → Executar como administrador).

**Porta 3000 em uso**
→ Mude `PORT=3001` no `.env` e acesse `http://localhost:3001`.

**Gemini não funciona — aparece "banco padrão"**
→ Verifique o `GEMINI_API_KEY` no `.env`. Não pode ter espaços antes ou depois. Reinicie com `npm start`.

**npm install com erro `gyp` ou `node-gyp`**
→ Você pode ter uma versão antiga do ZIP com `better-sqlite3`.
Baixe novamente o `siaac_lgpd_nodejs.zip` mais recente.
