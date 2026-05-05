import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../servicios/api';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-seguridad-codigo',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './seguridad-codigo.html',
  styleUrl: './seguridad-codigo.css',
})
export class SeguridadCodigo {
codigo = '';
usuario = '';

  constructor(private router: Router, private api: ApiService) {
    // Obtener el usuario actual desde el servicio API
  this.usuario = this.api.usuarioActual || localStorage.getItem('usuario') || '';
// Si de plano no hay usuario, mandarlo al login
    if (!this.usuario) {
      this.router.navigate(['/login']);
    }  
}

  verificar() { 
    this.api.getTrafico('GUATEMALA', this.usuario, this.codigo).subscribe({
      next: (res: any) => {
        // Al verificar con éxito, guardamos el código también
      localStorage.setItem('codigo_2fa', this.codigo);
        this.api.codigo = this.codigo;
        this.api.datosTraficoActual = res;
        
        // Persistir el token (Asegúrate de que 'access_token' o 'token' sea el nombre que envía Python)
        if (res.token) {
           localStorage.setItem('token', res.token);
        }
        // Guardamos el usuario también por si acaso
        localStorage.setItem('usuario', this.usuario);

        Swal.fire('¡Verificado!', 'Entrando al sistema...', 'success');
        this.router.navigate(['/mapa']);
      },
      error: (err) => {
        Swal.fire('Error', 'Código incorrecto', 'error');
      }
    });
  }

  CerrarSesion() {
   localStorage.clear(); // Limpiar todo al salir
    this.router.navigate(['/login']);
  }
}
