
import { Component, signal} from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms'; 
import { HttpClient } from '@angular/common/http';
import {  Router } from '@angular/router';  
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
  ) {}
// Cambia entre el panel de Login y Registro
  toggleRegister(active: boolean) {
    this.isRegisterActive = active;
  }

 enviarLogin() {
  this.api.login(this.usuario, this.clave).subscribe({
    next: (res: any) => {
      // Guardamos el usuario actual
      this.api.usuarioActual = this.usuario;
      // mensaje de éxito con SweetAlert2
      Swal.fire({
        title: '¡Ingreso Exitoso!',
        text: 'Se ha enviado un código a tú correo. Por favor, ingrésalo para continuar.',
        icon: 'success',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
      }).then((result) => {
     // Si el usuario confirma el mensaje, avanzamos al siguiente paso
        if (result.isConfirmed) {
    // VIAJAMOS AL NUEVO COMPONENTE
          this.router.navigate(['/seguridad-codigo']);
        }
      });
    },
    error: (err) => {
      Swal.fire('Error', 'Credenciales incorrectas', 'error');
    }
  });
}


// Función para registrar un nuevo usuario
registrar(){
if (!this.usuario || !this.clave || !this.email) {
  alert("Por favor, completa todos los campos.");
  return;
}
this.api.register(this.usuario, this.clave, this.email).subscribe({
    next: (res: any) => {
      alert("¡Registro exitoso! Ya puedes iniciar sesión.");
      this.toggleRegister(false); // Volver al panel de login después de registrar
      this.usuario = '';
      this.clave = '';
      this.email = '';
    },
    error: (err) => {
      console.error(err);
      // Muestra el error si está disponible, de lo contrario muestra un mensaje genérico 
      alert("Error: " + (err.error?.detail || "No se pudo registrar el usuario"));
    }
  });
}

abrirRecuperar() {
    console.log("Abriendo flujo de recuperación...");
    alert("Funcionalidad de recuperación de contraseña aún no implementada.");
  }
}