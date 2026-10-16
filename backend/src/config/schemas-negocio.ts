const inteiro = { type: 'integer', minimum: 0 };
const identificador = { type: 'integer', minimum: 1, maximum: 4294967295 };
const data = { type: 'string', format: 'date', example: '2026-10-15' };
const propriedadesUsuario = {
  nome: { type: 'string', minLength: 1, maxLength: 160 },
  matricula: {
    type: 'string',
    minLength: 1,
    maxLength: 60,
    description: 'Única inclusive entre inativos; espaços das pontas são removidos.',
  },
  email: { type: 'string', format: 'email', maxLength: 254, nullable: true },
  telefone: { type: 'string', maxLength: 30, nullable: true },
  turma: { type: 'string', maxLength: 100, nullable: true },
  tipo: { type: 'string', enum: ['Aluno', 'Professor', 'Bibliotecário'] },
  status: { type: 'string', enum: ['Ativo', 'Inativo'], default: 'Ativo' },
};
const resumoUsuario = {
  type: 'object',
  properties: { totalEmprestimos: inteiro, emprestimosAtivos: inteiro, atrasados: inteiro },
};
const schemaLista = (nome: string) => ({
  type: 'object',
  required: ['data', 'pagination'],
  properties: {
    data: { type: 'array', items: { $ref: `#/components/schemas/${nome}` } },
    pagination: { $ref: '#/components/schemas/Paginacao' },
  },
});
const respostaItem = (nome: string) => ({
  description: 'Registro persistido.',
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data: { $ref: `#/components/schemas/${nome}` } } },
    },
  },
});
const respostaLista = (nome: string) => ({
  description: 'Lista paginada.',
  content: { 'application/json': { schema: schemaLista(nome) } },
});
const respostaErro = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
});
const filtroId = (name: string) => ({ in: 'query', name, schema: identificador });

export const componentesNegocio = {
  parameters: {
    RecursoId: { in: 'path', name: 'id', required: true, schema: identificador },
    Page: {
      in: 'query',
      name: 'page',
      schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 },
    },
    PageSize: {
      in: 'query',
      name: 'pageSize',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
    UsuarioFiltro: filtroId('usuarioId'),
    LivroFiltro: filtroId('livroId'),
    BuscaMovimentacao: {
      in: 'query',
      name: 'busca',
      description: 'Texto literal no título, nome do leitor ou matrícula; ignora caixa/acentos.',
      schema: { type: 'string', maxLength: 100 },
    },
    StatusEmprestimo: {
      in: 'query',
      name: 'status',
      schema: { type: 'string', enum: ['Em Andamento', 'Atrasado', 'Devolvido', 'Abertos'] },
    },
    VencimentoDe: { in: 'query', name: 'vencimentoDe', schema: data },
    VencimentoAte: { in: 'query', name: 'vencimentoAte', schema: data },
    IdempotencyKey: {
      in: 'header',
      name: 'Idempotency-Key',
      required: true,
      description:
        'Uma chave por intenção. Reutilize em retentativas da mesma operação; uma intenção nova exige outra chave. Retorna o mesmo status/corpo sem repetir o efeito.',
      schema: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[A-Za-z0-9._:-]+$',
        example: 'operacao-01',
      },
    },
  },
  responses: {
    UsuarioEncontrado: respostaItem('Usuario'),
    ListaUsuarios: respostaLista('Usuario'),
    EmprestimoEncontrado: respostaItem('Emprestimo'),
    ListaEmprestimos: respostaLista('Emprestimo'),
    HistoricoUsuario: {
      description:
        'Histórico paginado e resumo de todos os empréstimos do leitor, independentemente dos filtros.',
      content: {
        'application/json': {
          schema: {
            ...schemaLista('Emprestimo'),
            properties: { ...schemaLista('Emprestimo').properties, resumo: resumoUsuario },
          },
        },
      },
    },
    NaoEncontrado: respostaErro('404: leitor, livro ou empréstimo inexistente/ID inválido.'),
    ConflitoNegocio: respostaErro(
      '409: duplicidade de matrícula/login, estado incompatível, limite de empréstimos/renovações, atraso ou chave de idempotência reutilizada com outros dados.',
    ),
  },
  schemas: {
    Paginacao: {
      type: 'object',
      required: ['page', 'pageSize', 'total'],
      properties: {
        page: { type: 'integer', minimum: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100 },
        total: inteiro,
      },
    },
    UsuarioEntrada: {
      type: 'object',
      required: ['nome', 'matricula', 'tipo'],
      properties: propriedadesUsuario,
      description:
        'Contato/turma opcionais; texto vazio vira null. Cadastro de leitor não concede acesso ao sistema.',
    },
    UsuarioEdicao: {
      type: 'object',
      minProperties: 1,
      properties: propriedadesUsuario,
      description:
        'Ao menos um campo editável. status Inativo exige ausência de empréstimos abertos; pode reativar com Ativo.',
    },
    Usuario: {
      type: 'object',
      required: ['id', 'nome', 'matricula', 'tipo', 'status', 'dataCadastro'],
      properties: {
        id: identificador,
        ...propriedadesUsuario,
        dataCadastro: { ...data, readOnly: true },
      },
    },
    FuncionarioEntrada: {
      type: 'object',
      required: ['nome', 'login', 'senha'],
      properties: {
        nome: { type: 'string', minLength: 1, maxLength: 120 },
        login: { type: 'string', minLength: 1, maxLength: 60, pattern: '^\\S+$' },
        senha: {
          type: 'string',
          format: 'password',
          minLength: 8,
          maxLength: 1024,
          writeOnly: true,
        },
      },
    },
    EmprestimoEntrada: {
      type: 'object',
      required: ['livroId', 'usuarioId'],
      properties: { livroId: identificador, usuarioId: identificador },
      description: 'Datas e funcionário são definidos no servidor; empresta uma unidade.',
    },
    Emprestimo: {
      type: 'object',
      properties: {
        id: identificador,
        livroId: identificador,
        livroTitulo: { type: 'string' },
        usuarioId: identificador,
        usuarioNome: { type: 'string' },
        funcionarioId: identificador,
        dataEmprestimo: data,
        devolucaoPrevista: data,
        devolucaoReal: { ...data, nullable: true },
        devolvidoPor: { ...identificador, nullable: true },
        quantidadeRenovacoes: { type: 'integer', minimum: 0, maximum: 2 },
        status: { type: 'string', enum: ['Em Andamento', 'Atrasado', 'Devolvido'] },
      },
    },
    Dashboard: {
      type: 'object',
      properties: {
        dataReferencia: data,
        metricas: {
          type: 'object',
          properties: {
            totalAcervo: inteiro,
            emprestimosAtivos: {
              ...inteiro,
              description: 'Todos os abertos, incluindo atrasados.',
            },
            devolucoesPendentes: {
              ...inteiro,
              description: 'Abertos com vencimento anterior a hoje.',
            },
            usuariosAtivos: inteiro,
            devolucoesHoje: inteiro,
          },
        },
        ultimosEmprestimos: {
          type: 'array',
          maxItems: 4,
          items: { $ref: '#/components/schemas/Emprestimo' },
        },
        devolucoesHoje: {
          type: 'array',
          maxItems: 20,
          description:
            'Primeira página; metricas.devolucoesHoje informa o total. Use o relatório com intervalo igual a hoje para percorrer todas.',
          items: { $ref: '#/components/schemas/Emprestimo' },
        },
      },
    },
  },
};
