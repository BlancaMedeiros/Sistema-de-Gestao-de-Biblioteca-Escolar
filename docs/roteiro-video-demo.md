# Roteiro do vídeo — Docker, Swagger e o que foi construído até aqui

**Duração alvo: 5 a 6 minutos.** Objetivo: mostrar que o ambiente sobe com um comando, que a API tem contrato documentado (Swagger) e demonstrar ao vivo o único fluxo de negócio implementado até agora (autenticação de funcionário). Não é uma demonstração do sistema de biblioteca completo — isso ainda não existe, e o vídeo deve deixar isso claro, não sugerir o contrário.

## Antes de gravar (não entra no vídeo)

- [ ] `docker compose down` e suba de novo do zero (`npm run dev`), pra gravar um boot limpo em vez de containers que já estavam de pé.
- [ ] Confirme que `.env` existe e tem `SESSION_SECRET`, `MYSQL_*` preenchidos (`Copy-Item .env.example .env` se for a primeira vez).
- [ ] Rode `npm run dev:migrate` e `npm run dev:seed:funcionarios` **antes** de gravar, só pra confirmar que não vai dar erro ao vivo — mas grave rodando de novo mesmo assim (é idempotente, então repetir na gravação é seguro e mostra exatamente isso).
- [ ] Feche outras abas/apps que possam poluir a tela. Deixe preparadas 3 janelas: terminal, `http://localhost:3000/api/docs`, `http://localhost:8080` (Adminer).
- [ ] Decida se vai demonstrar a troca de senha (`PUT /me/senha`) ao vivo. Se sim: **ela realmente muda a senha da conta `bibliotecaria.teste` no seu banco.** Depois da gravação, restaure com:
  ```powershell
  docker compose exec mysql sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" biblioteca -e "DELETE FROM sessoes; DELETE FROM funcionarios WHERE login = \"bibliotecaria.teste\";"'
  npm run dev:seed:funcionarios
  ```
  Se preferir simplicidade, pule essa rota no vídeo e apenas cite que ela existe.

## Cena 1 — Abertura (≈30s)

**Tela:** README.md do repositório, ou a estrutura de pastas (`frontend/`, `backend/`, `database/`, `docs/`).

**Fala sugerida:**
> "Esse é o Sistema de Gestão de Biblioteca Escolar, do Projeto Integrador II. O frontend em Angular já existia; nesta etapa eu construí a fundação do backend — Express, TypeScript e MySQL, tudo rodando via Docker — e a primeira fatia de negócio: autenticação de funcionário. Vou mostrar como o ambiente sobe e como a API fica documentada automaticamente."

## Cena 2 — Subindo tudo com um comando (≈60-90s)

**Tela:** terminal, na raiz do repositório.

**Fazer:**
```powershell
npm run dev
```

**Fala sugerida, enquanto sobe:**
> "Um único comando sobe os três serviços: MySQL, a API e o frontend Angular, cada um no seu container, com hot reload pra desenvolvimento."

Quando estabilizar, em outro terminal:
```powershell
npm run dev:status
```
> "Aqui confirmo que os três estão de pé e saudáveis."

## Cena 3 — Migrations e dados de teste (≈45s)

**Fazer:**
```powershell
npm run dev:migrate
npm run dev:seed:funcionarios
```

**Fala sugerida:**
> "As migrations criam o schema do banco de forma versionada — rodar de novo não faz nada, porque é idempotente. E aqui eu crio duas contas de funcionário com senha conhecida, só para teste local; se elas já existirem, o comando avisa e não altera nada."

## Cena 4 — Swagger: o contrato da API (≈2min)

**Tela:** navegador em `http://localhost:3000/api/docs`.

**Fala sugerida (abrindo):**
> "Toda rota que eu implemento já nasce documentada aqui, no Swagger — gerado a partir de comentários no próprio código das rotas. Hoje só existe autenticação; conforme eu for adicionando acervo, leitores e empréstimos, o contrato cresce junto."

**Demonstrar ao vivo, em ordem:**

1. `POST /auth/login` → **Try it out** → `{"login":"bibliotecaria.teste","senha":"Teste@123"}` → **Execute**.
   > "Login recebe usuário e senha e devolve um cookie de sessão — não é token solto no localStorage, é sessão de servidor, com a senha guardada em hash."
2. `GET /me` → **Try it out** → **Execute** (reaproveita o cookie).
   > "Com a sessão ativa, consigo consultar quem está logado."
3. (Opcional) `PATCH /me` com um nome novo, e repetir `GET /me` mostrando a mudança.
4. (Opcional, ver aviso acima) `PUT /me/senha`.
5. `POST /auth/logout` → **Execute**.
6. `GET /me` de novo.
   > "E depois do logout, a mesma consulta agora dá 401 — a sessão foi realmente encerrada, não é só um front-end fingindo que saiu."

## Cena 5 — Onde a sessão realmente mora (≈30-45s)

**Tela:** navegador em `http://localhost:8080` (Adminer) — login: servidor `mysql`, usuário/senha do `.env`, base `biblioteca`.

**Fazer:** abrir a tabela `sessoes` (mostrando a linha ativa, se ainda não deu logout) e `funcionarios`.

**Fala sugerida:**
> "A sessão não fica só na memória do processo — ela é uma linha nessa tabela `sessoes`, no MySQL. Isso importa porque, em produção, se o serviço reiniciar ou escalar para mais de uma instância, ninguém perde a sessão no meio do caminho."

## Cena 6 — Fechamento (≈30s)

**Tela:** de volta ao terminal ou ao README.

**Fala sugerida:**
> "Resumindo: ambiente completo sobe com um comando, o contrato da API é gerado a partir do código, e o primeiro fluxo de negócio — login, perfil e troca de senha — está implementado e testado. O que vem a seguir são as próximas fatias: acervo, leitores e o ciclo de empréstimo, seguindo esse mesmo padrão."

## Depois de gravar

- Se testou `PUT /me/senha` ao vivo, rode o passo de restauração da seção "Antes de gravar".
- `npm run dev:down` se não for continuar trabalhando na sequência.
