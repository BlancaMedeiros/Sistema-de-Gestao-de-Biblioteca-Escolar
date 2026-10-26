import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { LoginService } from '../services/login.service';

// Telas internas exigem sessão válida na API; sem ela, a navegação volta ao login.
export const autenticacaoGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(LoginService).VerificarSessao().pipe(
    map((valida) => valida || router.createUrlTree(['/login']))
  );
};
