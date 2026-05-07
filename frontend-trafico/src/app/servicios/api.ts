import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  url = 'http://127.0.0.1:8000/api';
  datosTraficoActual: any = null;
  usuarioActual: string = localStorage.getItem('Usuario') || '';
  codigo: string = '';

  constructor(private http: HttpClient) { }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };
  }

  login(user: string, pass: string) {
    const body = { Nombre: user, Password: pass };
    return this.http.post(`${this.url}/login`, body);
  }

  register(user: string, pass: string, email: string) {
    const body = { Nombre: user, Password: pass, Correo: email };
    return this.http.post(`${this.url}/registrar`, body);
  }


  getTrafico(depto: string, user: string, code: string) {
    const headers = this.getHeaders();
    return this.http.get(
      `${this.url}/consultar/${depto}?usuario=${user}&codigo_ingresado=${code}`,
      headers
    );
  }


  getConteoPorDepto(depto: string) {
    return this.http.get(
      `${this.url}/conteo/${depto}`,
      this.getHeaders()
    );
  }
}