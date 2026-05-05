import {
  Component,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Router } from '@angular/router';
import { ApiService } from '../../servicios/api';
import { Header } from '../header/header';
import { Footer } from '../footer/footer';
import 'leaflet-routing-machine';
import Swal from 'sweetalert2';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface DatosVehicular {
  departamento: string;
  carros: number;
  motos: number;
  camiones: number;
  camionetas: number;
  pickups: number;
  total: number;
}

// ─── Componente ────────────────────────────────────────────────────────────

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, FormsModule, Header, Footer],
  templateUrl: './mapa.html',
  styleUrl: './mapa.css',
})
export class Mapa implements AfterViewInit, OnDestroy {
  // Mapa
  mapa: any;
  capaSeleccionada: any;
  private routingControl: any;

  // Estado UI
  Usuario: string = '';
  currentTime: Date = new Date();
  origen: string = '';
  destino: string = '';
  rutaTrazada: boolean = false;
  infoRuta: any = null;
  traficoActual: any = {};

  // Datos del gráfico
  datosVehicular: DatosVehicular | null = null;
  deptoSeleccionado: string = '';
  cargandoGrafico: boolean = false;

  // Refs privadas
  private grafico: Chart | null = null;
  private timer: any;
  private trafficUpdateTimer: any;

  constructor(
    private http: HttpClient,
    private router: Router,
    private api: ApiService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.Usuario =
      this.api.usuarioActual || localStorage.getItem('usuario') || 'Usuario';
  }

  // ─── Ciclo de vida ───────────────────────────────────────────────────────

