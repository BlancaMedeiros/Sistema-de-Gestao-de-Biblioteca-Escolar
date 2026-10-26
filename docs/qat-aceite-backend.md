# QAT e aceite do backend para entrega à Bianca

**Modelo preparado em 16/10/2026. Rodada técnica concluída e ampliada para as telas atuais:** veja o [resultado atualizado](qat-resultado-2026-10-16-frontend.md) e o [guia para Bianca](entrega-backend-bianca.md). Este checklist mantém os campos NE como modelo para novas rodadas; eles não substituem o resultado já registrado. O [QAT detalhado](qat-e-proximos-passos.md) mantém verificações históricas e passos de livros/empréstimos. O [contrato](specs/2026-10-15-apis-restantes-design.md) é a referência de campos, filtros e códigos. O [índice do workspace](../../relatorios/00-leia-primeiro.markdown) mantém os relatórios históricos.

## O que precisa estar aprovado

**Publicação verificada em 16/10:** o [QAT da API pública](qat-publicado-2026-10-16.md) registra as 23 operações aprovadas em 39 cenários/145 requisições, a limpeza da rodada e a ressalva de CHECK no TiDB. O modelo abaixo continua disponível para novas rodadas.

Uma rodada completa precisa identificar a versão testada, comprovar as operações e regras, registrar os defeitos e permitir que Bianca reproduza o ambiente. Executar um endpoint e receber 200 não basta: confira o corpo, o efeito nos dados e a ausência de efeito quando a operação é rejeitada.

Para esta entrega, o aceite é **do backend para integração local**. O aceite do sistema pela interface depende da integração das telas, da sessão no Angular e da correção dos testes de frontend já falhos. Registre essas pendências no repasse.

| Etapa                        | Evidência necessária                                                  | Situação verificada nesta revisão                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Identificar a versão         | Branch, commit, alterações locais, data e ambiente                    | `feature/livros`, código `5ddd31a`; evidências e limites no resultado atualizado |
| Validar automaticamente      | Saída completa, código de saída e versão correspondente               | 236/236 testes em 24 arquivos em cada banco local, MySQL 8.4.11 e TiDB 8.5.3; builds backend/frontend aprovados |
| Executar aceite funcional    | Status HTTP, resposta, IDs e conferência dos efeitos dos casos abaixo | 36 cenários/129 requisições por banco via HTTP real automatizado; não é execução manual humana |
| Revisar e corrigir           | Registro de defeitos, reteste e revisão de código/migrations/contrato | Correções e retestes registrados; revisão independente do PR e aceite das telas pendentes |
| Entregar versão reproduzível | Commit acessível, CI do PR aprovado, instruções e pendências          | PR 13 em rascunho para `feat/backend-foundation`; consultar CI da revisão atual; guia para Bianca atualizado |

## 1. Preparar uma rodada

Para executar a rodada em uma sequência única pelo Swagger, use o [guia de teste manual de todos os endpoints](guia-teste-manual-endpoints.md). Ele reutiliza os IDs API-01–23 deste checklist e organiza os dados e dependências dos cenários.

Preencha antes de começar:

```text
Rodada: QAT-AAAAMMDD-HHMM
Responsável:
Data/hora e fuso:
Branch e commit:
Alterações ainda sem commit:
Ambiente: local de desenvolvimento/teste
Base HTTP e banco/versão (sem credenciais):
Resultado dos testes e local dos logs:
```

É possível começar a rodada no checkout atual. Para aprovar a entrega, associe as evidências a um commit que contenha as APIs, migrations e contratos. O HEAD atual sozinho não identifica as alterações ainda sem commit. Uma mudança posterior em código/migrations exige repetir as verificações afetadas e a suíte de regressão antes do aceite dessa nova versão.

No PowerShell, dentro de `Sistema-de-Gestao-de-Biblioteca-Escolar/`, com Docker Desktop aberto:

```powershell
# Só cria o arquivo quando ele ainda não existe; complete os valores locais.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --build backend
docker compose ps -a
```

Esperado: `mysql` e `backend` saudáveis; `migrate` concluído com código 0. Se novos módulos não carregarem, use `docker compose restart backend` e aguarde a prontidão.

