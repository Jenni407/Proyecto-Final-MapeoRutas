import { Routes } from '@angular/router';
import { Mapa } from './vistas/mapa/mapa';
import { Login } from './vistas/login/login';
import { SeguridadCodigo } from './vistas/seguridad-codigo/seguridad-codigo';
import { Path } from 'leaflet';

export const routes: Routes = [
    { path: 'Login',  component: Login }, // Pantalla de login
    { path: 'seguridad-codigo', component: SeguridadCodigo }, // Pantalla de verificación de código
    { path: 'mapa', component: Mapa }, // Pantalla del mapa
    { path: '**', redirectTo: '/Login', pathMatch: 'full' } // Redirigir rutas no definidas
];
