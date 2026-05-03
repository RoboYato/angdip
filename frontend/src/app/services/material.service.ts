import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MaterialService {
  private apiUrl = '/api/materials';

  constructor(private http: HttpClient) {}

  getMaterialById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  unlockMaterial(id: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/unlock`, { password });
  }

  createMaterial(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  updateMaterial(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteMaterial(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  uploadFile(materialId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('materialId', materialId);
    return this.http.post(`${this.apiUrl}/upload`, formData);
  }

  deleteFile(fileId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/file/${fileId}`);
  }

  /** Скачивание / открытие вложения (авторизация через cookie / заголовок, как у остальных API) */
  getFileDownloadUrl(fileId: string): string {
    return `${this.apiUrl}/files/${fileId}/download`;
  }

  /** Скачивание с JWT (интерцептор); для открытия во вкладке используйте blob URL. */
  downloadMaterialFile(fileId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/files/${fileId}/download`, { responseType: 'blob' });
  }

  /** Загрузка картинки для rich-text (ответ: { url: '/uploads/...' }) */
  uploadImage(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/upload-image`, formData);
  }

  /**
   * URL для вставки в HTML редактора: при `ng serve` с proxy относительный /uploads/... уходит на бэкенд.
   * Если фронт и API на разных origin без proxy — задайте полный базовый URL в окружении.
   */
  resolveEditorImageUrl(url: string): string {
    if (!url) {
      return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return url.startsWith('/') ? url : `/${url}`;
  }

  addRoleToMaterial(materialId: string, roleId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/role/add`, { materialId, roleId });
  }

  removeRoleFromMaterial(materialId: string, roleId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${materialId}/role/${roleId}`);
  }

  addUserToMaterial(materialId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user/add`, { materialId, userId });
  }

  removeUserFromMaterial(materialId: string, userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${materialId}/user/${userId}`);
  }

  markAsCompleted(materialId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${materialId}/complete`, {});
  }

  getDocumentation(): Observable<any> {
    return this.http.get(`${this.apiUrl}/documentation`);
  }

  getMaterials(): Observable<any> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getResponsibleStatsDetailed(): Observable<any[]> {
  return this.http.get<any[]>('/api/admin/responsible-stats/detailed');
}

  getResponsibleStats(docId?: string | null): Observable<any[]> {
  const url = docId 
    ? `/api/admin/responsible-stats/${docId}`
    : '/api/admin/responsible-stats';
  return this.http.get<any[]>(url);
}



}
