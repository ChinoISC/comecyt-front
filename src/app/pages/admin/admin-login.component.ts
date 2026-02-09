import { Component } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css']
})
export class AdminLoginComponent {
  loading = false;
  errorMsg = '';
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  submit(): void {
    this.errorMsg = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    const email = this.form.value.email.trim().toLowerCase();
    const password = this.form.value.password;

    this.auth.loginAdmin(email, password).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire({
          icon: 'success',
          title: 'Acceso administrador',
          text: 'Bienvenido al panel de administración',
          timer: 1500,
          showConfirmButton: false
        }).then(() => this.router.navigateByUrl('/admin'));
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Credenciales inválidas o sin permisos de administrador.';
      }
    });
  }
}
