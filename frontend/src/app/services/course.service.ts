import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CourseService {
  private apiUrl = '/api/courses';

  constructor(private http: HttpClient) {}

  getCourses(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getCourseById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createCourse(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  updateCourse(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteCourse(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  addRoleToCourse(courseId: string, roleId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/role/add`, { courseId, roleId });
  }

  removeRoleFromCourse(courseId: string, roleId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${courseId}/role/${roleId}`);
  }

  addUserToCourse(courseId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/user/add`, { courseId, userId });
  }

  removeUserFromCourse(courseId: string, userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${courseId}/user/${userId}`);
  }

  enrollInCourse(courseId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${courseId}/enroll`, {});
  }

  getCourseModules(courseId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${courseId}/modules`);
  }
}
