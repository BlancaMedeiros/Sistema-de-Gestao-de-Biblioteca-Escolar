# Bianca — guia rápido para testar e integrar as APIs

**API publicada e aprovada funcionalmente em 16/10/2026:** 23 operações, 39 cenários e 145 requisições HTTPS. Falta integrar as telas.

- **Swagger:** https://projeto-integrador-2-6352b.web.app/api/docs/
- **Base da API:** `https://projeto-integrador-2-6352b.web.app/api/v1`
- **Banco conectado:** https://projeto-integrador-2-6352b.web.app/api/ready

No Swagger, escolha **Examples → Try it out**, adapte e execute. Os caminhos abaixo usam a base `/api/v1`. Solicite uma conta ao Leonardo; senhas dos exemplos não garantem acesso à produção.

## Ordem de teste e integração

Use prefixo `BIA-<data-hora>` nos cadastros e guarde os IDs reais. Teste senha somente numa conta exclusiva.

| Etapa | Endpoints | O que conferir |
| --- | --- | --- |
| 1. Entrar | `POST /auth/login` → `GET /me` | 200, sessão e perfil corretos. |
| 2. Conta de teste | `POST /funcionarios` | 201; login único, exemplo sem `usuarioId`. Entre com a conta criada. |
| 3. Acervo | `POST /livros` → `GET /livros` → `GET /livros/{id}` → `PATCH /livros/{id}` | Cadastre duas unidades, manutenção zero; busque e altere localização. Saldo continua 2. |
| 4. Leitores | `POST /usuarios` → `GET /usuarios` → `GET /usuarios/{id}` → `PATCH /usuarios/{id}` | Leitor ativo, matrícula exclusiva. Teste busca, paginação e edição. Leitor não cria login. |
| 5. Emprestar | `POST /emprestimos` | IDs reais e chave nova; 201, saldo 1 e prazo de sete dias. Guarde o ID. |
| 6. Consultar efeitos | `GET /emprestimos` → `GET /emprestimos/{id}` → `GET /usuarios/{id}/emprestimos` → `GET /dashboard` → `GET /relatorios/pendencias` | Filtre pelos IDs; confira histórico, indicadores, nomes e `livroLocalizacao`. |
| 7. Renovar | `POST /emprestimos/{id}/renovacoes` | Corpo `{}`, chave nova; 200 e +7 dias sobre o prazo anterior. Terceira renovação: 409. |
| 8. Devolver | `POST /emprestimos/{id}/devolucao` | Corpo `{}`, chave nova; 200, `Devolvido`, saldo 2. Sai das pendências; permanece no histórico. |
| 9. Inativar testes | `DELETE /livros/{id}` e `PATCH /usuarios/{id}` com `{"status":"Inativo"}` | Após devolver: livro 204/consulta 404; leitor 200. Com empréstimo aberto: 409. |
| 10. Perfil e saída | `PATCH /me` → `PUT /me/senha` → `POST /auth/logout` | Perfil 200; senha atual/nova 204 e invalida outras sessões; logout 204 e `/me` 401. |

## Exemplo de empréstimo

Substitua os números pelos IDs devolvidos pelos cadastros:

```json
{ "livroId": 101, "usuarioId": 201 }
```

No Angular, gere o header `Idempotency-Key` com `crypto.randomUUID()` **uma vez por intenção**, no serviço. Retentativas mantêm chave/dados; uma nova ação recebe outra chave. Vale para emprestar, renovar e devolver; não é campo da tela.

## Cuidados na implementação das telas

- **HTTP/sessão:** substituir mocks; usar `/api/v1/...` e proxy correto. Restaurar sessão por `/me` após F5; sair pela API. Cookie HttpOnly é automático na mesma origem; localStorage não comprova sessão.
- **Respostas:** item em `data`; listas em `data` + `pagination`, padrão 20/máximo 100. Livros não são paginados. **204 não contém JSON.**
- **PATCH:** omitir preserva; `null` limpa opcionais. Telefone é string; contatos/matrícula podem ser nulos. Sem leitor associado, indicadores pessoais são zero.
- **Servidor:** calcula saldo, status, operador e datas. Exibir `YYYY-MM-DD` como data civil. Até três empréstimos abertos; atraso bloqueia nova retirada/renovação.
- **Erros:** 401 pede sessão; 404 indica indisponibilidade; 409 informa conflito; 422 traz `error.fields`. Preserve formulário, aguarde sucesso e releia os dados após movimentar.

Depois, repetir o fluxo **pelas telas**, conferindo Network e persistência após F5. Desenvolvimento local e contratos completos: [guia detalhado](entrega-backend-bianca.md).
