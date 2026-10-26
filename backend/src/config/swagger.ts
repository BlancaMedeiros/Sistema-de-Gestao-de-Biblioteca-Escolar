import path from 'node:path';
import { fileURLToPath } from 'node:url';

import swaggerJSDoc from 'swagger-jsdoc';
import { componentesNegocio } from './schemas-negocio.js';
import { dadosExemploSwagger as exemplos, exemplosSwagger } from './exemplos-swagger.js';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const propriedadesLivro = {
  titulo: {
    type: 'string',
    minLength: 1,
    maxLength: 255,
    example: exemplos.livroMinimo.titulo,
  },
  autor: { type: 'string', minLength: 1, maxLength: 255, example: exemplos.livroMinimo.autor },
  isbn: {
    type: 'string',
    nullable: true,
    description:
      'ISBN-10 ou ISBN-13; hífens e espaços são removidos. Opcional, sem validação do dígito de controle.',
    example: exemplos.livroCompleto.isbn,
  },
  categoria: {
    type: 'string',
    nullable: true,
    maxLength: 100,
    example: 'Literatura infantojuvenil',
  },
  anoPublicacao: {
    type: 'integer',
    nullable: true,
    minimum: 1000,
    description: 'Até o ano seguinte ao atual.',
    example: 2017,
  },
  quantidadeTotal: { type: 'integer', minimum: 1, maximum: 4294967295, example: 5 },
  quantidadeManutencao: {
    type: 'integer',
    minimum: 0,
    maximum: 4294967295,
    default: 0,
    description: 'Não pode exceder o total.',
    example: 1,
  },
  estante: { type: 'string', nullable: true, maxLength: 60, example: 'Estante 01' },
  prateleira: { type: 'string', nullable: true, maxLength: 60, example: 'Prateleira A' },
};
const respostaErro = (
  description: string,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Erro' },
      example: { error: { code, message, ...(fields ? { fields } : {}) } },
    },
  },
});

