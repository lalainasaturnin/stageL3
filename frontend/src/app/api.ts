import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn, Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  user = signal<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  get token() { return localStorage.getItem('token'); }
  get isAdmin() { return this.user()?.role === 'admin'; }
  get home() { return this.isAdmin ? '/dashboard' : '/controle'; }

  login(email: string, password: string) {
    return this.http.post<any>('/api/auth/login', { email, password }).pipe(tap(r => {
      localStorage.setItem('token', r.token);
      localStorage.setItem('user', JSON.stringify(r.user));
      this.user.set(r.user);
    }));
  }
  logout() { localStorage.clear(); this.user.set(null); }
  list(res: string) { return this.http.get<any[]>(`/api/${res}`); }
  get(url: string) { return this.http.get<any>(`/api/${url}`); }
  post(url: string, body: any = {}) { return this.http.post<any>(`/api/${url}`, body); }
  put(url: string, body: any) { return this.http.put<any>(`/api/${url}`, body); }
  remove(url: string) { return this.http.delete(`/api/${url}`); }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(Api), router = inject(Router);
  const t = api.token;
  const r = t ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req;
  return next(r).pipe(catchError(e => {
    if (e.status === 401 && !req.url.includes('/auth/login')) { api.logout(); router.navigate(['/login']); }
    return throwError(() => e);
  }));
};
export const authGuard: CanActivateFn = () =>
  inject(Api).token ? true : inject(Router).parseUrl('/login');
export const adminGuard: CanActivateFn = () =>
  inject(Api).isAdmin ? true : inject(Router).parseUrl('/controle');
export const msg = (e: any) => e?.error?.message || 'Impossible de joindre le serveur.';
