# Publicação e QAT da API — 16/10/2026

**Resultado: aprovado funcionalmente para integração do frontend, com ressalva de CHECK no TiDB descrita abaixo.** Não representa homologação das telas nem auditoria completa de segurança.

## Versão publicada

| Item | Evidência |
| --- | --- |
| Commit enviado a `feature/livros` | `49cb5b84d4171edf6468b6f8c46480beea859d6a` |
| Squash merge | [PR 13](https://github.com/BlancaMedeiros/Sistema-de-Gestao-de-Biblioteca-Escolar/pull/13), concluído em `feat/backend-foundation` |
| Commit do release | `78c9bf8c332bd0e2ea7f5ccd61fcfa5bf85f5d41` |
| CI e publicação | [Execução 38950486890](https://github.com/BlancaMedeiros/Sistema-de-Gestao-de-Biblioteca-Escolar/actions/runs/38950486890), jobs de validação e publicação concluídos com sucesso |
| Cloud Run | `biblioteca-api-00018-dgh`, imagem identificada pelo SHA do release, 100% do tráfego |
| Firebase Hosting | Publicado após o Cloud Run, atualizando a associação `pinTag` |
| URL verificada | https://projeto-integrador-2-6352b.web.app |

## Verificações executadas

- **Regressão local:** 236 testes em 24 arquivos aprovados contra MySQL; builds backend/frontend aprovados.
- **CI do release:** regressão, QAT HTTP com reinício do processo, migrations em MySQL descartável e builds aprovados antes da publicação.
- **TiDB publicado:** migrations `0003`–`0009` aplicadas pelo workflow. Leitura posterior confirmou histórico completo `0001`–`0009`.
- **HTTPS público:** 39 cenários, 145 requisições de negócio, todas as 23 operações API-01–23 aprovadas. Rodada de 15:58:03 a 15:59:07, horário de São Paulo.
- **Rotas técnicas:** `/`, `/api/health`, `/api/ready`, `/api/docs/` com 200; prontidão com `database: connected`; `/api/docs.json` com 23 operações e os exemplos novos de funcionários.
- **Sessão real pelo Firebase:** cookie `__session`, `Secure`, `HttpOnly`, `SameSite=Lax`; login, duas sessões, troca de senha e invalidação, logout e rejeição de cliente sem sessão aprovados.

Os casos públicos cobrem CRUD de livros, leitores e histórico; contatos/vínculo/indicadores do perfil; empréstimo, duas renovações e devolução; limites, atraso, saldo/manutenção, normalização/unicidade de ISBN, inativação e preservação do histórico; filtros/paginação, métricas, idempotência sequencial/concorrente, disputa da última unidade e erros HTTP 400/413/415/422/404/409/401.

As operações de negócio foram exercitadas por HTTPS na origem pública. O banco foi acessado diretamente apenas para provisionar a conta exclusiva inicial, preparar o atraso de um empréstimo próprio da rodada, consultar metadados e limpar as fixtures. Não foi executado Vitest/Supertest contra produção.

**Limpeza concluída:** removidos somente os dois funcionários, três livros, dois leitores e nove empréstimos criados pela rodada, além de suas renovações, sessões e chaves. Antes de remover, foram conferidos prefixo exclusivo e relacionamentos. Nova consulta confirmou zero funcionários/livros/leitores com o prefixo da rodada. Nenhuma conta existente teve senha alterada.

Evidência detalhada, sem senhas/cookies/corpos de autenticação: [JSON da rodada pública](evidencias/qat-publicado-2026-10-16.json).

## Ressalva confirmada no TiDB

Na consulta final, `tidb_enable_check_constraint` retornou **OFF**, e `information_schema.TABLE_CONSTRAINTS` não continha constraints do tipo `CHECK` neste banco. Portanto, o histórico das migrations não comprova a criação dessa barreira adicional de integridade. A necessidade de conferir o recurso no provedor já estava registrada no [contrato](specs/2026-10-15-apis-restantes-design.md).

O TiDB exige habilitar esse recurso para criar as constraints, conforme a [documentação oficial](https://docs.pingcap.com/tidb/stable/constraints/#check). A variável tem escopo global, segundo a [referência de variáveis](https://docs.pingcap.com/tidb/stable/system-variables/#tidb_enable_check_constraint-new-in-v720).

As validações/transações da API foram aprovadas para os mesmos cenários funcionais; esse achado não altera seus contratos HTTP. A defesa adicional no banco permanece **pendente**: verificar a possibilidade de ativação no plano contratado, conferir dados existentes e criar as constraints faltantes por novas migrations, preservando as já aplicadas. Não foi alterada configuração global do cluster nesta publicação.

## Limites e repasse

Não foi forçado reinício da produção para testar persistência; esse caminho foi comprovado no QAT local/CI. Não houve teste de carga ou indução de falha interna 500 na produção. Testes Angular já falhos, integração das telas, CSRF completo e limitação de tentativas de login permanecem fora deste aceite funcional, conforme o QAT anterior.

Para o repasse, usar o [guia rápido da API publicada para Bianca](bianca-guia-rapido-api-publicada.md). Ele não contém credenciais e não substitui o aceite da integração pelas telas.