- Prontidão: <http://127.0.0.1:3000/api/ready>, 200 com banco conectado.
- Swagger: <http://127.0.0.1:3000/api/docs/>, 23 operações de negócio; a base `/api/v1` é acrescentada pelo Swagger.
- Conta local inicialmente criada pela seed: `funcionaria.teste` / `Teste@123`. A seed não redefine senha já alterada. Crie uma conta exclusiva pelo procedimento de autenticação para testar perfil/senha.
- Use prefixo da rodada em títulos, matrículas, logins e chaves. Anote IDs retornados; não presuma IDs iguais a 1. Para novas intenções de empréstimo/renovação/devolução, gere novas chaves; reaproveite a chave apenas ao testar a repetição da mesma intenção.

A tela Angular atual tem mocks nas áreas novas e o proxy aponta para a API publicada. Portanto, abrir a tela em 4200 não comprova as APIs locais. Nesta rodada, use o Swagger diretamente em 3000. `127.0.0.1` acessa apenas a própria máquina; Bianca precisará do código para subir seu ambiente ou, em uma etapa posterior, de uma URL de homologação acessível.

## 2. Guardar a evidência automatizada

No ambiente local acima:

```powershell
docker compose exec -T backend npm test
docker compose exec -T backend npm run build
```

Guarde a saída completa, o código de saída de cada comando e a identificação da versão. Os dois comandos devem terminar com código 0. A referência desta revisão é 236 testes em 24 arquivos, sem falhas ou testes ignorados: 214 anteriores, 19 de perfil e três de localização. Esses comandos usam o banco local configurado no Compose e a suíte cria/remove seus próprios dados.

As migrations 0001–0009 devem ter concluído sem erro; uma segunda execução deve informar ausência de pendências. Se precisar repetir explicitamente pelo serviço local:

```powershell
docker compose run --rm migrate
```

Esse serviço também executa a seed de desenvolvimento, que preserva contas existentes. Para testar banco vazio, use uma instância separada, descartável, preservando o volume atual. Não use `down -v` como passo de QAT. A instalação do zero e a repetição das migrations já têm evidência em MySQL/TiDB locais no QAT detalhado; alterações de DDL exigem nova verificação desses caminhos.

Os casos de concorrência, atraso e virada do dia podem ser comprovados pelos testes automatizados com fixtures controladas. Vincule a saída da suíte e os casos correspondentes ao registro da rodada; não marque esses casos como executados manualmente. Não altere o relógio nem datas de registros de outra pessoa para simular atraso.

## 3. Conferir as 23 operações por um cliente funcional

Pode ser o Swagger ou um cliente HTTP independente da suíte Supertest, que valide as mesmas respostas e efeitos em um servidor real. A rodada de 16/10 adotou o QAT HTTP versionado, complementado por um fluxo visual no Swagger. Registre o método efetivamente usado; execução automatizada não deve ser rotulada como clique manual humano.

Todos os estados abaixo começam em **NE — não executado**. Ao executar, substitua por **AP — aprovado**, **RP — reprovado** ou **BL — bloqueado**, indicando a evidência. Esta tabela é um inventário; execute na ordem dos fluxos dos roteiros vinculados, deixando o logout para o final.

