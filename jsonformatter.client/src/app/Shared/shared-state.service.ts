// shared-state.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SharedStateService {
  private clearTextSubject = new Subject<void>();
  clearText$ = this.clearTextSubject.asObservable();

  triggerClearText() {
    this.clearTextSubject.next();
  }
}
