import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, finalize, delay } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Response } from '../Model/Response.model';
import { configService } from './config.service';
import { LoadingService } from './loading.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

  private readonly TOKEN_KEY = 'jwt_token';
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  private logoutTimer: any;
  private isLoggingOut = false;

  isLoggedIn$ = this.isLoggedInSubject.asObservable();

  constructor( private http: HttpClient, private router: Router, private configService: configService, private loder: LoadingService ) {
    this.initializeAuthState();
  }

  login(data: any): Observable<Response> {
    this.loder.show();
    const httpOptions = { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
    return this.http.post<Response>(`${this.configService.apiBaseUrl}/User/Authenticate`, data, httpOptions).pipe(
      delay(1200),
      tap(response => {
        if (response.isSuccess) {
          this.processSuccessfulLogin(response.data.token);
        }
      }),
      finalize(() => this.loder.hide())
    );
  }

  logout(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    // Clear local data first, then call the API
    this.clearLocalAuthState();
    this.http.post<Response>(`${this.configService.apiBaseUrl}/User/Logout`, {}).pipe(
      finalize(() => {
        this.router.navigate(['/']); 
        this.isLoggingOut = false;
      })
    ).subscribe({
      next: (response) => {
        if(response.isSuccess){
          let res = response.data.message         
        }
      },        
      error: err => console.error("Server logout failed, but user is logged out locally.", err)
    });
  }

  // --- Private Helper & Initialization Methods ---

  private initializeAuthState(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (token && !this.isTokenExpired(token)) {
      this.processSuccessfulLogin(token);
    } else {
      this.clearLocalAuthState();
    }
  }

  private processSuccessfulLogin(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.isLoggedInSubject.next(true);
    this.startTokenExpirationTimer();
  }

  private startTokenExpirationTimer(): void {
    this.clearTimer();
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const timeRemaining = (payload.exp * 1000) - Date.now();

      if (timeRemaining > 0) {
        this.logoutTimer = setTimeout(() => this.logout(), timeRemaining);
      } else {
        this.logout(); // If somehow the token is already expired
      }
    } catch {
      this.logout(); // If token is malformed
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp < Date.now() / 1000;
    } catch {
      return true; // Malformed token is considered expired
    }
  }

  private clearLocalAuthState(): void {
    this.clearTimer();
    localStorage.removeItem(this.TOKEN_KEY);
    this.isLoggedInSubject.next(false);
  }

  private clearTimer(): void {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
  }

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  private show() {
    this.isLoadingSubject.next(true);
  }

  private hide() {
    this.isLoadingSubject.next(false);
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}