import { Component } from '@angular/core';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../servicios/api';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-recuperar-password',
  imports: [CommonModule, FormsModule, HttpClientModule],
  standalone:true,
  templateUrl: './recuperar-password.html',
  styleUrl: './recuperar-password.css',
})

export class RecuperarPassword {
paso: number = 1; // 1 = pedir correo, 2 = resetear
correo: string = '';
codigo: string = '';
nuevaPassword: string = '';

   constructor(private http: HttpClient, 
    private router: Router,
    private api: ApiService
  ) { }

enviarCodigo() {
  this.http.post('http://localhost:8000/api/solicitar-recuperacion', { Correo: this.correo })
    .subscribe({
      next: () => this.paso = 2,
      error: (e) => Swal.fire("Error: " + e.error.detail)
    });
}

cambiarPassword() {
  const datos = {
    Correo: this.correo,
    Codigo: this.codigo,
    NuevaPassword: this.nuevaPassword
  };
  this.http.post('http://localhost:8000/api/reset-password', datos)
    .subscribe({
      next: () => {
        Swal.fire("¡Éxito! Ya puedes iniciar sesión");
        this.router.navigate(['/login']);
      },
      error: (e) => Swal.fire("Error: " + e.error.detail)
    });
}

 abrirLogin() {
  console.log("Navegando a login...");
    this.router.navigate(['/login']);
    }
}