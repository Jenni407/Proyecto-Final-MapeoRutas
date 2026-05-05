import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly url = 'http://127.0.0.1:8000/api';

  datosTraficoActual: any = null;
  usuarioActual: string = localStorage.getItem('usuario') || '';
  codigo: string = localStorage.getItem('codigo_2fa') || '';

  constructor(private http: HttpClient) {}

  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  login(user: string, pass: string) {
    return this.http.post(`${this.url}/login`, { Nombre: user, Password: pass });
  }

  register(user: string, pass: string, email: string) {
    return this.http.post(`${this.url}/registrar`, {
      Nombre: user,
      Password: pass,
      Correo: email,
    });
  }

  /** Estado del vial con autenticación 2FA */
  getTrafico(depto: string, user: string, code: string) {
    return this.http.get(
      `${this.url}/consultar/${depto}?usuario=${user}&codigo_ingresado=${code}`
    );
  }

  /**
   * Conteo por tipo de vehículo desde SQL Server.
   * Retorna: { carros, motos, camiones, camionetas, pickups, total }
   */
  getVehicularPorDepto(depto: string) {
    return this.http.get(`${this.url}/vehicular/${depto}`);
  }

  /** Alias para compatibilidad hacia atrás */
  getConteoPorDepto(depto: string) {
    return this.getVehicularPorDepto(depto);
  }
}
