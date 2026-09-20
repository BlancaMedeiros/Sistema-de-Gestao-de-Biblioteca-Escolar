# Sistema de Gestão de Biblioteca Escolar

Monorepo do Projeto Integrador II, com frontend Angular, backend Express + TypeScript e banco MySQL.

> A fundação da stack local está disponível. Migrations, autenticação, Swagger e regras de negócio ainda serão adicionados nas próximas etapas.

## Pré-requisitos

- Docker Desktop em execução, com Docker Compose;
- Node.js e npm apenas para executar os atalhos `npm run ...` da raiz.

## Executar o ambiente local

No PowerShell, na raiz deste repositório:

```powershell
Copy-Item .env.example .env
npm run dev
```

Na primeira execução, o Docker baixará as imagens e instalará as dependências dentro dos containers. As alterações em `frontend/` e `backend/` são refletidas por hot reload.

Endereços locais:

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000`
- Saúde do processo: `http://localhost:3000/health`
- Prontidão com MySQL: `http://localhost:3000/ready`

Para parar os containers sem apagar os dados do banco:

```powershell
npm run dev:down
```

## Verificar a fundação

Com a stack em execução, abra `http://localhost:3000/ready`. A resposta deve conter `"database": "connected"`. Esse endpoint só confirma a conexão Express-MySQL; ele não comprova migrations, autenticação, Swagger ou regras de empréstimo.

Use `npm run dev:status` para ver o estado dos serviços e `npm run dev:logs` para acompanhar os logs.

## Estrutura

```text
frontend/  # Angular
backend/   # Express + TypeScript
database/  # migrations e seeds SQL futuros
docs/      # decisões e contratos técnicos
```

Veja [docs/arquitetura.md](docs/arquitetura.md) para decisões, limites atuais e próximas etapas.
