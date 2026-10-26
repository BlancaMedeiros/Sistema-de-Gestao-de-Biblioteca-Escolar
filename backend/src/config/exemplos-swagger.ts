// Dados fictícios para documentação. Não criam registros nem representam uma seed.
// IDs de exemplo devem ser substituídos pelos IDs devolvidos pela API local.
const funcionarioMinimo = {
  nome: 'Ana Silva',
  login: 'ana.silva',
  senha: 'Teste@123',
};
const funcionarioCompleto = {
  ...funcionarioMinimo,
  email: 'ana@example.test',
  telefone: '+55 11 99999-9999',
};
const leitorMinimo = {
  nome: 'João Pereira',
  matricula: 'ALU-2026-001',
  tipo: 'Aluno',
};
const leitorCompleto = {
  ...leitorMinimo,
  email: 'joao@example.test',
  telefone: '+55 11 98888-8888',
  turma: '5A',
  status: 'Ativo',
};
const livroMinimo = {
  titulo: 'O Pequeno Príncipe',
  autor: 'Antoine de Saint-Exupéry',
  quantidadeTotal: 5,
};
const livroCompleto = {
  ...livroMinimo,
  isbn: '9788595081512',
  categoria: 'Literatura infantojuvenil',
  anoPublicacao: 2017,
  quantidadeManutencao: 1,
  estante: 'E1',
  prateleira: 'P2',
};

export const dadosExemploSwagger = {
  funcionarioMinimo,
  funcionarioCompleto,
  leitorMinimo,
  leitorCompleto,
  livroMinimo,
  livroCompleto,
  perfil: {
    id: 42,
    nome: funcionarioCompleto.nome,
    login: funcionarioCompleto.login,
    email: funcionarioCompleto.email,
    telefone: funcionarioCompleto.telefone,
    usuarioId: null,
    matricula: null,
    cargo: 'Funcionário autorizado',
    emprestimosAtivos: 0,
    historicoTotal: 0,
  },
  leitor: { id: 201, ...leitorCompleto, dataCadastro: '2026-10-16' },
  livro: { id: 101, ...livroCompleto, quantidadeDisponivel: 4, status: 'Disponível' },
  emprestimoEntrada: { livroId: 101, usuarioId: 201 },
  emprestimo: {
    id: 301,
    livroId: 101,
    livroTitulo: livroMinimo.titulo,
    livro: livroMinimo.titulo,
    livroEstante: 'E1',
    livroPrateleira: 'P2',
    livroLocalizacao: 'E1 - P2',
    usuarioId: 201,
    usuarioNome: leitorMinimo.nome,
    usuario: leitorMinimo.nome,
    funcionarioId: 42,
    dataEmprestimo: '2026-10-16',
    devolucaoPrevista: '2026-10-23',
    devolucaoReal: null,
    devolvidoPor: null,
    quantidadeRenovacoes: 0,
    status: 'Em Andamento',
  },
};

// Exemplos nomeados aparecem no seletor do Swagger, com a finalidade de cada payload.
export const exemplosSwagger = {
  LoginLocal: {
    summary: 'Entrar com a conta de desenvolvimento',
    description:
      'A seed local cria esta conta com a senha inicial abaixo. Se a senha já foi alterada, use a atual; a seed não a redefine.',
    value: { login: 'funcionaria.teste', senha: 'Teste@123' },
  },
  LoginContaCriada: {
    summary: 'Entrar com a conta criada por POST /funcionarios',
    description: 'Crie ana.silva primeiro ou substitua por uma conta já cadastrada.',
    value: { login: funcionarioMinimo.login, senha: funcionarioMinimo.senha },
  },
  FuncionarioMinimo: {
    summary: 'Cadastrar apenas os campos obrigatórios',
    description: 'Exige sessão de funcionário. Escolha um login ainda não utilizado.',
    value: funcionarioMinimo,
  },
  FuncionarioCompleto: {
    summary: 'Cadastrar com contatos opcionais',
    description:
      'O backend gera o ID da conta. Telefone é texto. Não é necessário vincular um leitor para criar o funcionário.',
    value: funcionarioCompleto,
  },
  PerfilContatos: {
    summary: 'Editar nome e contatos do próprio perfil',
    description: 'Campos omitidos são preservados; contatos não alteram o cadastro de leitor.',
    value: {
      nome: 'Ana Silva Santos',
      email: 'ana.santos@example.test',
      telefone: '+55 11 97777-7777',
    },
  },
  PerfilLimparContato: {
    summary: 'Remover um contato opcional',
    description: 'null apaga somente o contato enviado; os demais dados são preservados.',
    value: { telefone: null },
  },
  TrocaSenha: {
    summary: 'Trocar senha da conta de teste criada acima',
    description:
      'Substitua senhaAtual pela senha vigente. Sucesso retorna 204 sem corpo e invalida as outras sessões da mesma conta.',
    value: { senhaAtual: 'Teste@123', novaSenha: 'NovaSenha@456' },
  },
  LeitorMinimo: {
    summary: 'Cadastrar leitor com os campos obrigatórios',
    description: 'Use matrícula ainda não cadastrada. Este cadastro não cria login ou senha.',
    value: leitorMinimo,
  },
  LeitorCompleto: {
    summary: 'Cadastrar leitor com contatos e turma',
    description: 'O ID e a data de cadastro são gerados pelo servidor.',
    value: leitorCompleto,
  },
  LeitorEdicao: {
    summary: 'Atualizar turma e remover telefone',
    description: 'Edição parcial: não é necessário reenviar nome, matrícula ou tipo.',
    value: { turma: '5B', telefone: null },
  },
  LeitorInativacao: {
    summary: 'Inativar leitor sem empréstimos abertos',
    description: 'Se houver empréstimo aberto, retorna 409. Para reativar, envie status Ativo.',
    value: { status: 'Inativo' },
  },
  LivroMinimo: {
    summary: 'Cadastrar título e quantidade, sem ISBN',
    description:
      'Manutenção começa em zero; disponibilidade e status são calculados pelo servidor.',
    value: livroMinimo,
  },
  LivroCompleto: {
    summary: 'Cadastrar livro com localização e manutenção',
    description:
      'Neste exemplo, 5 unidades menos 1 em manutenção deixam 4 disponíveis. ISBN é único entre livros ativos; troque-o se já estiver em uso.',
    value: livroCompleto,
  },
  LivroEdicao: {
    summary: 'Alterar localização sem modificar o estoque',
    description: 'Envie somente os campos a alterar; campos omitidos são preservados.',
    value: { estante: 'E2', prateleira: 'P3' },
  },
  LivroEstoque: {
    summary: 'Atualizar estoque total e manutenção juntos',
    description:
      'Total deve comportar manutenção e empréstimos abertos. O cliente não informa quantidadeDisponivel.',
    value: { quantidadeTotal: 6, quantidadeManutencao: 1 },
  },
  EmprestimoCadastro: {
    summary: 'Emprestar uma unidade a um leitor cadastrado',
    description:
      'Substitua 101 e 201 pelos IDs reais do livro e do leitor. Informe uma Idempotency-Key nova no header; datas e funcionário vêm do servidor.',
    value: dadosExemploSwagger.emprestimoEntrada,
  },
  AcaoEmprestimo: {
    summary: 'Executar a ação sem campos adicionais',
    description:
      'Use o ID real do empréstimo no caminho e uma Idempotency-Key no header. O corpo pode ser omitido ou ser {}.',
    value: {},
  },
};
