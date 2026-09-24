# Deploy no Firebase Hosting + Cloud Run

**Estado:** Cloud SQL, Secret Manager, Artifact Registry, Cloud Run e Firebase Hosting foram publicados no projeto `projeto-integrador-2-6352b`. A URL `https://projeto-integrador-2-6352b.web.app/` respondeu `200`; por ela, `/api/health` respondeu `ok` e `/api/ready` confirmou a conexão MySQL. O rewrite está fixado na revisão `biblioteca-api-00002-lml` do Cloud Run.

> **Bloqueio antes do próximo push nesta branch:** o backend agora exige a variável `SESSION_SECRET` (usada para assinar o cookie de sessão do login). O workflow `deploy-firebase.yml` faz `gcloud run deploy` sem `--update-env-vars`/`--update-secrets`, ou seja, a revisão atual do Cloud Run **não tem** essa variável configurada. Se a imagem nova subir sem isso, o processo lança `A variável de ambiente SESSION_SECRET é obrigatória.` na inicialização e o serviço entra em crash-loop — derrubando `/api/health` e `/api/ready` também, já que nada consegue subir.
>
> Configurar **antes** de mesclar/enviar este incremento (executar manualmente; não é automatizado por este repositório):
>
> ```powershell
> # 1. Gerar um segredo aleatório e guardar no Secret Manager (mesmo padrão já usado para DB_PASSWORD)
> $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
> [Convert]::ToBase64String($bytes) | gcloud secrets create biblioteca-session-secret --data-file=- --project projeto-integrador-2-6352b
>
> # 2. Vincular o segredo ao serviço Cloud Run existente, sem tocar no restante da configuração
> gcloud run services update biblioteca-api `
>   --project projeto-integrador-2-6352b `
>   --region southamerica-east1 `
>   --update-secrets=SESSION_SECRET=biblioteca-session-secret:latest
> ```
>
> Depois disso, os próximos `gcloud run deploy` (via CI) preservam essa variável normalmente, como já fazem com as demais.

## Arquitetura

```text
Navegador -> Firebase Hosting -> /api/** -> Cloud Run (biblioteca-api) -> Cloud SQL for MySQL
```

O Hosting entrega o build Angular e encaminha apenas `/api` ao Cloud Run. Como o navegador usa a mesma origem, a API não precisa liberar CORS para o site publicado.

## Pré-requisitos de publicação

1. Autenticar a conta que possui acesso ao projeto:

   ```powershell
   gcloud auth login
   gcloud config set project projeto-integrador-2-6352b
   ```

   Para a Firebase CLI aproveitar as credenciais locais, também execute:

   ```powershell
   gcloud auth application-default login
   ```

2. Vincular faturamento e criar alerta de orçamento. Cloud Run e Cloud SQL exigem uma conta de faturamento; Cloud SQL mantém custo enquanto a instância existir.
3. Criar uma instância **Cloud SQL for MySQL** em `southamerica-east1`, na mesma região do Cloud Run. A instância deve conter o banco `biblioteca` e um usuário de aplicação sem privilégios administrativos.
4. Armazenar a senha desse usuário no Secret Manager, como `biblioteca-db-password`. Não registre senha em `.env`, Git ou comandos compartilhados.

## Parâmetros de produção

| Parâmetro | Valor |
| --- | --- |
| Serviço Cloud Run | `biblioteca-api` |
| Região | `southamerica-east1` |
| Banco | `biblioteca` |
| Usuário da aplicação | `biblioteca_app` |
| Variável de segredo | `DB_PASSWORD` <- `biblioteca-db-password` |
| Socket Cloud SQL | `DB_SOCKET_PATH=/cloudsql/projeto-integrador-2-6352b:southamerica-east1:biblioteca-mysql` |

O serviço deve usar uma conta de serviço dedicada com somente `roles/cloudsql.client`. A senha deve ser vinculada ao serviço com Secret Manager; não use uma chave JSON em `GOOGLE_APPLICATION_CREDENTIALS`.

## Ordem de deploy

1. Validar localmente:

   ```powershell
   npm.cmd run build:all
   docker build --target production --tag biblioteca-api:validation backend
   ```

2. Publicar a imagem de `backend/Dockerfile` no Artifact Registry e implantar `biblioteca-api` no Cloud Run, com:

   - `--add-cloudsql-instances` apontando para a instância Cloud SQL;
   - `DB_SOCKET_PATH`, `DB_NAME` e `DB_USER` como variáveis de ambiente;
   - `DB_PASSWORD` ligado ao segredo;
   - no máximo duas instâncias, inicialmente.

3. Confirmar `GET /health` e `GET /ready` na URL do Cloud Run. O segundo endpoint só retorna `200` quando o MySQL responde a `SELECT 1`.
4. Publicar o Angular e a regra `/api/**`:

   ```powershell
   npx firebase-tools@latest deploy --only hosting
   ```

5. Verificar `https://projeto-integrador-2-6352b.web.app/` e, pelo mesmo domínio, `GET /api/health`.

## CI/CD na branch `feat/backend-foundation`

O workflow versionado em `.github/workflows/deploy-firebase.yml` é executado a cada `push` nessa branch e também pode ser iniciado manualmente pela aba **Actions** do GitHub.

```text
push -> builds do backend e frontend -> OIDC -> Docker + Artifact Registry -> Cloud Run -> Firebase Hosting -> /api/health e /api/ready
```

A autenticação não usa chave JSON ou segredo no GitHub. Ela usa Workload Identity Federation, limitada ao ID imutável do repositório `1346661430` e à referência `refs/heads/feat/backend-foundation`. O deploy publica a imagem com a tag do commit (`GITHUB_SHA`) e só avança para o Hosting se os dois builds forem concluídos.

Os testes do frontend ainda não são um requisito bloqueante: nesta data, a suíte apresentou 6 testes aprovados e 4 falhas já conhecidas por `ActivatedRoute` ausente no `TestBed`. Depois de corrigidas, inclua `npm run test --prefix frontend -- --watch=false` no job `validar` antes do deploy.

## Limite atual

Além da fundação técnica (saúde da API e conectividade MySQL), esta branch agora inclui autenticação de funcionário (login/logout/`/me`) e o Swagger incremental — ver `docs/arquitetura.md`. Isso não foi implantado em produção ainda (ver bloqueio de `SESSION_SECRET` acima) nem consumido pelo Angular. Não há migrations, endpoints de livros/usuários/empréstimos além dos de autenticação. Um deploy bem-sucedido comprova a infraestrutura e a autenticação isoladas, não a aplicação completa de biblioteca.
