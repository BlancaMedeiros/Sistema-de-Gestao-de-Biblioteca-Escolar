# Como testar autenticação, perfil e funcionários

**Roteiro atualizado em 16/10/2026. Execução manual pendente.** Cobre as seis operações de acesso e perfil do [checklist de aceite](qat-aceite-backend.md). As outras APIs também existem localmente: consulte o [QAT completo](qat-e-proximos-passos.md) e o [contrato](specs/2026-10-15-apis-restantes-design.md). As evidências automatizadas de 15/10 estão no QAT; não constituem execução manual deste roteiro.

## 1. Preparar o ambiente e a conta da rodada

Com Docker Desktop em execução, dentro da raiz do clone e com `.env` local preenchido:

```powershell
docker compose up -d --build backend
docker compose ps -a
```

Espere `backend`/`mysql` saudáveis e `migrate` concluído com código 0. Consulte prontidão em <http://127.0.0.1:3000/api/ready> e Swagger em <http://127.0.0.1:3000/api/docs/>. O Swagger acrescenta `/api/v1` às rotas abaixo.

A seed cria `bibliotecaria.teste` e `funcionaria.teste`, inicialmente com senha `Teste@123`, e preserva senhas já alteradas. Em 15/10, `funcionaria.teste` autenticou com essa senha; `bibliotecaria.teste` a rejeitou. Esse registro não garante as senhas de uma execução futura. Se nenhuma conta local estiver acessível, crie outra com `npm.cmd run dev:funcionario:criar`; o comando solicita os dados e exige dependências do backend instaladas no host (`npm.cmd ci --prefix backend`).

Para testar troca de senha sem modificar a conta usada por outras pessoas, primeiro entre com uma conta local acessível e crie um funcionário exclusivo da rodada:

```json
{
  "nome": "Funcionária QAT",
  "login": "qat.AAAAMMDD.HHMM",
  "senha": "QatInicial@123"
}
```

Substitua o login por um identificador novo. Funcionário é conta de acesso; leitor de `/usuarios` é outro cadastro.

## 2. Login, cadastro e sessão pelo Swagger

Em cada operação, expanda **Try it out**, preencha os campos e clique em **Execute**. Confira status, corpo e efeito descritos abaixo. O login estabelece o cookie `__session` na mesma origem; não é necessário copiar cookie para Authorize. Não inclua cookies/senhas nas evidências compartilhadas.

| Passo | Ação                                                            | Esperado                                                   |
| ----- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| 1     | Antes do login, executar `GET /me` e `POST /funcionarios`       | 401 `NAO_AUTENTICADO`; nenhum funcionário criado           |
| 2     | `POST /auth/login` com `{}`                                     | 422 `DADOS_INVALIDOS`                                      |
| 3     | Login válido com senha errada                                   | 401 `CREDENCIAIS_INVALIDAS`                                |
| 4     | Login com uma conta local acessível                             | 200, dados do funcionário sem senha/hash; cookie de sessão |
| 5     | `GET /me`                                                       | 200 com os dados da conta autenticada                      |
| 6     | `POST /funcionarios` com os dados exclusivos da rodada          | 201, ID/nome/login; sem senha/hash                         |
| 7     | Repetir o cadastro com o mesmo login                            | 409 `LOGIN_DUPLICADO`; conta original preservada           |
| 8     | Tentar cadastro com nome vazio, login com espaço ou senha curta | 422, sem cadastro parcial                                  |
| 9     | `POST /auth/logout`                                             | 204, sem corpo                                             |
| 10    | Repetir `GET /me` e `GET /livros`                               | 401 em ambos                                               |
| 11    | Fazer login com a conta exclusiva criada no passo 6             | 200; `/me` mostra essa conta                               |

## 3. Perfil e troca de senha da conta exclusiva

Com a conta `qat.…` autenticada:

1. `PATCH /me` com `{"nome":"Funcionária QAT Renomeada"}`: 200. `GET /me` deve refletir o nome e manter o login original.
2. PATCH com `{"nome":""}` e depois `{}`: 422, sem alterar o nome. Login enviado junto de um nome válido não altera o login.
3. Abra o Swagger em outro navegador ou numa janela privada e faça login **com a mesma conta exclusiva**. Confirme `GET /me` com 200 nos dois contextos. Duas abas normais compartilham cookie e não comprovam duas sessões distintas.
4. No primeiro contexto, `PUT /me/senha` com `{"senhaAtual":"errada","novaSenha":"QatAlterada@123"}`: 401 `SENHA_ATUAL_INVALIDA`; senha permanece intacta.
5. Envie `{"senhaAtual":"QatInicial@123","novaSenha":"curta"}`: 422; senha permanece intacta.
6. Envie `{"senhaAtual":"QatInicial@123","novaSenha":"QatAlterada@123"}`: 204. A sessão que executou a troca continua com `/me` 200; o outro contexto passa a receber 401.
7. No contexto já sem sessão, tente a senha antiga: login 401. Com a nova: 200.
8. Se quiser restaurar a senha inicial da conta exclusiva, use a própria API autenticada: `PUT /me/senha` com `{"senhaAtual":"QatAlterada@123","novaSenha":"QatInicial@123"}`. Espere 204 e confirme o login com a senha restaurada em um contexto sem sessão.
9. Encerre as sessões utilizadas por `POST /auth/logout`. Uma sessão invalidada já responde 401; na sessão ainda válida o logout responde 204.

Não apague sessões de outras contas nem remova/recrie funcionários para restaurar senha. A seed não redefine senha e o funcionário pode estar ligado ao histórico de movimentações.

## 4. Persistência e proteção das demais áreas

Faça login novamente. Recarregue o Swagger, execute `/me`, reinicie o backend com `docker compose restart backend`, aguarde prontidão e repita `/me`: a sessão deve continuar válida dentro do seu prazo. O teste é da sessão HTTP no backend; a restauração da sessão no Angular após F5 ainda precisa de integração.

Em um contexto sem sessão, confira 401 em livros, leitores, empréstimos, dashboard, pendências e cadastro de funcionários. A suíte automatizada também verifica bloqueio de funcionário inativo e proteção das operações; inativação de funcionário não possui endpoint nesta entrega.

Para repetir os testes automatizados e build no ambiente local:

```powershell
docker compose exec -T backend npm test
docker compose exec -T backend npm run build
```

Registre os resultados, versão e evidências nos casos API-01–06 e REG-09/13 do [checklist de aceite](qat-aceite-backend.md). Não marque AP apenas por seguir as instruções: registre o resultado observado. CSRF completo, limite de tentativas e homologação pela interface Angular continuam pendentes, conforme o QAT.
