# Como testar a autenticação de funcionário

Roteiro manual para conferir a primeira fatia de negócio implementada: login, sessão e Swagger incremental. Cobre só o que existe hoje (`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/me`) — não há rotas de acervo, leitores ou empréstimos ainda.

Os testes automatizados (24 testes, `npm run test:backend`) já cobrem estes fluxos contra um MySQL real; este roteiro é para você ver o mesmo comportamento rodando de verdade, na sua máquina.

## 1. Pré-requisitos

- Docker Desktop em execução.
- Node.js e npm no host (para os atalhos `npm run ...` da raiz — não é preciso Node dentro do container).

## 2. Subir a stack

Na raiz do repositório (`Sistema-de-Gestao-de-Biblioteca-Escolar/`):

```powershell
Copy-Item .env.example .env   # pule se já tiver um .env
npm run dev
```

Aguarde os três serviços (`mysql`, `backend`, `frontend`) ficarem de pé. Em outro terminal, confira:

```powershell
npm run dev:status
```

`backend` e `mysql` devem aparecer como `healthy`.

## 3. Aplicar as migrations

Roda no host (o `database/` não é montado dentro do container do backend):

```powershell
npm run dev:migrate
```

Esperado na primeira vez: `Migrations aplicadas: 0001_create_funcionarios.sql, 0002_create_sessoes.sql`. Rodando de novo, esperado: `Nenhuma migration pendente.` — é idempotente, pode rodar quantas vezes quiser.

## 4. Criar as contas de teste

```powershell
npm run dev:seed:funcionarios
```

Esperado na primeira vez: uma linha `✔ criado: login=... id=...` por conta. Rodando de novo: `… já existia (nada foi alterado)` para as duas — confirma que a seed não duplica nem reseta senha. O comando sempre termina imprimindo as credenciais:

| Login | Senha |
| --- | --- |
| `bibliotecaria.teste` | `Teste@123` |
| `funcionaria.teste` | `Teste@123` |

## 5. Testar pelo Swagger UI

> Verifiquei o fluxo abaixo por HTTP direto (curl e PowerShell — passo 6) e pelos testes automatizados; o comportamento do Swagger UI em si (cookie sendo enviado pelo navegador no "Try it out") é o padrão dessa ferramenta em mesma origem, mas eu não cliquei manualmente nessa UI num navegador real. Se algo neste passo específico não bater, o passo 6 é a referência que eu de fato executei.

1. Abra `http://localhost:3000/api/docs`.
2. Expanda `POST /auth/login` → **Try it out** → preencha o corpo:
   ```json
   { "login": "bibliotecaria.teste", "senha": "Teste@123" }
   ```
   → **Execute**. Esperado: `200`, corpo com `data.login` e `data.nome`, e um cookie `biblioteca.sid` no header `Set-Cookie` da resposta (visível na seção "Response headers" do Swagger UI).
3. Expanda `GET /me` → **Try it out** → **Execute** (o navegador reenvia o cookie automaticamente, já que o Swagger UI está na mesma origem `localhost:3000`). Esperado: `200` com os mesmos dados do funcionário.
4. Repita o login com uma senha errada. Esperado: `401` com `error.code = "CREDENCIAIS_INVALIDAS"`.
5. Expanda `POST /auth/logout` → **Execute**. Esperado: `204`, sem corpo.
6. Repita `GET /me`. Esperado agora: `401` com `error.code = "NAO_AUTENTICADO"` — a sessão foi mesmo encerrada.

## 6. Testar por linha de comando (alternativa ao passo 5)

PowerShell, usando `Invoke-WebRequest` para manter o cookie entre chamadas (`-UseBasicParsing` evita um erro do Windows PowerShell 5.1 em alguns terminais — testei sem ele e deu erro; com ele, funcionou):

```powershell
$session = $null
$login = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/auth/login -Method Post `
  -ContentType "application/json" -Body '{"login":"bibliotecaria.teste","senha":"Teste@123"}' `
  -SessionVariable session
$login.StatusCode        # esperado: 200
$login.Content            # esperado: {"data":{"id":...,"nome":"...","login":"bibliotecaria.teste"}}

$me = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/me -WebSession $session
$me.StatusCode            # esperado: 200

Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/auth/logout -Method Post -WebSession $session
# esperado: 204

try {
  Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/me -WebSession $session
} catch {
  $_.Exception.Response.StatusCode.value__   # esperado: 401
}
```

## 7. Conferir que a sessão persiste no MySQL (não é MemoryStore)

```powershell
docker compose exec mysql sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "USE biblioteca; SELECT COUNT(*) AS sessoes FROM sessoes;"'
```

(`$MYSQL_ROOT_PASSWORD` aí é a variável de ambiente *dentro do container* `mysql`, já definida pelo `compose.yaml` — não precisa existir no seu PowerShell.)

Durante uma sessão ativa (depois do login, antes do logout) o contador deve ser maior que zero; depois do logout, a linha correspondente some.

## 8. Rodar a suíte automatizada

```powershell
npm run test:backend
```

Esperado: todos os testes passando (nenhum `skip`, nenhum `fail`). Esses testes limpam os próprios dados ao final — não interferem com as contas do passo 4.

## 9. Checklist rápido

- [ ] `npm run dev:migrate` roda sem erro e é idempotente.
- [ ] `npm run dev:seed:funcionarios` cria as contas e é idempotente (não duplica, não reseta senha).
- [ ] Login com credenciais corretas → `200` + cookie.
- [ ] Login com senha errada → `401`.
- [ ] Login com corpo incompleto (`{}`) → `422`.
- [ ] `GET /me` sem cookie → `401`.
- [ ] `GET /me` com cookie válido → `200` com os dados do funcionário logado.
- [ ] `POST /auth/logout` → `204`, e o `GET /me` seguinte volta a dar `401`.
- [ ] `http://localhost:3000/api/docs` abre e lista as 3 rotas.
- [ ] `npm run test:backend` passa 100%.

## O que esta fatia deliberadamente não cobre

Sem CSRF completo, sem limite de tentativas de login, sem papéis distintos (ADMIN/OPERADOR — hoje é um único nível, "funcionário autorizado"), sem nenhuma rota de acervo/leitores/empréstimos. Ver `docs/arquitetura.md` para o que vem a seguir.
