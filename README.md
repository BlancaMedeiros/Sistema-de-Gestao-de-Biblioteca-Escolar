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

As migrations e as contas de teste são criadas sozinhas: um serviço `migrate` aplica as migrations pendentes, cria as [contas de funcionário para testar](#contas-de-funcionário-para-testar) e o `backend` só inicia depois que ele terminar com sucesso (ver [docs/arquitetura.md](docs/arquitetura.md#migrations)). Em `docker compose ps` ele aparece como `Exited (0)` — é o esperado, não uma falha. Para rodar as migrations manualmente, sem subir a stack inteira, use `npm run dev:migrate`.

Endereços locais:

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000`
- Saúde do processo: `http://localhost:3000/health`
- Prontidão com MySQL: `http://localhost:3000/ready`
- Documentação Swagger: `http://localhost:3000/api/docs`
- Adminer (visualizar o banco): `http://localhost:8080` — Sistema: `MySQL`, Servidor: `mysql`, usuário/senha do seu `.env` (`MYSQL_USER`/`MYSQL_PASSWORD`, ou `root`/`MYSQL_ROOT_PASSWORD` para acesso total), Base de dados: `biblioteca`

Para parar os containers sem apagar os dados do banco:

```powershell
npm run dev:down
```

## Verificar a fundação

Com a stack em execução, abra `http://localhost:3000/ready`. A resposta deve conter `"database": "connected"`. Esse endpoint só confirma a conexão Express-MySQL; ele não comprova migrations, autenticação, Swagger ou regras de empréstimo.

Use `npm run dev:status` para ver o estado dos serviços e `npm run dev:logs` para acompanhar os logs.

## Contas de funcionário para testar

O `npm run dev` já cria as contas de desenvolvimento (login e senha conhecidos, só para uso local) — não é preciso rodar nada:

| Login | Senha |
| --- | --- |
| `bibliotecaria.teste` | `Teste@123` |
| `funcionaria.teste` | `Teste@123` |

A seed roda a cada subida e é idempotente: contas que já existem não são recriadas nem têm a senha alterada, e nada é apagado. O resultado aparece em `docker compose logs migrate`. O script recusa rodar com `NODE_ENV=production` (contas com senha fixa no código não devem existir num banco de produção).

### Comandos que rodam fora do Docker

`dev:seed:funcionarios`, `dev:funcionario:criar`, `dev:migrate` e `test:backend` rodam na sua máquina, não no container, e precisam das dependências do backend instaladas localmente. Na primeira vez:

```powershell
npm ci --prefix backend
```

Para recriar as contas de teste sem reiniciar a stack (por exemplo, depois de apagar uma delas): `npm run dev:seed:funcionarios`.

Para criar uma conta com senha escolhida por você (digitada sem aparecer na tela):

```powershell
npm run dev:funcionario:criar    # banco local
npm run prod:funcionario:criar   # produção (Aiven) — pede confirmação; ver docs/deploy-firebase-cloud-run.md
```

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
