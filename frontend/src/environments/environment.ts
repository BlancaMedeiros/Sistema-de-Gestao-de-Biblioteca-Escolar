// Caminho relativo: em desenvolvimento o ng serve encaminha /api ao backend
// (proxy.conf.json); em produção o Firebase Hosting reescreve /api para o Cloud Run.
// Mesma origem nos dois casos, então o cookie de sessão é enviado sem CORS.
export const environment = {
  production: false,
  apiUrl: '/api/v1'
};
