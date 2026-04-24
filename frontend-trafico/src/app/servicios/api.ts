import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  url = 'http://127.0.0.1:8000/api'; // URL base de tu API
  
  // Añadimos esta variable para guardar la info temporalmente
  datosTraficoActual: any = null; 
  usuarioActual: string = '';
  codigo: string = '';

  constructor(private http: HttpClient) { }

login(user: string, pass: string) {

    const body = { 
      Nombre: user, 
      Password: pass   
    };
    return this.http.post(`${this.url}/login`, body);
  }
  register(user: string, pass: string, email: string) {
    const body = { 
      Nombre: user,
      Password: pass,
      Correo: email
    };
  return this.http.post(`${this.url}/registrar`, body);
}

  getTrafico(depto: string, user: string, code: string) {
   return this.http.get(`${this.url}/consultar/${depto}?usuario=${user}&codigo_ingresado=${code}`);
  }

getConteoPorDepto(depto: string) {
// Usamos la variable this.url para ser consistentes
    return this.http.get(`${this.url}/conteo/${depto}`);
}

}
