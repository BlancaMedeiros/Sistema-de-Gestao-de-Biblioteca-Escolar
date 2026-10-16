import type { Pool, PoolConnection } from 'mysql2/promise';

export type Banco = Pool | PoolConnection;

export async function emTransacao<T>(
  pool: Pool,
  executar: (conexao: PoolConnection) => Promise<T>,
  isolamento: 'READ COMMITTED' | 'REPEATABLE READ' = 'READ COMMITTED',
): Promise<T> {
  const conexao = await pool.getConnection();
  try {
    // As escritas bloqueiam primeiro leitor/livro. READ COMMITTED evita
    // contar empréstimos a partir de um snapshot anterior à espera do lock.
    await conexao.query(`SET TRANSACTION ISOLATION LEVEL ${isolamento}`);
    await conexao.beginTransaction();
    const resultado = await executar(conexao);
    await conexao.commit();
    return resultado;
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}