| ID     | Operação sob `/api/v1`             | Conferência mínima                                                                                             | Estado / evidência |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------ |
| API-01 | `POST /auth/login`                 | Correto: 200 e sessão; errado: 401; campos ausentes: 422                                                       | NE                 |
| API-02 | `POST /auth/logout`                | 204; a mesma sessão recebe 401 em `/me` e livros depois                                                        | NE                 |
| API-03 | `GET /me`                          | Sem sessão: 401; autenticado: 200 com o funcionário correto e sem senha/hash                                   | NE                 |
| API-04 | `PATCH /me`                        | Nome/contatos/vínculo persistem; inválido ou sem editáveis: 422; vínculo inexistente: 404, já usado: 409; rollback integral | NE |
| API-05 | `PUT /me/senha`                    | Atual errada: 401; nova curta: 422; válida: 204; login antigo falha, novo funciona; outra sessão é invalidada  | NE                 |
| API-06 | `POST /funcionarios`               | 201 e login da nova conta funciona; duplicado: 409; inválido: 422; resposta sem senha/hash                     | NE                 |
| API-07 | `POST /livros`                     | 201, saldo calculado e ISBN normalizado; duplicado: 409; entradas inválidas: 422                               | NE                 |
| API-08 | `GET /livros`                      | 200, busca literal sem distinguir caixa/acentos, ordenação e ausência de inativos                              | NE                 |
| API-09 | `GET /livros/:id`                  | 200 com dados persistidos; inexistente/inativo/ID inválido: 404                                                | NE                 |
| API-10 | `PATCH /livros/:id`                | 200 preserva campos omitidos; estoque inválido: 422 sem gravação; saldo é calculado                            | NE                 |
| API-11 | `DELETE /livros/:id`               | Com empréstimo aberto: 409; depois da devolução: 204; consultas/repetição: 404; histórico preservado           | NE                 |
| API-12 | `POST /usuarios`                   | 201 com data do servidor; matrícula duplicada: 409; dados inválidos: 422                                       | NE                 |
| API-13 | `GET /usuarios`                    | 200; busca, tipo, status, paginação e total; inclui inativos quando não filtrados                              | NE                 |
| API-14 | `GET /usuarios/:id`                | 200 com leitor correto, inclusive inativo; inexistente/ID inválido: 404                                        | NE                 |
| API-15 | `PATCH /usuarios/:id`              | 200, edição parcial, remoção de opcional com null, inativação/reativação; aberto impede inativar com 409       | NE                 |
| API-16 | `GET /usuarios/:id/emprestimos`    | Histórico pertence ao leitor, mantém devolvidos; paginação/filtros corretos; resumo considera todo o histórico | NE                 |
| API-17 | `POST /emprestimos`                | 201, prazo de 7 dias, operador do servidor, saldo reduz uma unidade; repetição com mesma chave não duplica     | NE                 |
| API-18 | `GET /emprestimos`                 | 200; filtros por leitor/livro/status/vencimento, ordenação, paginação e total                                  | NE                 |
| API-19 | `GET /emprestimos/:id`             | 200 com status calculado; inexistente/ID inválido: 404                                                         | NE                 |
| API-20 | `POST /emprestimos/:id/renovacoes` | 200, mais 7 dias sobre vencimento anterior, contador; repetição não renova outra vez; terceira: 409            | NE                 |
| API-21 | `POST /emprestimos/:id/devolucao`  | 200, data/operador e saldo recomposto; mesma chave repete 200; chave nova após devolvido: 409                  | NE                 |
| API-22 | `GET /dashboard`                   | 200; conferir variações dos indicadores antes/depois dos cadastros, empréstimo e devolução                     | NE                 |
| API-23 | `GET /relatorios/pendencias`       | 200, abertos por padrão; devolvido sai; filtros/paginação corretos; filtro Devolvido: 422                      | NE                 |

