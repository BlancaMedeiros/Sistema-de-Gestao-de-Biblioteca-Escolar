# Sistema de Gestão de Biblioteca Escolar

Monorepo do Projeto Integrador II, com frontend Angular, backend Express + TypeScript e banco MySQL.

> A fundação da stack local está disponível, com a primeira fatia de negócio implementada: autenticação de funcionário (login/logout/`/me`) e Swagger incremental. Acervo, leitores e empréstimos ainda serão adicionados nas próximas etapas.

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

Com os containers de pé, aplique as migrations pendentes (roda no host, não dentro do container — veja [docs/arquitetura.md](docs/arquitetura.md#migrations)):

```powershell
npm run dev:migrate
```

Endereços locais:

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000`
- Saúde do processo: `http://localhost:3000/health`
- Prontidão com MySQL: `http://localhost:3000/ready`
- Documentação Swagger: `http://localhost:3000/api/docs`

Para parar os containers sem apagar os dados do banco:

```powershell
npm run dev:down
```

## Verificar a fundação

Com a stack em execução, abra `http://localhost:3000/ready`. A resposta deve conter `"database": "connected"`. Esse endpoint só confirma a conexão Express-MySQL; ele não comprova migrations, autenticação, Swagger ou regras de empréstimo.

Use `npm run dev:status` para ver o estado dos serviços e `npm run dev:logs` para acompanhar os logs.

## Criar contas de funcionário para testar

Depois de rodar as migrations, crie as contas de desenvolvimento (login e senha conhecidos, só para uso local):

```powershell
npm run dev:seed:funcionarios
```

Idempotente: pode rodar quantas vezes quiser — contas que já existem não são recriadas nem têm a senha alterada, e nada é apagado. O comando lista no console o que criou e o que já existia, e sempre termina imprimindo as credenciais:

| Login | Senha |
| --- | --- |
| `bibliotecaria.teste` | `Teste@123` |
| `funcionaria.teste` | `Teste@123` |

Esse script recusa rodar com `NODE_ENV=production` (contas com senha fixa no código não devem existir num banco de produção).

## Rodar os testes do backend

```powershell
npm run dev:migrate
npm run test:backend
```

Os testes de `backend/src/modules/auth/*.test.ts` e `backend/src/db/*.test.ts` conectam no MySQL real do Docker Compose (precisa estar rodando) e limpam os dados que criam ao final.

## Estrutura

```text
frontend/  # Angular
backend/   # Express + TypeScript
database/  # migrations e seeds SQL futuros
docs/      # decisões e contratos técnicos
```

Veja [docs/arquitetura.md](docs/arquitetura.md) para decisões, limites atuais e próximas etapas.