// A base do OpenAPI é /api/v1, mesmo prefixo com que as rotas de negócio
// são montadas no Express — cada arquivo *.routes.ts documenta seus
// caminhos relativos a essa base em um bloco JSDoc @openapi acima do
// handler. O contrato cresce endpoint a endpoint, sem precisar manter um
// YAML separado.
const definition = {
  openapi: '3.0.3',
  info: {
    title: 'API do Sistema de Gestão de Biblioteca Escolar',
    version: '0.1.0',
    description: [
      'Guia de integração das **23 operações de negócio**. Os exemplos são fictícios: não criam registros e seus IDs devem ser substituídos pelos retornados pela API.',
      '### Comece por aqui',
      '1. Confirme a conexão com o banco em [GET /ready](/ready).',
      '2. Execute **POST /auth/login**. No ambiente local, escolha o exemplo da conta de desenvolvimento; a seed não redefine senhas alteradas.',
      '3. Cadastre ou consulte **livros** e **leitores**; guarde `data.id` de cada um.',
      '4. Crie um empréstimo com esses IDs e uma `Idempotency-Key` nova. Use o ID retornado para consultar, renovar ou devolver.',
      '### Sessão e dados de entrada',
      'O login cria o cookie `__session`. No Swagger, permaneça na mesma origem: o navegador o envia automaticamente; não cole cookie em Authorize. Um cliente HTTP independente precisa fazer seu próprio login.',
      '**Funcionário** é a conta de acesso (`login` e `senha`). **Leitor** é quem recebe empréstimos, cadastrado em `/usuarios`; criar leitor não cria login. Os IDs são gerados pelo backend. O vínculo opcional entre conta e leitor não é necessário no cadastro de funcionário e foi omitido dos exemplos.',
      'Use o seletor **Examples** para escolher cadastro mínimo/completo ou edição parcial. Em PATCH, envie somente o que mudou; omitir preserva o valor e `null` apaga campos opcionais. Telefone é texto para preservar DDI e formatação.',
      '### Respostas e regras',
      'Item: `{ "data": { ... } }`. Listagem paginada: `{ "data": [], "pagination": { "page": 1, "pageSize": 20, "total": 0 } }`. Livros não têm paginação. **204 não tem corpo**.',
      'Erros retornam o objeto `error`, com `code`, `message` e, quando aplicável, `fields`: **401** pede login ou senha correta; **404** indica recurso não encontrado; **409** indica conflito de regra/duplicidade; **422** indica dados inválidos. Preserve o formulário e apresente o motivo recebido.',
      'Empréstimos: 7 dias corridos, até 3 abertos por leitor, até 2 renovações de +7 dias sobre o prazo anterior. Qualquer atraso bloqueia novos empréstimos e renovações. Datas civis usam `YYYY-MM-DD` e o dia de `America/Sao_Paulo`; o servidor define datas, operador, status e disponibilidade.',
      'Em retentativas de empréstimo, renovação ou devolução, mantenha chave e dados da intenção original. Uma nova ação exige chave nova. A repetição devolve a resposta original; consulte por GET para obter o estado atual.',
    ].join('\n\n'),
  },
  tags: [
    {
      name: 'Auth',
      description: '1. Entre, consulte/edite o próprio perfil, troque a senha e encerre a sessão.',
    },
    {
      name: 'Funcionários',
      description:
        '2. Cadastre contas de acesso. Exige uma conta autenticada; todos têm o mesmo nível de permissão.',
    },
    {
      name: 'Livros',
      description:
        '3. Cadastre o acervo e guarde o ID. Saldo = total − manutenção − empréstimos abertos.',
    },
    {
      name: 'Leitores',
      description:
        '4. Cadastre quem recebe os livros e guarde o ID. Inclui histórico, inativação e reativação.',
    },
    {
      name: 'Empréstimos',
      description:
        '5. Use IDs reais de livro/leitor. Cada escrita exige Idempotency-Key; não envie datas ou operador.',
    },
    {
      name: 'Dashboard',
      description: '6. Consulte indicadores e movimentações recentes após as escritas.',
    },
    {
      name: 'Relatórios',
      description:
        '7. Consulte pendências abertas; filtre Atrasado quando precisar somente dos atrasos.',
    },
  ],
  servers: [{ url: '/api/v1', description: 'Prefixo de todas as rotas de negócio' }],
  components: {
    examples: exemplosSwagger,
    securitySchemes: {
      sessao: {
        type: 'apiKey',
        in: 'cookie',
        name: '__session',
        description:
          'Faça POST /auth/login na mesma origem. O navegador mantém o cookie HttpOnly automaticamente; no Swagger não é necessário preencher Authorize.',
      },
    },
    parameters: {
      ...componentesNegocio.parameters,
      LivroId: {
        name: 'id',
        in: 'path',
        required: true,
        description:
          'ID real devolvido por POST/GET /livros. Substitua 101 pelo ID do seu cadastro.',
        schema: { type: 'integer', minimum: 1, maximum: 4294967295, example: 101 },
      },
    },
    responses: {
      ...componentesNegocio.responses,
      SemSessao: respostaErro(
        '401 NAO_AUTENTICADO: sessão ausente ou expirada. Faça login e tente novamente.',
        'NAO_AUTENTICADO',
        'Sessão ausente ou expirada.',
      ),
      DadosInvalidos: respostaErro(
        '422 DADOS_INVALIDOS: fields indica os campos inválidos; corpo indica erro no objeto inteiro.',
        'DADOS_INVALIDOS',
        'Confira os dados informados.',
        { nome: ['Informe um nome não vazio.'] },
      ),
      LivroNaoEncontrado: respostaErro(
        '404 LIVRO_NAO_ENCONTRADO: ID inválido, inexistente ou livro inativo.',
        'LIVRO_NAO_ENCONTRADO',
        'Livro não encontrado.',
      ),
      IsbnDuplicado: respostaErro(
        '409 ISBN_DUPLICADO: ISBN em uso por outro livro ativo; o de livro excluído pode ser reutilizado.',
        'ISBN_DUPLICADO',
        'Este ISBN já está cadastrado em outro livro ativo.',
      ),
      LivroEncontrado: {
        description: 'Livro ativo com disponibilidade calculada.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { data: { $ref: '#/components/schemas/Livro' } },
            },
          },
        },
      },
    },
    schemas: {
      ...componentesNegocio.schemas,
      LoginEntrada: {
        type: 'object',
        required: ['login', 'senha'],
        properties: {
          login: {
            type: 'string',
            minLength: 1,
            example: 'funcionaria.teste',
            description: 'Nome de acesso de conta já cadastrada; não é o nome do leitor.',
          },
          senha: {
            type: 'string',
            format: 'password',
            minLength: 1,
            writeOnly: true,
            example: 'Teste@123',
            description:
              'Senha atual da conta. O exemplo só funciona se a conta local ainda tiver essa senha.',
          },
        },
        example: exemplosSwagger.LoginLocal.value,
      },
      TrocaSenhaEntrada: {
        type: 'object',
        required: ['senhaAtual', 'novaSenha'],
        properties: {
          senhaAtual: {
            type: 'string',
            format: 'password',
            minLength: 1,
            writeOnly: true,
            example: 'Teste@123',
            description: 'Senha vigente da conta autenticada.',
          },
          novaSenha: {
            type: 'string',
            format: 'password',
            minLength: 8,
            writeOnly: true,
            example: 'NovaSenha@456',
            description:
              'Nova senha com pelo menos oito caracteres. Invalida outras sessões da conta.',
          },
        },
        example: exemplosSwagger.TrocaSenha.value,
      },
      LivroEntrada: {
        type: 'object',
        description:
          'Texto é aparado; opcionais vazios viram null. Campos desconhecidos, status e quantidadeDisponivel são ignorados.',
        properties: propriedadesLivro,
        example: exemplos.livroCompleto,
      },
      LivroCadastro: {
        allOf: [{ $ref: '#/components/schemas/LivroEntrada' }],
        required: ['titulo', 'autor', 'quantidadeTotal'],
        example: exemplos.livroCompleto,
      },
      LivroEdicao: {
        allOf: [{ $ref: '#/components/schemas/LivroEntrada' }],
        minProperties: 1,
        description:
          'Ao menos um campo editável; null apaga um campo opcional. As quantidades são validadas após combinar com o registro atual.',
        example: { estante: 'E2', prateleira: 'P3' },
      },
      Livro: {
        type: 'object',
        required: ['id', ...Object.keys(propriedadesLivro), 'quantidadeDisponivel', 'status'],
        properties: {
          id: {
            type: 'integer',
            readOnly: true,
            example: 101,
            description: 'Gerado pelo backend no cadastro.',
          },
          ...propriedadesLivro,
          quantidadeDisponivel: {
            type: 'integer',
            readOnly: true,
            description: 'Total menos manutenção e empréstimos abertos; calculado pelo servidor.',
          },
          status: {
            type: 'string',
            readOnly: true,
            enum: ['Disponível', 'Em Manutenção', 'Esgotado'],
          },
        },
        example: exemplos.livro,
      },
      FuncionarioPerfil: {
        type: 'object',
        required: [
          'id',
          'nome',
          'login',
          'email',
          'telefone',
          'usuarioId',
          'matricula',
          'cargo',
          'emprestimosAtivos',
          'historicoTotal',
        ],
        properties: {
          id: {
            type: 'integer',
            readOnly: true,
            example: 42,
            description: 'ID da conta, gerado pelo backend. Não é o ID do leitor.',
          },
          nome: { type: 'string', example: 'Ana Silva' },
          login: {
            type: 'string',
            example: 'ana.silva',
            description: 'Nome de acesso da conta; não é a senha.',
          },
          email: {
            type: 'string',
            format: 'email',
            maxLength: 254,
            nullable: true,
            example: 'ana@example.test',
          },
          telefone: { ...componentesNegocio.schemas.FuncionarioEntrada.properties.telefone },
          usuarioId: {
            type: 'integer',
            minimum: 1,
            nullable: true,
            example: null,
            description: 'Vínculo explícito ao leitor; não é inferido pelo ID, nome ou e-mail.',
          },
          matricula: {
            type: 'string',
            nullable: true,
            readOnly: true,
            description: 'Do leitor vinculado; null quando não há vínculo.',
          },
          cargo: { type: 'string', enum: ['Funcionário autorizado'], readOnly: true },
          emprestimosAtivos: {
            type: 'integer',
            minimum: 0,
            readOnly: true,
            description:
              'Empréstimos abertos do leitor vinculado, inclusive atrasados; zero sem vínculo.',
          },
          historicoTotal: {
            type: 'integer',
            minimum: 0,
            readOnly: true,
            description:
              'Total de empréstimos do leitor vinculado, não livros comprovadamente lidos; zero sem vínculo.',
          },
        },
        example: exemplos.perfil,
      },
      Erro: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                example: 'DADOS_INVALIDOS',
                description:
                  'Código estável para tratar o erro no cliente; a mensagem detalha o motivo.',
              },
              message: { type: 'string', example: 'Confira os dados informados.' },
              fields: {
                type: 'object',
                additionalProperties: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        example: {
          error: {
            code: 'DADOS_INVALIDOS',
            message: 'Confira os dados informados.',
            fields: { nome: ['Informe um nome não vazio.'] },
          },
        },
      },
    },
  },
};

export const swaggerSpec = swaggerJSDoc({
  definition,
  // O glob usa barras normais também no Windows; barras invertidas podem
  // ser interpretadas como escapes e gerar um contrato sem nenhuma rota.
  apis: [path.join(configDir, '..', 'modules', '**', '*.routes.{ts,js}').replaceAll('\\', '/')],
});
