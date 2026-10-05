# Deploy no Firebase Hosting + Cloud Run + MySQL (Aiven)

**Estado:** a API roda no Cloud Run (`biblioteca-api`, projeto `projeto-integrador-2-6352b`) e o frontend no Firebase Hosting; o banco de produção migrou do Cloud SQL para o **Aiven for MySQL (plano gratuito)** em 05/10/2026, para eliminar o custo contínuo do Cloud SQL. A instância Cloud SQL `biblioteca-mysql` está **pausada** (`activation-policy=NEVER`) como plano B e será excluída depois que o Aiven estiver validado em produção.

## Arquitetura

```text
Navegador -> Firebase Hosting -> /api/** -> Cloud Run (biblioteca-api) -> MySQL no Aiven (TLS)
```

O Hosting entrega o build Angular e encaminha apenas `/api` ao Cloud Run. Como o navegador usa a mesma origem, a API não precisa liberar CORS para o site publicado.

## Banco de produção: Aiven for MySQL Free

Condições conferidas na documentação do Aiven em 05/10/2026 (reconfira antes de depender delas): sem cartão e sem prazo; 1 CPU, 1 GB RAM, **1 GB de disco**, **`max_connections` = 76**; sem SLA; **o serviço pode ser desligado por inatividade** (com aviso; religa pelo console); um serviço gratuito por tipo por organização; o Aiven pode mudar provedor/região.

Particularidades que afetam o código:

- **TLS obrigatório.** A conexão usa o certificado CA do serviço (`DB_SSL_CA`) e valida o certificado do servidor (`rejectUnauthorized: true`). Não desative essa verificação para "fazer funcionar".
- **`sql_mode` ANSI.** No Aiven, `"texto"` é identificador e `||` concatena. Use sempre aspas **simples** para strings em SQL. O MySQL do `compose.yaml` roda com o mesmo `sql_mode` para os testes locais pegarem esse tipo de erro.
- **`sql_require_primary_key` ligado.** Toda tabela nova precisa de chave primária.
- **Limite de conexões.** Pool de 5 conexões por instância (`DB_CONNECTION_LIMIT=5`) e Cloud Run com no máximo 2 instâncias: até 10 conexões da aplicação, bem abaixo das 76.
- **Versão:** MySQL 8.4, a mesma do Docker local.

### Banco e usuários

| Usuário | Uso |
| --- | --- |
| `avnadmin` | Administrador do serviço, criado pelo Aiven. Usado só para provisionar banco e usuários; nunca pela aplicação. |
| `biblioteca_app` | Usuário da aplicação: `GRANT ALL PRIVILEGES ON biblioteca.*`, sem nenhum privilégio global. |

Provisionamento feito (como `avnadmin`), para reproduzir se o serviço for recriado:

```sql
CREATE DATABASE IF NOT EXISTS `biblioteca` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'biblioteca_app'@'%' IDENTIFIED BY '<senha forte gerada>';
GRANT ALL PRIVILEGES ON `biblioteca`.* TO 'biblioteca_app'@'%';
```

### Credenciais locais (fora do Git)

Na raiz do repositório, dois arquivos ignorados pelo `.gitignore`:

- `.env.aiven` — `AIVEN_HOST`, `AIVEN_PORT`, `AIVEN_USER`, `AIVEN_PASSWORD` (admin) e `AIVEN_APP_DATABASE`, `AIVEN_APP_USER`, `AIVEN_APP_PASSWORD` (aplicação).
- `aiven-ca.pem` — certificado CA do serviço (página *Overview* no console do Aiven).

### Migrations em produção

O deploy **não** aplica migrations automaticamente. Depois de criar uma migration nova em `database/migrations/`, e **antes** de enviar o código que depende dela, rode na raiz:

```powershell
npm run prod:migrate
```

Ele lê `.env.aiven` e `aiven-ca.pem`, conecta com TLS usando o usuário `biblioteca_app` e aplica só o que estiver pendente (idempotente).

## Parâmetros de produção (Cloud Run)

| Parâmetro | Valor |
| --- | --- |
| Serviço / região | `biblioteca-api` / `southamerica-east1` |
| Máximo de instâncias | `2` |
| `DB_HOST` / `DB_PORT` | host e porta do serviço no Aiven |
| `DB_NAME` / `DB_USER` | `biblioteca` / `biblioteca_app` |
| `DB_CONNECTION_LIMIT` | `5` |
| `DB_PASSWORD` | segredo `biblioteca-aiven-db-password` |
| `DB_SSL_CA` | segredo `biblioteca-aiven-ca` (conteúdo PEM) |
| `SESSION_SECRET` | segredo `biblioteca-session-secret` |

A conta de serviço `biblioteca-api@projeto-integrador-2-6352b.iam.gserviceaccount.com` precisa de `roles/secretmanager.secretAccessor` em cada segredo acima. Não use chave JSON em `GOOGLE_APPLICATION_CREDENTIALS`.

## CI/CD na branch `feat/backend-foundation`

O workflow `.github/workflows/deploy-firebase.yml` roda a cada `push` nessa branch (ou manualmente pela aba **Actions**):

```text
push -> builds do backend e frontend -> OIDC -> Docker + Artifact Registry -> Cloud Run -> Firebase Hosting -> /api/health e /api/ready
```

A autenticação usa Workload Identity Federation, limitada ao repositório `1346661430` e à referência `refs/heads/feat/backend-foundation`; não há chave JSON nem segredo no GitHub. O `gcloud run deploy` do workflow troca só a imagem: variáveis, segredos e limite de instâncias configurados no serviço são preservados entre deploys.

O último passo do workflow exige `200` em `/api/ready`. Se o banco estiver fora do ar (por exemplo, o serviço gratuito do Aiven desligado por inatividade), o workflow é marcado como falho mesmo que a imagem tenha sido publicada.

Os testes do frontend ainda não bloqueiam o deploy (4 falhas conhecidas de `ActivatedRoute` no `TestBed`). Depois de corrigidas, inclua `npm run test --prefix frontend -- --watch=false` no job `validar`.

## Plano B: Cloud SQL pausado

Enquanto não for excluída, a instância `biblioteca-mysql` continua cobrando disco e backups (não as horas de CPU). O segredo `biblioteca-db-password` pertence a ela. Para voltar a usá-la seria preciso religá-la (`--activation-policy=ALWAYS`), aplicar as migrations nela e reconfigurar o Cloud Run com `--add-cloudsql-instances` e `DB_SOCKET_PATH`.

## Limite atual

Em produção existem apenas a saúde da API e a autenticação/perfil de funcionário. Não há conta de funcionário em produção: a seed com senha conhecida é só para desenvolvimento e não deve ser rodada contra o Aiven. Acervo, leitores e empréstimos ainda não existem, e o Angular ainda não consome a API.
