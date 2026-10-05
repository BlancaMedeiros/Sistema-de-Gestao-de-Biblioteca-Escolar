function readRequired(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`A variável de ambiente ${name} é obrigatória.`);
  }

  return value;
}

function readPort(name: string, fallback: number): number {
  const rawValue = process.env[name] ?? String(fallback);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`A variável de ambiente ${name} deve ser uma porta válida.`);
  }

  return value;
}

function readOptional(name: string): string | undefined {
  const value = process.env[name];

  return value || undefined;
}

function readPositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name] || String(fallback);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`A variável de ambiente ${name} deve ser um inteiro positivo.`);
  }

  return value;
}

const databaseSocketPath = readOptional('DB_SOCKET_PATH');

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: readPort('PORT', 3000),
  sessionSecret: readRequired('SESSION_SECRET'),
  database: {
    host: databaseSocketPath ? undefined : readRequired('DB_HOST'),
    port: readPort('DB_PORT', 3306),
    socketPath: databaseSocketPath,
    name: readRequired('DB_NAME'),
    user: readRequired('DB_USER'),
    password: readRequired('DB_PASSWORD'),
    // Conteúdo PEM do certificado CA do servidor (não um caminho). Quando
    // presente, a conexão exige TLS e valida o certificado — caso do MySQL
    // gerenciado acessado pela internet. O Docker local não define.
    sslCa: readOptional('DB_SSL_CA'),
    connectionLimit: readPositiveInteger('DB_CONNECTION_LIMIT', 10),
  },
};

export type DatabaseEnv = typeof env.database;
