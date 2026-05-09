import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../servicios/api';
import Swal from 'sweetalert2';
import { timer } from 'rxjs';

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
    this.usuario = this.api.usuarioActual || localStorage.getItem('usuario') || '';
    if (!this.usuario) {
      this.router.navigate(['/login']);
    }
  }

  verificar() {
    this.api.getTrafico('GUATEMALA', this.usuario, this.codigo).subscribe({
      next: (res: any) => {
        localStorage.setItem('codigo_2fa', this.codigo);
        localStorage.setItem('usuario', this.usuario);
   
        this.api.datosTraficoActual = res;
      
        // Configuración de la alerta con auto-cierre
      Swal.fire({
        title: '¡Verificado!',
        text: 'Entrando al sistema...',
        icon: 'success',
        timer: 2000, // Duración de 2 segundos
        timerProgressBar: true,
        showConfirmButton: false
      }).then(() => {
        // La navegación ocurre SOLO cuando la alerta se cierra
        this.router.navigate(['/mapa']);
      });
    },
    error: (err) => {
      Swal.fire({
        title: 'Error',
        text: 'Código incorrecto',
        icon: 'error',
        timer: 2000,
        showConfirmButton: false
      });
    }
  });
}
  CerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}