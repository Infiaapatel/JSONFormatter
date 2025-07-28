import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { configService } from './config.service';
import { Request } from '../Model/Request.model';
import { Response } from '../Model/Response.model';

@Injectable({ providedIn: 'root' })

export class EncDecService {

  constructor(private http: HttpClient, private config: configService) { }

  encrypt(requestData: Request): Observable<string> {
    const httpOptions = { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
    return this.http.post<Response>(`${this.config.apiBaseUrl}/EncryptDecryptController/encrypt`, requestData, httpOptions).pipe(map(
      response => {
        if (response.isSuccess && response.data?.encryptedText) {
          return response.data.encryptedText;
        }
        throw new Error('Encryption failed: Invalid response from server.');
      }
    ),
      catchError(err => {
        const errorMessage = 'Encryption error: ' + (err.error?.message || err.message || 'Unknown error');
        return of(errorMessage);
      })
    )
  }

  decrypt(requestData: Request): Observable<string> {
    const httpOptions = { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) };
    return this.http.post<Response>(`${this.config.apiBaseUrl}/EncryptDecryptController/decrypt`, requestData, httpOptions).pipe(map(
      response => {
        if (response.isSuccess && response.data?.decryptedText) {
          return response.data.decryptedText;
        }
        throw new Error('Decryption failed: Invalid response from server.');
      }
    ),
      catchError(err => {
        const errorMessage = 'Decryption error: ' + (err.error?.message || err.message || 'Unknown error');
        return of(errorMessage);
      }));
  }
}
