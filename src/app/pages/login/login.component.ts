import { Component } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import Swal from 'sweetalert2'; 

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'] // ✅ ESTA es la buena
})

export class LoginComponent {
  loading = false;
  errorMsg = '';
  form!: FormGroup;


constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
  this.form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    remember: [false]
  });
}

submit() {
  this.errorMsg = '';
  if (this.form.invalid) {
    Swal.fire({
      icon: 'warning',
      title: 'Formulario incompleto',
      text: 'Por favor, complete todos los campos',
      confirmButtonColor: '#800020'
    });
    this.form.markAllAsTouched();
    return;
  }

  this.loading = true;
  const email = this.form.value.email.trim().toLowerCase();
  const password = this.form.value.password;

  Swal.fire({
    title: 'Iniciando sesión...',
    text: 'Por favor espere',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  this.auth.login(email, password).subscribe({
    next: () => {
      // token ya quedó en localStorage (tap del AuthService)
      this.auth.me().subscribe({
        next: () => {
          this.loading = false;
          Swal.fire({
            icon: 'success',
            title: '¡Bienvenida o bienvenido!',
            text: 'Sesión iniciada correctamente',
            timer: 1500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          }).then(() => {
            this.router.navigateByUrl('/landing');
          });
        },
        error: () => {
          this.loading = false;
          this.router.navigateByUrl('/landing'); // aún si falla, entra
        }
      });
    },
    error: (err) => {
      this.loading = false;
      const errorMessage = err?.error?.message || 'Credenciales inválidas. Por favor, verifique su email y contraseña.';
      Swal.fire({
        icon: 'error',
        title: 'Error al iniciar sesión',
        text: errorMessage,
        confirmButtonColor: '#800020'
      });
    }
  });
}


}
