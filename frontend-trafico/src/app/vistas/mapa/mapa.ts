import { Component, AfterViewInit, NgZone, ViewChild, ElementRef } from '@angular/core';
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
  Usuario: string = '';
  currentTime: Date = new Date();
  private timer: any;
  private trafficUpdateTimer: any;
  origen: string = '';
  destino: string = '';
  rutaTrazada: boolean = false;
  private routingControl: any;
  infoRuta: any = null;

  selectedChart: string = 'bar';
  private roadLayers: any[] = [];
  private deptoLayerMap: Map<string, any[]> = new Map();

  deptoTrafficState: Map<string, any> = new Map();
  topCongestion: any[] = [];
  stats = { total: 0, alto: 0, medio: 0, bajo: 0, criticos: 0 };

  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private http: HttpClient,
    private router: Router,
    private api: ApiService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.Usuario = this.api.usuarioActual || localStorage.getItem('usuario') || 'Usuario';
  }

  ngOnInit() {
    if (!localStorage.getItem('usuario')) {
      this.router.navigate(['/login']);
      return;
    }
    this.timer = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
    this.trafficUpdateTimer = setInterval(() => this.actualizarEstadoTrafico(), 30000);
    setTimeout(() => this.actualizarEstadoTrafico(), 2000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.trafficUpdateTimer) clearInterval(this.trafficUpdateTimer);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.inicializarMapa();
      if (this.mapa) this.mapa.invalidateSize();
    }, 350);
  }

  actualizarEstadoTrafico() {
    const hora = new Date().getHours();
    const departamentos = [
      "GUATEMALA", "SACATEPEQUEZ", "ESCUINTLA", "BAJA VERAPAZ", "ALTA VERAPAZ",
      "CHIMALTENANGO", "CHIQUIMULA", "EL PROGRESO", "HUEHUETENANGO", "IZABAL",
      "JALAPA", "JUTIAPA", "PETEN", "QUETZALTENANGO", "QUICHE", "RETALHULEU",
      "SAN MARCOS", "SANTA ROSA", "SOLOLA", "SUCHITEPEQUEZ", "TOTONICAPAN", "ZACAPA",
      "MAZATENANGO"
    ];
    this.deptoTrafficState.clear();
    departamentos.forEach(d => {
      const rand = Math.random();
      let estado: string, nivel: string, vehiculos: number;
      if ((hora >= 7 && hora <= 9) || (hora >= 17 && hora <= 19)) {
        if (rand < 0.25) { estado = "FLUIDO - Tráfico Normal"; nivel = "bajo"; vehiculos = 15000 + Math.floor(Math.random() * 20000); }
        else if (rand < 0.50) { estado = "TRÁFICO MODERADO"; nivel = "medio"; vehiculos = 50000 + Math.floor(Math.random() * 40000); }
        else { estado = "HORA PICO - Tráfico Pesado"; nivel = "alto"; vehiculos = 100000 + Math.floor(Math.random() * 100000); }
      } else if (hora >= 22 || hora <= 5) {
        if (rand < 0.75) { estado = "FLUIDO - Madrugada"; nivel = "bajo"; vehiculos = 3000 + Math.floor(Math.random() * 10000); }
        else if (rand < 0.92) { estado = "TRÁFICO MODERADO"; nivel = "medio"; vehiculos = 15000 + Math.floor(Math.random() * 15000); }
        else { estado = "TRÁFICO PESADO"; nivel = "alto"; vehiculos = 40000 + Math.floor(Math.random() * 30000); }
      } else {
        if (rand < 0.40) { estado = "FLUIDO - Tráfico Normal"; nivel = "bajo"; vehiculos = 20000 + Math.floor(Math.random() * 20000); }
        else if (rand < 0.72) { estado = "TRÁFICO MODERADO"; nivel = "medio"; vehiculos = 50000 + Math.floor(Math.random() * 40000); }
        else { estado = "TRÁFICO PESADO"; nivel = "alto"; vehiculos = 90000 + Math.floor(Math.random() * 70000); }
      }
      const carros = Math.floor(vehiculos * (0.55 + Math.random() * 0.2));
      const motos = Math.floor(vehiculos * (0.15 + Math.random() * 0.15));
      const color = this.getColorPorEstado(estado);
      this.deptoTrafficState.set(d, { estado, nivel, vehiculos_ahora: vehiculos, carros, motos, color });
    });
    this.syncAllRoadColors();
    this.computeDashboardStats();
  }

  private syncAllRoadColors() {
    if (!this.mapa || this.roadLayers.length === 0) return;
    this.roadLayers.forEach((layer: any) => {
      if (!layer.feature || !layer.feature.properties) return;
      if (layer === this.capaSeleccionada) return;
      const depto = (layer.feature.properties.nombre_depto || '').toUpperCase();
      const state = this.deptoTrafficState.get(depto);
      const color = state ? state.color : '#10b981';
      if (layer.setStyle) layer.setStyle({ color });
    });
  }

  private computeDashboardStats() {
    const entries: any[] = [];
    let total = 0, alto = 0, medio = 0, bajo = 0, criticos = 0;
    this.deptoTrafficState.forEach((data, depto) => {
      entries.push({ nombre: depto, ...data });
      total += data.vehiculos_ahora || 0;
      if (data.nivel === 'critico') criticos++;
      else if (data.nivel === 'alto') alto++;
      else if (data.nivel === 'medio') medio++;
      else bajo++;
    });
    entries.sort((a, b) => (b.vehiculos_ahora || 0) - (a.vehiculos_ahora || 0));
    this.topCongestion = entries.slice(0, 10);
    this.stats = { total, alto, medio, bajo, criticos };
    this.cdr.detectChanges();
    setTimeout(() => this.renderChart(), 100);
  }

  inicializarMapa() {
    if (this.mapa) { this.mapa.remove(); }
    this.roadLayers = [];
    this.deptoLayerMap.clear();
    this.mapa = L.map('map').setView([14.634915, -90.506882], 7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      opacity: 1,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(this.mapa);

    L.control.scale({ metric: true, imperial: false, position: 'bottomright' }).addTo(this.mapa);

    this.http.get('assets/map.geojson').subscribe({
      next: (geoData: any) => {
        L.geoJSON(geoData, {
          style: (feature: any) => {
            const depto = (feature.properties.nombre_depto || '').toUpperCase();
            const state = this.deptoTrafficState.get(depto);
            const color = state ? state.color : '#10b981';  
            return { color, weight: 3, opacity: 0.85 };
          },
          onEachFeature: (feature, layer) => {
            this.roadLayers.push(layer);
            const deptoKey = (feature.properties.nombre_depto || 'GUATEMALA').toUpperCase();
            if (!this.deptoLayerMap.has(deptoKey)) this.deptoLayerMap.set(deptoKey, []);
            this.deptoLayerMap.get(deptoKey)!.push(layer);

            const nombreRuta = feature.properties.name || "Ruta Nacional";
            const deptoOriginal = feature.properties.nombre_depto || "GUATEMALA";

            layer.on('click', () => {
              if (this.capaSeleccionada && this.capaSeleccionada !== layer) {
                const oldDepto = (this.capaSeleccionada.feature?.properties?.nombre_depto || '').toUpperCase();
                const oldState = this.deptoTrafficState.get(oldDepto);
                this.capaSeleccionada.setStyle({ color: oldState ? oldState.color : '#3b82f6', weight: 3 });
              }
              this.capaSeleccionada = layer;
              this.capaSeleccionada.setStyle({ color: '#f1c40f', weight: 7 });
              this.capaSeleccionada.bringToFront();

              const trafficInfo = this.deptoTrafficState.get(deptoKey) || { estado: 'FLUIDO - Tráfico Normal', vehiculos_ahora: 0, carros: 0, motos: 0, color: '#10b981' };
              const estadoVial = trafficInfo.estado || "NORMAL";
              const nAhora = (trafficInfo.vehiculos_ahora || 0).toLocaleString();
              const nCarros = (trafficInfo.carros || 0).toLocaleString();
              const nMotos = (trafficInfo.motos || 0).toLocaleString();

           // Aseguramos que el texto sea comparable
const estado = (estadoVial || '').toUpperCase().trim();

let colorEstado = '#10b981'; 
let iconoEstado = '✅';
let bgGrad = 'linear-gradient(135deg, #ecfdf5, #d1fae5)';
let badgeText = 'NORMAL';

if (estado.includes('PESADO') || estado.includes('PICO') || estado.includes('CONGESTI') || estado.includes('ALTA')) {
    colorEstado = '#dc3545'; 
    iconoEstado = '🔴';
    bgGrad = 'linear-gradient(135deg, #fef2f2, #fecaca)';
    badgeText = 'CONGESTIONADO';
} else if (estado.includes('MODERADO') || estado.includes('MEDIO')) {
    colorEstado = '#f59e0b'; 
    iconoEstado = '⚠️';
    bgGrad = 'linear-gradient(135deg, #fffbeb, #fde68a)';
    badgeText = 'MODERADO';
} else if (estado.includes('NORMAL') || estado.includes('LIBRE') || estado.includes('BAJO')) {
    // Forzamos los valores de Fluido explícitamente por si acaso
    colorEstado = '#10b981';
    iconoEstado = '✅';
    bgGrad = 'linear-gradient(135deg, #ecfdf5, #d1fae5)';
    badgeText = 'NORMAL';
}

              const prioridad = trafficInfo.nivel === 'critico' || trafficInfo.nivel === 'alto' ? 'Alta' :
                                trafficInfo.nivel === 'medio' ? 'Media' : 'Normal';

              layer.bindPopup(`
                <div style="min-width: 280px; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #1e293b;">
                  <div style="background: ${bgGrad}; margin: -12px -12px 12px; padding: 16px; border-radius: 10px 10px 0 0;">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                      <h3 style="margin:0; font-size:15px; font-weight:700; color:#1e293b; flex:1;">🛣️ ${nombreRuta}</h3>
                      <span style="background:${colorEstado}; color:white; padding:2px 10px; border-radius:20px; font-size:10px; font-weight:700; white-space:nowrap;">${badgeText}</span>
                    </div>
                    <div style="font-size:12px; color:#64748b; margin-top:6px;">📍 ${deptoOriginal.toUpperCase()}</div>
                  </div>
                  <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                    <span style="font-size:32px;">${iconoEstado}</span>
                    <div>
                      <div style="font-weight:700; font-size:14px; color:${colorEstado};">${estadoVial.toUpperCase()}</div>
                      <div style="font-size:11px; color:#64748b;">Prioridad: ${prioridad}</div>
                    </div>
                  </div>
                  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:8px;">
                    <div style="text-align:center; padding:10px 4px; background:#f8fafc; border-radius:8px;">
                      <div style="font-size:16px; font-weight:700; color:#1e293b;">${nAhora}</div>
                      <div style="font-size:9px; color:#64748b;">🚗 Vehículos</div>
                    </div>
                    <div style="text-align:center; padding:10px 4px; background:#f8fafc; border-radius:8px;">
                      <div style="font-size:16px; font-weight:700; color:#1e293b;">${nCarros}</div>
                      <div style="font-size:9px; color:#64748b;">🚙 Carros</div>
                    </div>
                    <div style="text-align:center; padding:10px 4px; background:#f8fafc; border-radius:8px;">
                      <div style="font-size:16px; font-weight:700; color:#1e293b;">${nMotos}</div>
                      <div style="font-size:9px; color:#64748b;">🏍️ Motos</div>
                    </div>
                  </div>
                  <div style="font-size:10px; color:#94a3b8; text-align:right; border-top:1px solid #f1f5f9; padding-top:8px;">
                    🕒 ${new Date().toLocaleTimeString()}
                  </div>
                </div>
              `).openPopup();
              this.speakText(`${nombreRuta} en ${deptoOriginal}. Estado: ${badgeText}. ${nAhora} vehículos, ${nCarros} carros, ${nMotos} motos.`);
            });
          }
        }).addTo(this.mapa);
      }
    });
  }

  private speakText(texto: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-GT';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    const hablar = () => {
      const voces = window.speechSynthesis.getVoices();
      const vozESP = voces.find(v => v.lang.startsWith('es'));
      if (vozESP) utterance.voice = vozESP;
      window.speechSynthesis.speak(utterance);
    };
    const voces = window.speechSynthesis.getVoices();
    if (voces.length > 0) {
      hablar();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        hablar();
      };
    }
  }

  cerrarSesion() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
    localStorage.removeItem('codigo_2fa');
    this.api.codigo = '';
    this.router.navigate(['/login']);
  }

  private lugaresGT = [
    "GUATEMALA", "SACATEPEQUEZ", "ESCUINTLA", "BAJA VERAPAZ", "ALTA VERAPAZ",
    "CHIMALTENANGO", "CHIQUIMULA", "EL PROGRESO", "HUEHUETENANGO", "IZABAL",
    "JALAPA", "JUTIAPA", "PETEN", "QUETZALTENANGO", "QUICHE", "RETALHULEU",
    "SAN MARCOS", "SANTA ROSA", "SOLOLA", "SUCHITEPEQUEZ", "TOTONICAPAN", "ZACAPA",
    "MAZATENANGO", "ANTIGUA", "MIXCO", "VILLA NUEVA", "ZONA", "CIUDAD",
    "CAPITAL", "AMATITLAN", "SAN JUAN", "SAN PEDRO", "SANTA CATARINA",
    "SANTIAGO", "SAN LUCAS", "SAN MIGUEL", "SANTA MARIA", "SAN RAYMUNDO",
    "SAN JOSE", "SAN VICENTE", "PUERTO BARRIOS", "CHICHICASTENANGO",
    "PANAJACHEL", "ATITLAN", "PACAYA", "HUITO", "FRAIJANES",
    "PALENCIA", "CHINAUTLA", "SANARATE", "BARBERENA", "CUILAPA",
    "SALAMA", "RABINAL", "CUBULCO", "SAN MIGUEL CHICAJ", "JOYABAJ"
  ];

  private validarLugar(texto: string): boolean {
    const t = texto.toUpperCase().trim();
    if (t.length < 3) return false;
    return this.lugaresGT.some(d => t.includes(d));
  }

  buscarRuta() {
    if (!this.origen || !this.destino) {
      Swal.fire({ icon: 'warning', title: 'Campos vacíos', text: 'Ingresa origen y destino', timer: 2500, showConfirmButton: false });
      return;
    }
    const o = this.origen.trim();
    const d = this.destino.trim();
    if (!this.validarLugar(o) || !this.validarLugar(d)) {
      Swal.fire({ icon: 'error', title: 'Lugar no válido', text: 'Ingresa un departamento o municipio de Guatemala válido', timer: 3000, showConfirmButton: false });
      return;
    }
    Swal.fire({ title: 'Buscando ruta...', text: 'Consultando en OpenStreetMap', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const urlOrigen = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(o)},Guatemala&limit=1`;
    const urlDestino = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(d)},Guatemala&limit=1`;
    this.http.get(urlOrigen).subscribe((res1: any) => {
      if (!res1 || res1.length === 0) {
        Swal.fire({ icon: 'error', title: 'Origen no encontrado', text: `"${o}" no es un lugar válido en Guatemala`, timer: 3000, showConfirmButton: false });
        return;
      }
      this.http.get(urlDestino).subscribe((res2: any) => {
        Swal.close();
        if (!res2 || res2.length === 0) {
          Swal.fire({ icon: 'error', title: 'Destino no encontrado', text: `"${d}" no es un lugar válido en Guatemala`, timer: 3000, showConfirmButton: false });
          return;
        }
        this.trazarRutaDinamica(L.latLng(res1[0].lat, res1[0].lon), L.latLng(res2[0].lat, res2[0].lon));
      });
    });
  }

  trazarRutaDinamica(p1: L.LatLng, p2: L.LatLng) {
    if (this.routingControl) this.mapa.removeControl(this.routingControl);
    this.routingControl = (L as any).Routing.control({
      waypoints: [p1, p2], show: false, addWaypoints: false,
      fitSelectedRoutes: true,
      lineOptions: { styles: [{ color: '#6366f1', weight: 6, opacity: 0.8 }] },
    }).addTo(this.mapa);
    this.routingControl.on('routesfound', (e: any) => {
      this.zone.run(() => {
        const s = e.routes[0].summary;
        const h = Math.floor(s.totalTime / 3600);
        const m = Math.floor((s.totalTime % 3600) / 60);
        this.infoRuta = {
          tiempo: h > 0 ? `${h}h ${m}m` : `${m} min`,
          distancia: (s.totalDistance / 1000).toFixed(1),
          horaLlegada: new Date(Date.now() + s.totalTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        this.rutaTrazada = true;
        this.cdr.detectChanges();
        this.speakText(`Ruta encontrada. Distancia: ${this.infoRuta.distancia} kilómetros. Tiempo estimado: ${this.infoRuta.tiempo}. Llegada a las ${this.infoRuta.horaLlegada}.`);
      });
    });
  }

  limpiarRuta() {
    if (this.routingControl) {
      this.mapa.removeControl(this.routingControl);
      this.rutaTrazada = false;
      this.origen = '';
      this.destino = '';
      this.infoRuta = null;
    }
    this.mapa.setView([14.634915, -90.506882], 7);
    window.speechSynthesis.cancel();
  }

  getColorPorEstado(estado: string): string {
  const e = (estado || '').toUpperCase().trim();
  // Primero buscamos Pesado/Congestionado
  if (e.includes('PESADO') || e.includes('PICO') || e.includes('CONGESTI') || e.includes('ALTA')) {
    return '#dc3545'; // Rojo
  }
  // Luego Moderado
  if (e.includes('MODERADO') || e.includes('MEDIO') || e.includes('NORMAL')) {
    return '#f59e0b'; // Naranja/Ambar
  }
  // Por defecto es Verde (Fluido)
  return '#10b981';
  }

  getTraficoColor(nivel: string): string {
    switch (nivel) {
      case 'critico': return '#ef4444';
      case 'alto': return '#f97316';
      case 'medio': return '#f59e0b';
      default: return '#10b981';
    }
  }

  selectChart(type: string) {
    this.selectedChart = type;
    setTimeout(() => this.renderChart(), 50);
  }

  renderChart() {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement!.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);
    if (this.selectedChart === 'bar') this.renderBarChart(ctx, W, H);
    else if (this.selectedChart === 'donut') this.renderDonutChart(ctx, W, H);
    else if (this.selectedChart === 'line') this.renderLineChart(ctx, W, H);
  }

  private renderBarChart(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const data = this.topCongestion.slice(0, 8);
    if (data.length === 0) {
      ctx.fillStyle = '#94a3b8'; ctx.font = '13px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Cargando datos...', W/2, H/2); return;
    }
    const maxVal = Math.max(...data.map((d: any) => d.vehiculos_ahora));
    const pad = { top: 18, right: 12, bottom: 36, left: 44 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const barW = chartW / data.length * 0.55;
    const gap = chartW / data.length;
    data.forEach((d: any, i: number) => {
      const x = pad.left + i * gap + (gap - barW) / 2;
      const h = (d.vehiculos_ahora / maxVal) * chartH;
      const y = pad.top + chartH - h;
      const color = d.nivel === 'critico' || d.nivel === 'alto' ? '#ef4444' : d.nivel === 'medio' ? '#f59e0b' : '#10b981';
      const grad = ctx.createLinearGradient(x, y, x, pad.top + chartH);
      grad.addColorStop(0, color); grad.addColorStop(1, color + '66');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, [3, 3, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#cbd5e1'; ctx.font = '600 9px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(d.nombre.substring(0, 6), x + barW/2, pad.top + chartH + 14);
      ctx.fillStyle = '#64748b'; ctx.font = '8px Inter, sans-serif';
      ctx.fillText((d.vehiculos_ahora / 1000).toFixed(0) + 'k', x + barW/2, y - 5);
    });
  }

  private renderDonutChart(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const data = this.topCongestion.slice(0, 6);
    if (data.length === 0) return;
    const total = data.reduce((s: number, d: any) => s + d.vehiculos_ahora, 0);
    if (total === 0) return;
    const cx = W / 2, cy = H / 2;
    const outerR = Math.min(W, H) * 0.3;
    const innerR = outerR * 0.5;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    let startAngle = -Math.PI / 2;
    data.forEach((d: any, i: number) => {
      const slice = (d.vehiculos_ahora / total) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
      ctx.arc(cx, cy, innerR, startAngle + slice, startAngle, true); ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      const mid = startAngle + slice / 2;
      if (slice > 0.2) {
        ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 9px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.nombre.substring(0, 5), cx + Math.cos(mid) * (outerR + 14), cy + Math.sin(mid) * (outerR + 14));
      }
      startAngle += slice;
    });
    ctx.fillStyle = '#f1f5f9'; ctx.font = 'bold 13px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((total / 1000).toFixed(0) + 'k', cx, cy - 5);
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px Inter, sans-serif';
    ctx.fillText('Total', cx, cy + 11);
  }

  private renderLineChart(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const data = Array.from({length: 24}, (_, h) => {
      let base: number;
      if ((h >= 7 && h <= 9) || (h >= 17 && h <= 19)) base = 150000 + Math.random() * 80000;
      else if (h >= 22 || h <= 5) base = 20000 + Math.random() * 30000;
      else base = 60000 + Math.random() * 50000;
      return Math.round(base);
    });
    const pad = { top: 18, right: 12, bottom: 28, left: 44 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const maxVal = Math.max(...data);
    const stepX = chartW / (data.length - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillStyle = '#64748b'; ctx.font = '8px Inter, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round((maxVal - (maxVal / 4) * i) / 1000) + 'k', pad.left - 5, y + 3);
    }
    ctx.beginPath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    grad.addColorStop(0, '#3b82f6'); grad.addColorStop(1, '#3b82f600');
    data.forEach((v, i) => {
      const x = pad.left + i * stepX;
      const y = pad.top + chartH - (v / maxVal) * chartH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(pad.left + (data.length - 1) * stepX, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    [0, 6, 12, 18, 23].forEach(h => {
      const x = pad.left + h * stepX;
      const y = pad.top + chartH - (data[h] / maxVal) * chartH;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#94a3b8'; ctx.font = '8px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(h + ':00', x, pad.top + chartH + 12);
    });
  }
}
