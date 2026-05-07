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
    this.usuario = this.api.usuarioActual || localStorage.getItem('usuario') || '';
    if (!this.usuario) {
      this.router.navigate(['/login']);
    }
  }

  verificar() {
    this.api.getTrafico('GUATEMALA', this.usuario, this.codigo).subscribe({
      next: (res: any) => {
        localStorage.setItem('codigo_2fa', this.codigo);
        this.api.codigo = this.codigo;
        this.api.datosTraficoActual = res;
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
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}