O [roteiro de autenticação](como-testar-autenticacao.md) explica API-01–06. O [fluxo de livros e empréstimos](qat-e-proximos-passos.md#roteiro-manual-completo) cobre os cadastros e as movimentações. Os casos de busca/validação de livros têm passos na seção anterior desse roteiro.

### Compatibilidade com as telas atuais

Estes cenários complementam as 23 operações existentes; não acrescentam endpoints:

| ID | Conferência mínima | Estado / evidência |
| --- | --- | --- |
| COMPAT-01 | Perfil completo; contatos persistentes; inválido não altera; cargo/matrícula/contadores não podem ser forjados | NE |
| COMPAT-02 | Vínculo explícito e exclusivo; matrícula correta; contatos da conta/leitor independentes; disputa/404/409 sem edição parcial | NE |
| COMPAT-03 | Indicadores do leitor vinculado, não dos leitores atendidos; devolver mantém histórico; reinício preserva associação/contatos | NE |
| COMPAT-04 | Localização e nomes no próprio DTO em histórico/listas/painel/pendências; livro inativo mantém localização; sem partes usa fallback; GET atual e repetição idempotente original | NE |

O HTTP QAT exercita COMPAT-01–04 nos dois bancos; a suíte complementa concorrência, cadastro de conta com vínculo, atraso nos contadores, localização parcial e alteração posterior de localização.

## 4. Comprovar as regras e os efeitos

Nestes casos, **F** significa conferência funcional por cliente HTTP real ou Swagger; **A** permite evidência da suíte automatizada da versão testada. Combine os métodos quando o cenário exigir. Preencha método efetivo, resultado e referência. Rejeições precisam deixar estoque, contadores e histórico intactos.

| ID     | Cenário e resultado esperado                                                                                                                                                           | Método aceito                                 | Resultado / evidência |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------- |
| REG-01 | Até três empréstimos abertos; quarto dá 409; devolver um libera novo empréstimo                                                                                                        | F                                             | NE                    |
| REG-02 | Duas renovações de +7 dias sobre o prazo anterior; terceira dá 409                                                                                                                     | F                                             | NE                    |
| REG-03 | Qualquer atraso do leitor bloqueia novos empréstimos e todas as renovações; devolver todos os atrasados remove esse bloqueio                                                           | A ou F com fixture própria                    | NE                    |
| REG-04 | Estoque é total menos manutenção menos abertos; sem saldo dá 409; devolução recompõe uma unidade; manutenção total impede emprestar                                                    | F                                             | NE                    |
| REG-05 | Não inativar livro/leitor com abertos; depois das devoluções permitir inativar, preservando histórico; reativar leitor permite novo uso com livro ativo disponível                     | F                                             | NE                    |
| REG-06 | Mesma chave e dados repetem status/corpo sem outro efeito nas três escritas; mesma chave com outro corpo de cadastro dá 409; header ausente/inválido dá 422                            | F                                             | NE                    |
| REG-07 | Duas pessoas disputam último exemplar; empréstimos simultâneos respeitam limite global; edição/inativação concorrente mantém consistência; chave repetida em paralelo tem só um efeito | A                                             | NE                    |
| REG-08 | Datas usam São Paulo; hoje não é atraso; ontem é; renovação usa prazo anterior; campos de data/operador falsificados não são aceitos como verdade                                      | A, com conferência funcional do prazo inicial | NE                    |
| REG-09 | Reiniciar API preserva sessão e registros; repetir uma chave de sucesso após reinício mantém resultado e não duplica efeito                                                            | F                                             | NE                    |
| REG-10 | Matrícula permanece única inclusive em inativos; ISBN é único entre ativos e fica livre após a inativação (regra de 26/10); PATCH parcial preserva omitidos e null limpa opcionais; inválido não grava parcialmente | F                                             | NE                    |
| REG-11 | Dashboard e relatório conciliam com dados: acervo conta unidades, ativos incluem atrasados, pendentes são atrasados, vencem hoje não inclui devolvidos                                 | A e comparação funcional antes/depois         | NE                    |
| REG-12 | Paginação sem duplicar/perder registros em dados estáveis; filtros combinados e limites inclusivos; intervalo/parâmetros repetidos inválidos dão 422; símbolos de busca são literais   | A e uma página funcional com filtros          | NE                    |
| REG-13 | Sem sessão, as operações protegidas dão 401; funcionário inativo perde acesso; dados privados de autenticação não aparecem nas respostas                                               | A e 401 funcional em cada área                | NE                    |
| REG-14 | JSON inválido dá 400; corpo acima do limite dá 413; erro interno usa JSON genérico sem SQL/credenciais; erro de campo usa 422                                                          | A; cobertura incluída em 16/10                | NE                    |

Para métricas globais, compare valores **antes e depois** usando apenas suas movimentações e sem outras pessoas alterando o banco durante a conferência. Não espere um total fixo num banco já utilizado. Exemplo: criar livro com duas unidades soma 2 ao acervo; emprestar uma soma 1 aos empréstimos ativos e reduz o saldo do livro, sem reduzir o acervo; devolver reverte esses dois últimos efeitos.

Não é necessário reproduzir corridas manualmente se os testes correspondentes têm evidência aprovada nessa versão. A contagem total de testes, sozinha, não demonstra que um caso específico foi exercitado: associe o cenário e o arquivo/descrição do teste.

Na preparação inicial deste checklist faltavam casos explícitos de 413 e 500 genérico. A rodada de 16/10 acrescentou e aprovou esses casos em `backend/src/http/erros.test.ts`, além de corrigir os resultados 415 e a validação do nome no perfil. Consulte a evidência atual; a quantidade histórica de 207 testes não comprova esses resultados novos.

## 5. Registrar defeitos e decidir o aceite

Use um registro por defeito:

```text
Defeito e caso associado:
Versão e ambiente:
Passos/dados mínimos (IDs e chaves da rodada):
Esperado:
Observado: status HTTP, corpo e efeito nos dados
Gravidade: crítica | alta | média | baixa
Evidência:
Correção/commit:
Reteste: data, versão, resultado e evidência
```

Considere crítico o que expõe dados indevidos, perde/corrompe dados ou permite estoque inconsistente; alto o que impede o fluxo principal ou viola as regras confirmadas. Defeitos médios/baixos também precisam de decisão registrada. Uma divergência do contrato de que o frontend depende pode impedir o repasse mesmo sem perda de dados.

Critérios para declarar **backend aprovado para integração**:

- [ ] Versão final identificada e acessível; código, migrations e contrato correspondem às evidências.
- [ ] Ambiente reproduzível; migrations aprovadas; suíte backend completa e build com saída 0, sem falhas ou omissões injustificadas.
- [ ] API-01–23 e REG-01–14 concluídos pelos métodos previstos, com evidências; nenhum caso obrigatório NE/BL/RP.
- [ ] Nenhum defeito crítico/alto aberto. Qualquer defeito médio/baixo remanescente tem impacto e decisão de aceite registrados; desvio em caso obrigatório exige corrigir ou revisar explicitamente o escopo antes de aprovar.
- [ ] Código, migrations e contrato revisados; correções retestadas e regressão aprovada na versão final.
- [ ] Bianca recebeu o material abaixo e conseguiu acessar/subir a mesma versão e fazer login + uma consulta autenticada.

Até completar esses itens, use o estado **em homologação**. As evidências automatizadas de 15/10 não equivalem ao preenchimento desta rodada manual.

## 6. Material a entregar à Bianca

- Branch/commit e link do PR com CI aprovado. O fluxo previsto é preparar PR da implementação para `feat/backend-foundation`; o push nessa branch de destino aciona publicação. Planeje esse merge como etapa de publicação, com as verificações do ambiente cloud, antes de realizá-lo.
- [Contrato de campos e regras](specs/2026-10-15-apis-restantes-design.md), Swagger da versão e exemplos do [QAT detalhado](qat-e-proximos-passos.md).
- Como subir o backend e migrations localmente, criar conta local e configurar o frontend para alcançar essa API. Compartilhar URL local isolada não disponibiliza a API no computador dela.
- Registro preenchido desta rodada, logs/respostas sanitizados e defeitos/pendências. Guarde cópias que Bianca possa acessar; arquivos apenas em `tmp/` desta máquina não constituem evidência compartilhada. Remova senhas, cookies e tokens das capturas.
- Pontos de integração: sessão por cookie, tratamento de 401/409/422, datas ISO, paginação e preservação de `Idempotency-Key` em retentativas. Uma nova ação recebe chave nova.
- Pendências conhecidas: integração das telas, restauração de sessão após F5, logout na API, guards e testes Angular falhos; CSRF completo e limite de tentativas de login ainda não concluídos.

Publicar em homologação/produção exige uma rodada própria: confirmar configuração CHECK do TiDB Cloud, executar migrations ordenadas, verificar a revisão efetivamente atendida pela URL pública, saúde, autenticação e fluxo de empréstimo nessa URL. O QAT local não comprova essa publicação. Depois que Bianca integrar as telas, executar o aceite do sistema pela interface: login, acervo, leitores, empréstimo, renovação, devolução, indicadores, perfil, recarregamento, logout e mensagens de erro, incluindo as requisições reais na aba Network.

```text
Decisão: em homologação | aprovado para integração | reprovado
Rodada e versão:
Casos aprovados / reprovados / bloqueados / não executados:
Defeitos remanescentes e decisão:
Evidências compartilhadas:
Responsável e data do aceite:
Confirmação de acesso da Bianca:
```
