import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../Services/auth.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoadingService } from '../../Services/loading.service'
import { SharedStateService } from '../../Shared/shared-state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  imports: [RouterLink, RouterLinkActive, CommonModule, ReactiveFormsModule]
})

export class HeaderComponent {
  isLoggedIn = false;
  isDropdownOpen = false;
  isSidebarOpen = false;
  loginForm!: FormGroup;
  showPassword = false;
  loginError: string | null = null;
  showLogoutConfirm = false;
  isMobileMenuOpen = false;

  @ViewChild('userNameInput') userNameInput!: ElementRef;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router, public loadingService: LoadingService, private sharedService: SharedStateService) {
    this.loginForm = this.fb.group({
      userName: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.authService.isLoggedIn$.subscribe(status => {
      this.isLoggedIn = status;
    });
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  // Updated to show confirmation dialog instead of immediately logging out
  initiateLogout() {
    this.showLogoutConfirm = true;
    this.isDropdownOpen = false;
  }

  // Confirm logout action
  confirmLogout() {
    this.authService.logout();
    this.sharedService.triggerClearText();
    this.showLogoutConfirm = false;
  }

  // Cancel logout action
  cancelLogout() {
    this.showLogoutConfirm = false;
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
    if (this.isSidebarOpen) {
      this.loginForm.reset(); // Reset form fields
      this.loginError = null; // Clear previous errors
      setTimeout(() => {
        this.userNameInput.nativeElement.focus();
      }, 300);
    }
  }

  onSubmit() {
    this.loginError = null;
    if (this.loginForm.invalid) {
      this.loginError = 'Please fill in all required fields.';
      return;
    }

    const model = {
      UserName: this.loginForm.value.userName,
      Password: this.loginForm.value.password
    };

    this.authService.login(model).subscribe({
      next: (response) => {
        if (response.isSuccess) {
          this.toggleSidebar(); // Close sidebar on success
          this.router.navigate(['/jsonFormatter']);
        }
        else {
          const errorMessage = response.data?.message || 'An unknown authentication error occurred.';
          this.loginError = errorMessage;
          
        }
      },
      error: (httpError) => {
        console.error('Login HTTP error:', httpError);
        const errorMessage = 'A server or network error occurred. Please try again later.';
        this.loginError = errorMessage;
      }
    });

  }

  // Add getters for form controls
  get userName() { return this.loginForm.get('userName'); }
  get password() { return this.loginForm.get('password'); }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }
}