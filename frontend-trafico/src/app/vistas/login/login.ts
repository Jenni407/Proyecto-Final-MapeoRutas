
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from '../../servicios/api';
import Swal from 'sweetalert2';
 
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  //datos para el login
  usuario = '';
  clave = '';
  codigo = '';
  email = '';
  //animacion para mostrar el formulario de registro
  isRegisterActive = false;
  
  constructor(private http: HttpClient,
    private router: Router,
    private api: ApiService
  ) { }
  // Cambia entre el panel de Login y Registro
  toggleRegister(active: boolean) {
    this.isRegisterActive = active;
  }

  // Función para iniciar sesión
  enviarLogin() {
  this.api.login(this.usuario, this.clave).subscribe({
    next: (res: any) => {
      localStorage.setItem('usuario', res.usuario);
      localStorage.setItem('token', res.token); 
      this.api.codigo = ''; // Limpiar cualquier código previo

      Swal.fire({
        title: '¡Ingreso Exitoso!',
        text: 'Se ha enviado un código a tu correo.',
        icon: 'success',
        timer: 2500, 
        timerProgressBar: true, 
        showConfirmButton: false, 
      }).then(() => {
          this.router.navigate(['/seguridad-codigo']);
        }
      );
    },
    error: (err) => {
      Swal.fire('Error', 'Credenciales incorrectas', 'error');
    }
  });
  }

  // Función para registrar un nuevo usuario
  registrar() {
    if (!this.usuario || !this.clave || !this.email) {
      Swal.fire('Error', 'Por favor completa todos los campos', 'error');
      return;
    }
    this.api.register(this.usuario, this.clave, this.email).subscribe({
      next: (res: any) => {
        Swal.fire('Éxito', '¡Registro exitoso! Ya puedes iniciar sesión.', 'success'      ).then(() => {
          this.toggleRegister(false); // Volver al panel de login después de registrar
          this.usuario = '';
          this.clave = '';
          this.email = '';
        });
      },
      error: (err) => {
        console.error(err);
        // Muestra el error si está disponible, de lo contrario muestra un mensaje genérico 
        Swal.fire('Error', err.error?.message || 'Ocurrió un error durante el registro', 'error');
      }
    });
  }

  abrirRecuperar() {
  console.log("Navegando a recuperación...");
    // Esto te redirigirá a la ruta que configuraste en app.routes.ts
    this.router.navigate(['/recuperar-password']);
    }
}