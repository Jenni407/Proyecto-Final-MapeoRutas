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
    this.usuario = this.api.usuarioActual;
  }

  verificar() { 
    this.api.getTrafico('GUATEMALA', this.usuario, this.codigo).subscribe({
      next: (res: any) => {
        this.api.codigo = this.codigo;
        this.api.datosTraficoActual = res;
        
        Swal.fire('¡Verificado!', 'Entrando al sistema...', 'success');
        this.router.navigate(['/mapa']);
      },
      error: (err) => {
        Swal.fire('Error', 'Código incorrecto', 'error');
      }
    });
  }

  CerrarSesion() {
    this.router.navigate(['/login']);
  }
}
