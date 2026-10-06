import { carregarEnvAiven } from '../config/aiven-env.js';
import { loadLocalEnv } from '../config/local-env.js';
import type { DadosNovoFuncionario } from '../modules/auth/provisionar-funcionario.js';
import { SENHA_MINIMA } from '../modules/auth/password.js';

// Cadastra um funcionário com senha escolhida na hora (nunca fixa no código).
//   npm run dev:funcionario:criar    -> banco local (Docker)
//   npm run prod:funcionario:criar   -> produção (Aiven), pede confirmação
// Sem terminal interativo (entrada redirecionada, uso em scripts), lê três
// linhas da entrada padrão — nome, login, senha — e, em produção, exige a
// flag --confirmar no lugar da confirmação digitada.

const producao = process.argv.includes('--prod');
const confirmadoPorFlag = process.argv.includes('--confirmar');
const interativo = Boolean(process.stdin.isTTY);

let destino: string;

try {
  if (producao) {
    const { host, banco } = carregarEnvAiven();
    destino = `PRODUÇÃO — ${host} (banco ${banco})`;
  } else {
    loadLocalEnv();
    destino = 'banco LOCAL (Docker)';
  }
} catch (error) {
  console.error(`✘ ${(error as Error).message}`);
  process.exit(1);
}

async function perguntar(): Promise<DadosNovoFuncionario | null> {
  const { default: input } = await import('@inquirer/input');
  const { default: password } = await import('@inquirer/password');

  const nome = await input({ message: 'Nome completo:' });
  const login = await input({ message: 'Login:' });
  const senha = await password({
    message: `Senha (mínimo ${SENHA_MINIMA} caracteres):`,
    mask: '*',
    validate: (valor) => valor.length >= SENHA_MINIMA || `Use pelo menos ${SENHA_MINIMA} caracteres.`,
  });
  const confirmacao = await password({ message: 'Repita a senha:', mask: '*' });

  if (senha !== confirmacao) {
    console.error('✘ As senhas não conferem. Nada foi criado.');
    return null;
  }

  if (producao) {
    const resposta = await input({ message: `Criar "${login.trim()}" em PRODUÇÃO? Digite sim para confirmar:` });

    if (resposta.trim().toLowerCase() !== 'sim') {
      console.info('Cancelado. Nada foi criado.');
      return null;
    }
  }

  return { nome, login, senha };
}

async function lerEntradaPadrao(): Promise<DadosNovoFuncionario | null> {
  if (producao && !confirmadoPorFlag) {
    console.error('✘ Sem terminal interativo, criar em produção exige a flag --confirmar. Nada foi criado.');
    return null;
  }

  console.error('Entrada não interativa: lendo nome, login e senha (uma linha cada) da entrada padrão.');
  let texto = '';

  for await (const parte of process.stdin) {
    texto += String(parte);
  }

  const [nome = '', login = '', senha = ''] = texto.split(/\r?\n/);

  return { nome, login, senha };
}

console.info(`Destino: ${destino}`);

let dados: DadosNovoFuncionario | null;

try {
  dados = interativo ? await perguntar() : await lerEntradaPadrao();
} catch (error) {
  // Ctrl+C durante uma pergunta do inquirer.
  if ((error as Error).name === 'ExitPromptError') {
    console.info('\nCancelado. Nada foi criado.');
    process.exit(1);
  }
  throw error;
}

if (!dados) {
  process.exit(1);
}

let pool: import('mysql2/promise').Pool | undefined;

try {
  ({ pool } = await import('../config/database.js'));
  const { provisionarFuncionario } = await import('../modules/auth/provisionar-funcionario.js');
  const resultado = await provisionarFuncionario(pool, dados);

  if (resultado.status === 'criado') {
    console.info(`✔ Funcionário criado: login=${resultado.login} id=${resultado.id}`);
    process.exitCode = 0;
  } else if (resultado.status === 'login_existente') {
    console.error(`✘ Já existe um funcionário com o login "${resultado.login}". Nada foi alterado.`);
    process.exitCode = 1;
  } else {
    console.error('✘ Dados inválidos, nada foi criado:');
    for (const erro of resultado.erros) {
      console.error(`  - ${erro}`);
    }
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`✘ Falha ao criar o funcionário: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
