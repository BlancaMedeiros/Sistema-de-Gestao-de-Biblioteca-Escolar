import { loadLocalEnv } from '../config/local-env.js';
import type { FuncionarioSeed } from './seed-funcionarios.js';

// Contas de desenvolvimento com senha conhecida, só para uso local/demo.
// Nunca aponte este script para um banco de produção (ver guarda abaixo).
const FUNCIONARIOS_SEED: FuncionarioSeed[] = [
  { nome: 'Bibliotecária de Testes', login: 'bibliotecaria.teste', senha: 'Teste@123' },
  { nome: 'Funcionária de Testes', login: 'funcionaria.teste', senha: 'Teste@123' },
];

// process.env precisa estar pronto antes de importar config/database.js
// (mesmo motivo do run-migrations-cli.ts), por isso os imports abaixo são
// dinâmicos e vêm depois de loadLocalEnv().
loadLocalEnv();

if (process.env.NODE_ENV === 'production') {
  console.error(
    '✘ Este script cria contas com senha conhecida e fixa no código — não deve rodar com NODE_ENV=production. ' +
      'Para provisionar uma conta em produção, crie um comando separado que leia a senha de uma variável de ambiente/segredo.',
  );
  process.exit(1);
}

const { pool } = await import('../config/database.js');
const { seedFuncionarios } = await import('./seed-funcionarios.js');

try {
  const resultados = await seedFuncionarios(pool, FUNCIONARIOS_SEED);

  for (const resultado of resultados) {
    if (resultado.status === 'criado') {
      console.info(`✔ criado: login=${resultado.login} id=${resultado.id}`);
    } else {
      console.info(`… já existia (nada foi alterado): login=${resultado.login} id=${resultado.id}`);
    }
  }

  console.info('');
  console.info('Credenciais de desenvolvimento (login / senha):');
  for (const seed of FUNCIONARIOS_SEED) {
    console.info(`  ${seed.login} / ${seed.senha}`);
  }

  process.exitCode = 0;
} catch (error) {
  console.error('✘ Falha ao rodar a seed de funcionários.', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
