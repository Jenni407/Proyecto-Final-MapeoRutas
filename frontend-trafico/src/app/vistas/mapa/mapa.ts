import { Component, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; 
import * as L from 'leaflet';
import { Router } from '@angular/router';
import { ApiService } from '../../servicios/api';
import { Header } from '../header/header';
import {Footer} from '../footer/footer';
import 'leaflet-routing-machine';
import { ChangeDetectorRef } from '@angular/core';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, FormsModule, Header, Footer],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css'
})
export class Mapa implements AfterViewInit {
  mapa: any;
  capaSeleccionada: any;
  traficoActual: any = {};
  Usuario: string = '';
  currentTime: Date = new Date();
  private timer: any;
  private trafficUpdateTimer: any;
  // Define estas variables en tu clase
  origen: string = '';
  destino: string = '';
  rutaTrazada: boolean = false;
  private routingControl: any;
  infoRuta: any = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private api: ApiService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
  // Prioridad
  this.Usuario = this.api.usuarioActual || localStorage.getItem('usuario') || 'Usuario';
  }


  ngOnInit() {
    // Verificación de seguridad: si no hay usuario ni token, para afuera
  if (!localStorage.getItem('usuario')) {
    this.router.navigate(['/login']);
    return;
  }
    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
    // Refrescar datos cada 5 minutos
this.trafficUpdateTimer = setInterval(() => {
  this.actualizarColoresRutas();
}, 300000);
  }

  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }


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

    // Tema Claro Limpio (CartoDB Positron) para asemejarse al mockup
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      opacity: 1,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(this.mapa);

    // Añadir control de escala
    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(this.mapa);

   this.http.get('assets/map.geojson').subscribe({
  next: (geoData: any) => {
    L.geoJSON(geoData, {
      style: (feature: any) => {
        // Aquí podrías definir un estilo base
        return { color: '#3b82f6', weight: 3, opacity: 0.8 };
      },
      onEachFeature: (feature, layer) => {
        // 1. Obtener estado inicial para pintar la ruta al cargar
        const depto = feature.properties.nombre_depto.toUpperCase();
        
        this.api.getTrafico(depto, this.api.usuarioActual, this.api.codigo).subscribe({
          next: (res: any) => {
            const color = this.getColorPorEstado(res.estado_del_vial || '');
            (layer as L.Polyline).setStyle({ color: color });
          }
        });
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

  actualizarColoresRutas() {
    // Actualizar colores de rutas cada 5 minutos
    if (!this.mapa) return;
    
    const layers = this.mapa.eachLayer((layer: any) => {
      if (layer.feature && layer.feature.properties) {
        const depto = layer.feature.properties.nombre_depto.toUpperCase();
        this.api.getTrafico(depto, this.api.usuarioActual, this.api.codigo).subscribe({
          next: (res: any) => {
            const color = this.getColorPorEstado(res.estado_del_vial || '');
            if (layer.setStyle) {
              layer.setStyle({ color: color });
            }
          }
        });
      }
    });
  }

  getColorPorEstado(estado: string): string {
  const e = estado.toUpperCase();
  if (e.includes('PESADO') || e.includes('PICO') || e.includes('RED')) return '#dc3545'; // Rojo
  if (e.includes('MODERADO') || e.includes('ORANGE')) return '#ffc107'; // Naranja/Amarillo
  if (e.includes('FLUIDO') || e.includes('GREEN')) return '#28a745'; // Verde
  return '#3b82f6'; // Azul por defecto
}
// Función para buscar y trazar
buscarRuta() {
  if (!this.origen || !this.destino) {
    Swal.fire("Por favor ingresa origen y destino");
    return;
  }

  const urlOrigen = `https://nominatim.openstreetmap.org/search?format=json&q=${this.origen},Guatemala`;
  const urlDestino = `https://nominatim.openstreetmap.org/search?format=json&q=${this.destino},Guatemala`;

// El error es el .subscribe dentro de .subscribe. 
  // Vamos a forzar que Angular se quede "atento" hasta el final.
  this.http.get(urlOrigen).subscribe((res1: any) => {
    this.http.get(urlDestino).subscribe((res2: any) => {
      if (res1.length > 0 && res2.length > 0) {
        const p1 = L.latLng(res1[0].lat, res1[0].lon);
        const p2 = L.latLng(res2[0].lat, res2[0].lon);
        this.trazarRutaDinamica(p1, p2);
      }
    });
  });
}

trazarRutaDinamica(p1: L.LatLng, p2: L.LatLng) {
  if (this.routingControl) {
    this.mapa.removeControl(this.routingControl);
  }

  const routing = (L as any).Routing;
  this.routingControl = routing.control({
    waypoints: [p1, p2],
    show: false,
    addWaypoints: false,
    fitSelectedRoutes: true,
    lineOptions: {
      styles: [{ color: '#6366f1', weight: 6, opacity: 0.8 }]
    },
  }).addTo(this.mapa);

    // porque viene de Leaflet (fuera de Angular)
    this.routingControl.on('routesfound', (e: any) => {
      this.zone.run(() => {
        const summary = e.routes[0].summary;
        const horas = Math.floor(summary.totalTime / 3600);
        const minutos = Math.floor((summary.totalTime % 3600) / 60);
        const llegada = new Date(new Date().getTime() + summary.totalTime * 1000);

        // Asignamos los datos calculados
        this.infoRuta = {
          tiempo: horas > 0 ? `${horas}h ${minutos}m` : `${minutos} min`,
          distancia: (summary.totalDistance / 1000).toFixed(1),
          horaLlegada: llegada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // esto se activará al clic.
        this.rutaTrazada = true;
        this.cdr.detectChanges();
      });
    });
  }
  limpiarRuta() {
    if (this.routingControl) {
      this.mapa.removeControl(this.routingControl);
      this.rutaTrazada = false;
      this.origen = '';
      this.destino = '';

    }
  }
}
