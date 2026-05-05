import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../servicios/api';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  Usuario: string = '';
  token: string | null = '';
  nivelBrillo: number = 100;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    // Obtenemos los datos del servicio o del storage
    this.Usuario = this.api.usuarioActual || localStorage.getItem('usuario') || 'Invitado';
    this.token = localStorage.getItem('token');
    
    // Restaurar el nivel de brillo previo
    const savedBrightness = localStorage.getItem('app_brightness');
    if (savedBrightness) {
      this.nivelBrillo = parseInt(savedBrightness, 10);
      this.aplicarBrillo();
    }
  }

  ajustarBrillo() {
    this.aplicarBrillo();
    localStorage.setItem('app_brightness', this.nivelBrillo.toString());
  }

  private aplicarBrillo() {
    let overlay = document.getElementById('brightness-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'brightness-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.pointerEvents = 'none'; // Crucial para que no bloquee clics
      overlay.style.zIndex = '999999'; // Encima de todo
      overlay.style.transition = 'background-color 0.2s';
      document.body.appendChild(overlay);
    }
    const opacity = 1 - (this.nivelBrillo / 100);
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
  }

  cerrarSesion() {
    // Limpiamos todo
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    this.api.usuarioActual = ''; // Limpiamos el servicio también
    this.router.navigate(['/login']);
  }
}
