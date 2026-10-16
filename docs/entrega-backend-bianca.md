# Entrega das APIs para integração do frontend

As 23 operações do backend estão implementadas na branch `feature/livros`, sobre `feat/backend-foundation`. Código validado no commit `5199ab5`; o [resultado do QAT de 16/10](qat-resultado-2026-10-16.md) e os arquivos de evidência acompanham a branch. Consulte o PR para o CI e a revisão da versão mais recente. As novas APIs ainda não foram publicadas.

## Obter e executar a versão

Na raiz do clone, preservando alterações locais existentes:

```powershell
git fetch origin
git switch feature/livros
git pull --ff-only origin feature/livros
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Complete os valores locais de `.env`, sem sobrescrever um arquivo já configurado. Com Docker Desktop aberto:

```powershell
docker compose up -d --build backend
docker compose ps -a
```

Espere MySQL/backend saudáveis e `migrate` concluído com código 0. Migrations e seed são locais; não é necessário acesso ao TiDB Cloud.

- Swagger: <http://127.0.0.1:3000/api/docs/>.
- Base das rotas de negócio: `http://127.0.0.1:3000/api/v1`.
- Prontidão: <http://127.0.0.1:3000/api/ready>.
- Seed de desenvolvimento: `funcionaria.teste` / `Teste@123`, inicialmente. Senhas já alteradas são preservadas; veja [autenticação](como-testar-autenticacao.md) para criar uma conta local exclusiva.

`127.0.0.1` é o computador de quem executa. Bianca precisa subir o próprio ambiente para usar esses endereços. A URL pública atual não contém esta entrega de APIs.

## Apontar o Angular local para o backend local

O `frontend/proxy.conf.json` atual aponta para produção. Para integrar localmente, pode-se usar um arquivo temporário, sem mudar essa configuração versionada:

```powershell
New-Item -ItemType Directory -Path tmp -Force | Out-Null
@'
{
  "/api": {
    "target": "http://127.0.0.1:3000",
    "secure": false,
    "changeOrigin": true
  }
}
'@ | Set-Content -Encoding ascii tmp/proxy-qat.json
npm.cmd ci --prefix frontend
npm.cmd start --prefix frontend -- --host 127.0.0.1 --proxy-config ../tmp/proxy-qat.json
```

Esse comando serve o Angular pelo Node do host; o destino `127.0.0.1:3000` corresponde à porta do backend publicada pelo Docker. Em containers, a rede/endereço são outros. O proxy só encaminha chamadas HTTP: os mocks precisam ser substituídos pelos serviços reais. Use URLs relativas `/api/v1/...` para preservar a mesma origem e o cookie da sessão. Confirme no Network o destino e a resposta de cada chamada.

## Contrato a consumir

O [contrato completo](specs/2026-10-15-apis-restantes-design.md) contém DTOs, filtros e códigos. Exemplos executáveis estão no Swagger e no [roteiro de QAT](qat-e-proximos-passos.md).

- **Autenticação:** login estabelece cookie HttpOnly `__session`; `/me` restaura o usuário após F5; sair chama `POST /auth/logout`. Não ler esse cookie pelo JavaScript nem tratar localStorage como confirmação de sessão.
- **Leitores e funcionários:** `/usuarios` cadastra leitores, sem conta de acesso; `/funcionarios` cria conta autenticável. Há um único nível de permissão de funcionário.
- **Leitura de respostas:** item em `data`; listas paginadas em `data` e `pagination`; histórico inclui `resumo`. Livros não são paginados nesta versão.
- **Datas:** `YYYY-MM-DD`, dia calculado em São Paulo. Exibir como data civil; não converter meia-noite UTC para horário local e deslocar o dia.
- **Empréstimo:** enviar somente `livroId` e `usuarioId`; servidor define datas, operador, disponibilidade e status.
- **Idempotência:** gerar `crypto.randomUUID()` para cada intenção de emprestar, renovar ou devolver. Durante erro de rede/retentativa da mesma intenção, preservar chave e dados. Uma ação nova recebe chave nova. Depois de movimentar, consultar o estado atualizado; uma resposta repetida de chave antiga é a resposta original.
- **Validação e conflitos:** 401 exige restabelecer sessão; 422 apresenta campos inválidos e preserva formulário; 409 apresenta a regra/estado conflitante, preserva os dados e atualiza o estado necessário; 404 indica recurso indisponível. Não repetir automaticamente um 409 com outra chave como se fosse sucesso.
- **Estoque:** saldo é total menos manutenção menos empréstimos abertos. DELETE de livro é inativação lógica, exige ausência de empréstimos e passa a dar 404 nas consultas do acervo. Não há API para reativar livro; leitor pode ser reativado por PATCH.
- **Regras confirmadas:** prazo de 7 dias, até 3 empréstimos abertos, até 2 renovações de +7 dias sobre vencimento anterior; qualquer atraso bloqueia novos empréstimos e renovações até sua devolução.
- **Dashboard:** acervo conta unidades; ativos incluem atrasados; pendências contam atrasados; vencem hoje considera apenas abertos. O contrato explica os limites das listas do painel.

## Conferência inicial no computador da Bianca

- [ ] Obteve a branch/commit e subiu migrations/backend.
- [ ] Abriu o Swagger, fez login e consultou `/me` com 200.
- [ ] Cadastrou leitor/livro e concluiu empréstimo → renovação → devolução usando as chaves.
- [ ] Confirmou chamadas do frontend para a API local e o tratamento dos erros de contrato.

O QAT técnico local foi executado; estes itens de recebimento ainda dependem da execução pela Bianca. A integração das telas e os testes Angular pendentes pertencem à etapa seguinte. Antes de publicar, concluir as pendências de segurança e de ambiente descritas no resultado do QAT. Nenhuma mensagem foi enviada à Bianca por esta entrega.
