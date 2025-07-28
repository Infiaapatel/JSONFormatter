
import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from './Services/auth.service';
import { Router } from '@angular/router';

/**
 * Authentication interceptor for HTTP requests
 * Handles token management and error responses
 *
 * @param req The outgoing HTTP request
 * @param next The next handler in the interceptor chain
 * @returns An observable of the HTTP event
 */
export const AuthInterceptor = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  // Use router directly to avoid circular dependency
  const router = inject(Router);
  const TOKEN_KEY = 'jwt_token';
  const token = localStorage.getItem(TOKEN_KEY);

  // Skip authentication check for certain endpoints
  const isAuthEndpoint = req.url.includes('/User/Authenticate');
  const isLogoutEndpoint = req.url.includes('/User/Logout');

  // For token validation, use a direct check without injecting AuthService
  // This avoids circular dependency during initialization
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp < Date.now() / 1000;
    } catch {
      return true;
    }
  };

  // Check token expiration for non-auth endpoints
  if (token && !isAuthEndpoint && !isLogoutEndpoint && isTokenExpired(token)) {
    //console.log('Interceptor detected expired token');

    // Clear token directly
    localStorage.removeItem(TOKEN_KEY);

    // Navigate to login page directly without involving AuthService
    setTimeout(() => {
      router.navigate(['/jsonFormatter']);
    }, 0);

    return throwError(() => new HttpErrorResponse({
      error: 'Session expired',
      status: 401,
      statusText: 'Unauthorized'
    }));
  }

  // Clone request with authorization header for authenticated requests
  let authReq = req;
  if (token && !isAuthEndpoint) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  // Process the request and handle any errors
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized errors
      if (error.status === 401 && !isAuthEndpoint && !isLogoutEndpoint) {
        //console.log('Received 401 Unauthorized response');

        // Clear token directly
        localStorage.removeItem(TOKEN_KEY);

        // Redirect to login page directly
        setTimeout(() => {
          router.navigate(['/jsonFormatter']);
        }, 0);
      }
      return throwError(() => error);
    })
  );
};



//import {
//  HttpErrorResponse,
//  HttpEvent,
//  HttpHandlerFn,
//  HttpRequest,
//  HttpResponse,
//} from '@angular/common/http';
//import { inject } from '@angular/core';
//import { Observable, catchError, filter, map, throwError } from 'rxjs';
////import { CryptoService } from './Services/Crypto.service';
//import { AuthService } from './Services/auth.service';
///**
//* Intercept
//*
//* @param req
//* @param next
//*/

//export const AuthInterceptor = (
//  req: HttpRequest<unknown>,
//  next: HttpHandlerFn
//): Observable<HttpEvent<unknown>> => {
//  const authService = inject(AuthService);
//  const token = localStorage.getItem('jwt_token');

//  // Check token expiration
//  if (token && authService.isTokenExpired(token)) {
//    authService.handleTokenExpiration();
//    return throwError(() => 'Session expired');
//  }

//  // Attach token to requests
//  if (token) {
//    req = req.clone({
//      setHeaders: { Authorization: `Bearer ${token}` }
//    });
//  }

//  return next(req).pipe(
//    // First, filter to process only HttpResponse events
//    filter(event => event instanceof HttpResponse),

//    map((event: HttpResponse<any>) => {
//      if (event.body?.Data) {
//        return event.clone({
//          body: {
//            IsSuccess: event.body.IsSuccess,
//            StatusCode: event.body.StatusCode,
//            ErrorMessage: event.body.ErrorMessage,
//            Information: event.body.Information,
//            Data: event.body.Data
//          }
//        });
//      }
//      else {
//        let responseBody;
//        try {
//          responseBody = event.body;
//        } catch (error) {
//          responseBody = event.body;
//        }
//        return event.clone({
//          body: responseBody
//        });
//      }

//    }),

//    // Handle 401 Unauthorized errors

//    catchError((error: HttpErrorResponse) => {

//      if (error.status === 401) {

//      }

//      return throwError(error);

//    })

//  );

//};
