# Como testar a autenticação de funcionário

Roteiro manual para conferir a primeira fatia de negócio implementada: login, sessão, perfil e Swagger incremental. Cobre só o que existe hoje (`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/me`, `PATCH /api/v1/me`, `PUT /api/v1/me/senha`) — não há rotas de acervo, leitores ou empréstimos ainda.

Os testes automatizados (40 testes, `npm run test:backend`) já cobrem estes fluxos contra um MySQL real; este roteiro é para você ver o mesmo comportamento rodando de verdade, na sua máquina.

## 1. Pré-requisitos

- Docker Desktop em execução.
- Node.js e npm no host (para os atalhos `npm run ...` da raiz — não é preciso Node dentro do container).

## 2. Subir a stack

Na raiz do repositório (`Sistema-de-Gestao-de-Biblioteca-Escolar/`):

```powershell
Copy-Item .env.example .env   # pule se já tiver um .env
npm run dev
```

Aguarde os serviços ficarem de pé. Em outro terminal, confira:

```powershell
npm run dev:status
```

`backend` e `mysql` devem aparecer como `healthy`. O serviço `migrate` aparece como `Exited (0)` — é o esperado: ele aplica as migrations pendentes e sai; o `backend` só inicia depois dele terminar com sucesso (veja `docker compose logs migrate`, deve mostrar `Migrations aplicadas: ...` na primeira vez ou `Nenhuma migration pendente.` depois).

## 3. (Opcional) Rodar as migrations manualmente

Isso já aconteceu sozinho no passo anterior. Só é preciso rodar à mão se você quiser aplicar migrations sem subir a stack inteira (por exemplo, com só o `mysql` de pé):

```powershell
npm run dev:migrate
```

Idempotente — pode rodar quantas vezes quiser, inclusive junto com o serviço automático, sem conflito.

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

## 6.1. Testar o perfil (`PATCH /me` e `PUT /me/senha`)

> **Atenção:** o passo de trocar a senha altera de verdade a conta `bibliotecaria.teste` no seu banco local. Depois de testar, rode o passo de "restaurar" no final desta seção antes de continuar usando a senha documentada (`Teste@123`) em outros testes.

Continuando com o mesmo `$session` do passo 6 (logado como `bibliotecaria.teste`):

```powershell
$patch = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/me -Method Patch `
  -ContentType "application/json" -Body '{"nome":"Bibliotecaria Renomeada"}' -WebSession $session
$patch.StatusCode   # esperado: 200
$patch.Content       # esperado: nome já atualizado

try {
  Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/me/senha -Method Put `
    -ContentType "application/json" -Body '{"senhaAtual":"errada","novaSenha":"NovaSenha@123"}' -WebSession $session
} catch {
  $_.Exception.Response.StatusCode.value__   # esperado: 401
}

$senhaCerta = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/me/senha -Method Put `
  -ContentType "application/json" -Body '{"senhaAtual":"Teste@123","novaSenha":"NovaSenha@123"}' -WebSession $session
$senhaCerta.StatusCode   # esperado: 204
```

Confirme que a senha antiga para de funcionar e a nova passa a funcionar:

```powershell
try {
  Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/auth/login -Method Post `
    -ContentType "application/json" -Body '{"login":"bibliotecaria.teste","senha":"Teste@123"}'
} catch {
  $_.Exception.Response.StatusCode.value__   # esperado: 401 — senha antiga não vale mais
}

$nova = Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/v1/auth/login -Method Post `
  -ContentType "application/json" -Body '{"login":"bibliotecaria.teste","senha":"NovaSenha@123"}'
$nova.StatusCode   # esperado: 200
```

**Restaurar o estado documentado** (deleta a conta e recria pela seed, com a senha de novo `Teste@123`):

```powershell
docker compose exec mysql sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" biblioteca -e "DELETE FROM sessoes; DELETE FROM funcionarios WHERE login = \"bibliotecaria.teste\";"'
npm run dev:seed:funcionarios
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

- [ ] `docker compose ps` mostra `migrate` como `Exited (0)` e `backend`/`mysql` como `healthy`.
- [ ] `npm run dev:migrate` (manual) roda sem erro e é idempotente.
- [ ] `npm run dev:seed:funcionarios` cria as contas e é idempotente (não duplica, não reseta senha).
- [ ] Login com credenciais corretas → `200` + cookie.
- [ ] Login com senha errada → `401`.
- [ ] Login com corpo incompleto (`{}`) → `422`.
- [ ] `GET /me` sem cookie → `401`.
- [ ] `GET /me` com cookie válido → `200` com os dados do funcionário logado.
- [ ] `POST /auth/logout` → `204`, e o `GET /me` seguinte volta a dar `401`.
- [ ] `PATCH /me` com nome válido → `200`, refletido no `GET /me` seguinte.
- [ ] `PATCH /me` com nome vazio → `422`.
- [ ] `PUT /me/senha` com senha atual errada → `401`, senha não muda.
- [ ] `PUT /me/senha` com senha atual certa → `204`; login com a senha antiga passa a dar `401`, com a nova dá `200`.
- [ ] `http://localhost:3000/api/docs` abre e lista as rotas de `/auth/*` e `/me`.
- [ ] `npm run test:backend` passa 100%.

## O que esta fatia deliberadamente não cobre

Sem CSRF completo, sem limite de tentativas de login, sem papéis distintos (ADMIN/OPERADOR — hoje é um único nível, "funcionário autorizado"), sem nenhuma rota de acervo/leitores/empréstimos. Ver `docs/arquitetura.md` para o que vem a seguir.
