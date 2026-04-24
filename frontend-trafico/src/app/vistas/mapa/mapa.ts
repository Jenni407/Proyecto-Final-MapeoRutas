import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; 
import * as L from 'leaflet';
import { Router } from '@angular/router';
import { ApiService } from '../../servicios/api';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css'
})
export class Mapa implements AfterViewInit {
  mapa: any;
  capaSeleccionada: any;
  traficoActual: any = {};

  constructor(
    private http: HttpClient,
    private router: Router,
    private api: ApiService 
  ) {}

  ngAfterViewInit() {
    setTimeout(() => {
      const infoReal = this.api.datosTraficoActual;
      this.inicializarMapa(infoReal || { 
          departamento: 'GUATEMALA', 
          estado_del_vial: 'Inicie sesión', 
          vehiculos_detectados_ahora: 0 
      });
      if (this.mapa) {
        this.mapa.invalidateSize();
      }
    }, 350);
  }

  inicializarMapa(datos: any) {
    if (this.mapa) { this.mapa.remove(); }
    
    this.mapa = L.map('map').setView([14.634915, -90.506882], 7);  

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      opacity: 0.7 
    }).addTo(this.mapa);

    this.http.get('assets/map.geojson').subscribe({
      next: (geoData: any) => {
        L.geoJSON(geoData, {
          style: { color: '#003366', weight: 3, opacity: 0.8 },
          onEachFeature: (feature, layer) => {
            layer.on('click', (e) => {
              if (this.capaSeleccionada) {
                this.capaSeleccionada.setStyle({ color: '#003366', weight: 3 });
              }
              this.capaSeleccionada = (e as any).target;
              this.capaSeleccionada.setStyle({ color: '#f1c40f', weight: 7 }); 
              this.capaSeleccionada.bringToFront();

              const nombreRuta = feature.properties.name || "Ruta Nacional";
              const deptoOriginal = feature.properties.nombre_depto || "GUATEMALA";
              
              // Normalización de texto para la API
              const deptoLimpio = deptoOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
              
              const user = this.api.usuarioActual;
              const code = this.api.codigo;

              layer.bindPopup(`
                <div style="text-align:center; padding:10px;">
                  <h3 style="color:#003366;">${nombreRuta}</h3>
                  <div class="spinner"></div>
                </div>
              `).openPopup();

              // Llamada Conteo 
              this.api.getConteoPorDepto(deptoLimpio).subscribe({
                next: (resConteo: any) => {
                  // Llamada 2: Tráfico en tiempo real
                  this.api.getTrafico(deptoLimpio, user, code).subscribe({
                    next: (resTrafico: any) => {
                      const estadoVial = resTrafico.estado_del_vial || "NORMAL";
                      const nCarros = (resConteo.carros || 0).toLocaleString();
                      const nMotos = (resConteo.motos || 0).toLocaleString();
                      const nAhora = (resTrafico.vehiculos_detectados_ahora || 0).toLocaleString();
                      const hora = resTrafico.hora_de_consulta || "Consultando...";

                      // Lógica de colores según el estado

                    let colorEstado = '#28a745'; let iconoEstado = '✅';
                    if (estadoVial.toUpperCase().includes('PESADO') || estadoVial.toUpperCase().includes('PICO')) {
                     colorEstado = '#dc3545'; iconoEstado = '🔴';
                    } else if (estadoVial.toUpperCase().includes('MODERADO')) {
                      colorEstado = '#ffc107'; iconoEstado = '⚠️';
                    }
                      //Diseño de card
                      layer.setPopupContent(`
            <div style="min-width: 250px; font-family: 'Segoe UI', Arial, sans-serif; color: #333;">
              
              <h3 style="margin: 0 0 10px 0; color: #003366; font-size: 17px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                ${nombreRuta}
              </h3>

              <div style="margin-bottom: 12px; font-size: 14px; color: #555;">
                <b>Departamento:</b> ${deptoOriginal.toUpperCase()}
              </div>

              <div style="margin-bottom: 15px; font-size: 15px; font-weight: bold; color: ${colorEstado}; display: flex; align-items: center; gap: 8px;">
                <span>${iconoEstado}</span> ${estadoVial.toUpperCase()}
              </div>

              <div style="background-color: #f8f9fa; border-radius: 6px; padding: 12px; border: 1px solid #eaeaea;">
                
                <div style="display: flex; align-items: center; gap: 8px; color: #666; font-size: 13px; margin-bottom: 10px;">
                  📊 <span>Tráfico Detectado:</span>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding-left: 10px;">
                  <span>🚗 Carros:</span>
                  <b>${nCarros}</b>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-left: 10px;">
                  <span>🏍️ Motos:</span>
                  <b>${nMotos}</b>
                </div>

              </div>

              <div style="font-size: 11px; color: #888; margin-top: 10px; display: flex; align-items: center; gap: 6px;">
                🕒 <span>Hora consulta: ${hora}</span>
              </div>

            </div>   
                      `);
                    },
                    error: () => layer.setPopupContent("<b>Error:</b> Verifique sesión.")
                  });
                },
                error: () => layer.setPopupContent("<b>Error:</b> No se pudieron cargar datos.")
              });
            });
          }
        }).addTo(this.mapa);
      }
    });
  }

  cerrarSesion() {
    this.router.navigate(['/login']);
  }
}