  ngOnInit() {
    if (!localStorage.getItem('usuario')) {
      this.router.navigate(['/login']);
      return;
    }
    this.timer = setInterval(() => (this.currentTime = new Date()), 1000);
    this.trafficUpdateTimer = setInterval(
      () => this.actualizarColoresRutas(),
      300_000
    );
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.inicializarMapa();
      this.inicializarGrafico();
      if (this.mapa) this.mapa.invalidateSize();
    }, 350);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    clearInterval(this.trafficUpdateTimer);
    if (this.grafico) this.grafico.destroy();
  }

  // ─── Mapa ────────────────────────────────────────────────────────────────

  inicializarMapa() {
    if (this.mapa) this.mapa.remove();

    this.mapa = L.map('map', {
      zoomControl: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      dragging: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false
    }).setView([14.634915, -90.506882], 7);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        opacity: 1,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(this.mapa);

    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(this.mapa);

    this.http.get('assets/map.geojson').subscribe({
      next: (geoData: any) => {
        L.geoJSON(geoData, {
          style: () => ({ color: '#3b82f6', weight: 3, opacity: 0.8 }),
          onEachFeature: (feature, layer) => {
            const depto = (feature.properties.nombre_depto || '').toUpperCase();

            // Colorear al cargar
            this.api
              .getTrafico(depto, this.api.usuarioActual, this.api.codigo)
              .subscribe({
                next: (res: any) => {
                  (layer as L.Polyline).setStyle({
                    color: this.getColorPorEstado(res.estado_del_vial || ''),
                  });
                },
              });

            // Clic en ruta del mapa
            layer.on('click', (e) => {
              if (this.capaSeleccionada) {
                this.capaSeleccionada.setStyle({ color: '#003366', weight: 3 });
              }
              this.capaSeleccionada = (e as any).target;
              this.capaSeleccionada.setStyle({ color: '#f1c40f', weight: 7 });
              this.capaSeleccionada.bringToFront();

              const nombreRuta = feature.properties.name || 'Ruta Nacional';
              const deptoOriginal = feature.properties.nombre_depto || 'GUATEMALA';
              const deptoLimpio = this.normalizarDepto(deptoOriginal);

              // Popup con spinner
              layer
                .bindPopup(
                  `<div style="text-align:center;padding:10px;">
                    <h3 style="color:#003366;">${nombreRuta}</h3>
                    <p>⏳ Cargando datos...</p>
                  </div>`
                )
                .openPopup();

              // Actualizar gráfico con este departamento
              this.zone.run(() => {
                this.deptoSeleccionado = deptoOriginal.toUpperCase();
                this.actualizarGrafico(deptoLimpio);

                // Mostrar detalles de ruta en el sidebar
                this.rutaTrazada = true;
                const distKm = (Math.random() * 80 + 30).toFixed(1);
                const mins = Math.floor(Number(distKm) * 1.5);
                const horas = Math.floor(mins / 60);
                const minRest = mins % 60;
                const llegada = new Date(Date.now() + mins * 60000);
                this.infoRuta = {
                  tiempo: horas > 0 ? `${horas}h ${minRest}m` : `${minRest} min`,
                  distancia: distKm,
                  horaLlegada: llegada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
              });

              // Se removió la voz inicial aquí para evitar interrupciones

              // Datos para el popup
              this.api.getVehicularPorDepto(deptoLimpio).subscribe({
                next: (resConteo: any) => {
                  this.api
                    .getTrafico(deptoLimpio, this.api.usuarioActual, this.api.codigo)
                    .subscribe({
                      next: (resTrafico: any) => {
                        const estado = resTrafico.estado_del_vial || 'NORMAL';

                        // Voz con el estado real del tráfico estilo asistente Waze/Google Maps
                        const msgTrafico = `Ruta seleccionada hacia ${deptoOriginal}. El tráfico actual es ${estado.toLowerCase()}. Se detectan aproximadamente ${resTrafico.vehiculos_detectados_ahora || 0} vehículos en la zona.`;
                        this.hablar(msgTrafico);

                        let colorEstado = '#28a745';
                        let icono = '✅';
                        if (estado.toUpperCase().includes('PESADO') || estado.toUpperCase().includes('PICO')) {
                          colorEstado = '#dc3545'; icono = '🔴';
                        } else if (estado.toUpperCase().includes('MODERADO')) {
                          colorEstado = '#ffc107'; icono = '⚠️';
                        }

                        layer.setPopupContent(`
                          <div style="min-width:260px;font-family:'Segoe UI',Arial,sans-serif;color:#333;">
                            <h3 style="margin:0 0 10px;color:#003366;font-size:17px;border-bottom:1px solid #eee;padding-bottom:8px;">${nombreRuta}</h3>
                            <div style="margin-bottom:10px;font-size:14px;color:#555;"><b>Departamento:</b> ${deptoOriginal.toUpperCase()}</div>
                            <div style="margin-bottom:14px;font-size:15px;font-weight:bold;color:${colorEstado};display:flex;align-items:center;gap:8px;">
                              <span>${icono}</span> ${estado.toUpperCase()}
                            </div>
                            <div style="background:#f8f9fa;border-radius:6px;padding:12px;border:1px solid #eaeaea;">
                              <div style="color:#666;font-size:13px;margin-bottom:10px;">📊 Tráfico Registrado (Historial)</div>
                              <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-left:8px;"><span>🚗 Carro:</span><b>${(resConteo.carros || 0).toLocaleString()}</b></div>
                              <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-left:8px;"><span>🏍️ Moto:</span><b>${(resConteo.motos || 0).toLocaleString()}</b></div>
                              <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-left:8px;"><span>🚛 Camión:</span><b>${(resConteo.camiones || 0).toLocaleString()}</b></div>
                              <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-left:8px;"><span>🚐 Camioneta:</span><b>${(resConteo.camionetas || 0).toLocaleString()}</b></div>
                              <div style="display:flex;justify-content:space-between;padding-left:8px;"><span>🛻 Pickup:</span><b>${(resConteo.pickups || 0).toLocaleString()}</b></div>
                            </div>
                            <div style="font-size:11px;color:#888;margin-top:10px;">🕒 Hora: ${resTrafico.hora_de_consulta || '--:--'} &nbsp;|&nbsp; 🚦 Ahora: ${(resTrafico.vehiculos_detectados_ahora || 0).toLocaleString()} veh.</div>
                          </div>
                        `);
                      },
                      error: () => layer.setPopupContent('<b>Error:</b> Verifica tu sesión.'),
                    });
                },
                error: () => layer.setPopupContent('<b>Error:</b> No se pudieron cargar datos.'),
              });
            });
          },
        }).addTo(this.mapa);
      },
    });
  }

  // ─── Gráfico de barras ───────────────────────────────────────────────────

  inicializarGrafico() {
    const canvas = document.getElementById('trafficChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.grafico) this.grafico.destroy();

    this.grafico = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['🚗 Carro', '🏍️ Moto', '🚛 Camión', '🚐 Camioneta', '🛻 Pickup'],
        datasets: [
          {
            label: 'Vehículos',
            data: [0, 0, 0, 0, 0],
            backgroundColor: [
              'rgba(37,  99, 235, 0.85)',
              'rgba(249,115,  22, 0.85)',
              'rgba(239, 68,  68, 0.85)',
              'rgba( 34,197,  94, 0.85)',
              'rgba(168, 85, 247, 0.85)',
            ],
            borderRadius: 8,
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Selecciona una ruta para ver el tráfico por tipo de vehículo',
            color: '#94a3b8',
            font: { size: 13, weight: 'normal' },
            padding: { bottom: 10 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${(ctx.parsed.y || 0).toLocaleString()} vehículos`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#94a3b8', callback: (v) => Number(v).toLocaleString() },
            grid: { color: 'rgba(148,163,184,0.12)' },
          },
          x: {
            ticks: { color: '#cbd5e1', font: { size: 12 } },
            grid: { display: false },
          },
        },
      },
    });

    // Cargar Guatemala por defecto
    this.actualizarGrafico('GUATEMALA');
  }

  actualizarGrafico(departamento: string) {
    if (!this.grafico) return;
    this.cargandoGrafico = true;

    this.api.getVehicularPorDepto(departamento).subscribe({
      next: (res: any) => {
        this.zone.run(() => {
          this.datosVehicular = res;
          this.deptoSeleccionado = res.departamento || departamento;
          this.cargandoGrafico = false;

          if (this.grafico) {
            this.grafico.data.datasets[0].data = [
              res.carros,
              res.motos,
              res.camiones,
              res.camionetas,
              res.pickups,
            ];
            (this.grafico.options.plugins!.title as any).text =
              `Tráfico Vehicular — ${res.departamento || departamento}`;
            this.grafico.update('active');
          }
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.cargandoGrafico = false;
      },
    });
  }

  // ─── Búsqueda de ruta ────────────────────────────────────────────────────

  hablar(mensaje: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(mensaje);

      const voices = window.speechSynthesis.getVoices();
      // Buscar voces femeninas tipo asistente (Google, Sabina, Paulina, Monica, Elena)
      const voice = voices.find(v =>
        v.lang.startsWith('es') &&
        (v.name.includes('Google') || v.name.includes('Sabina') || v.name.includes('Paulina') || v.name.includes('Monica') || v.name.includes('Elena'))
      ) || voices.find(v => v.lang.startsWith('es'));

      if (voice) {
        utterance.voice = voice;
      }

      utterance.lang = 'es-MX';
      utterance.rate = 1.0; // Velocidad estilo Siri/Waze
      utterance.pitch = 1.1; // Tono ligeramente agudo

      window.speechSynthesis.speak(utterance);
    }
  }

  buscarRuta() {
    if (!this.origen || !this.destino) {
      Swal.fire('Por favor ingresa origen y destino');
      return;
    }

    const urlO = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.origen)},Guatemala`;
    const urlD = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.destino)},Guatemala`;

    this.http.get<any[]>(urlO).subscribe((res1) => {
      this.http.get<any[]>(urlD).subscribe((res2) => {
        if (res1.length > 0 && res2.length > 0) {
          const p1 = L.latLng(+res1[0].lat, +res1[0].lon);
          const p2 = L.latLng(+res2[0].lat, +res2[0].lon);
          this.trazarRutaDinamica(p1, p2);

          // Actualizar gráfico con el departamento de origen buscado
          const deptoOrigen = this.normalizarDepto(this.origen);
          this.deptoSeleccionado = this.origen.toUpperCase();
          this.actualizarGrafico(deptoOrigen);
        } else {
          Swal.fire('No se encontraron las ubicaciones indicadas.');
        }
      });
    });
  }

  trazarRutaDinamica(p1: L.LatLng, p2: L.LatLng) {
    if (this.routingControl) this.mapa.removeControl(this.routingControl);

    const routing = (L as any).Routing;
    this.routingControl = routing
      .control({
        waypoints: [p1, p2],
        show: false,
        addWaypoints: false,
        fitSelectedRoutes: false,
        lineOptions: {
          styles: [{ color: '#6366f1', weight: 6, opacity: 0.8 }],
        },
      })
      .addTo(this.mapa);

    this.routingControl.on('routesfound', (e: any) => {
      this.zone.run(() => {
        const summary = e.routes[0].summary;
        const horas = Math.floor(summary.totalTime / 3600);
        const minutos = Math.floor((summary.totalTime % 3600) / 60);
        const llegada = new Date(Date.now() + summary.totalTime * 1000);

        this.infoRuta = {
          tiempo: horas > 0 ? `${horas}h ${minutos}m` : `${minutos} min`,
          distancia: (summary.totalDistance / 1000).toFixed(1),
          horaLlegada: llegada.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        this.rutaTrazada = true;

        // Voz para la ruta buscada estilo asistente Waze/Google Maps
        const msgVoz = `Trazando la mejor ruta hacia ${this.destino}. El tiempo estimado de viaje es de ${this.infoRuta.tiempo}, recorriendo ${this.infoRuta.distancia} kilómetros. Prepárate para iniciar tu viaje.`;
        this.hablar(msgVoz);

        this.cdr.detectChanges();
      });
    });
  }

  limpiarRuta() {
    if (this.routingControl) this.mapa.removeControl(this.routingControl);
    this.rutaTrazada = false;
    this.origen = '';
    this.destino = '';
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  normalizarDepto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  getColorPorEstado(estado: string): string {
    const e = estado.toUpperCase();
    if (e.includes('PESADO') || e.includes('PICO')) return '#dc3545';
    if (e.includes('MODERADO')) return '#ffc107';
    if (e.includes('FLUIDO') || e.includes('ALTA')) return '#28a745';
    return '#3b82f6';
  }

  actualizarColoresRutas() {
    if (!this.mapa) return;
    this.mapa.eachLayer((layer: any) => {
      if (layer.feature?.properties?.nombre_depto) {
        const depto = layer.feature.properties.nombre_depto.toUpperCase();
        this.api
          .getTrafico(depto, this.api.usuarioActual, this.api.codigo)
          .subscribe({
            next: (res: any) => {
              if (layer.setStyle) {
                layer.setStyle({
                  color: this.getColorPorEstado(res.estado_del_vial || ''),
                });
              }
            },
          });
      }
    });
  }

  cerrarSesion() {
    this.router.navigate(['/login']);
  }
}
