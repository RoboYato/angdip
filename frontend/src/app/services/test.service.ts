import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TestService {
  private apiUrl = '/api/tests';

  constructor(private http: HttpClient) {}

  // Все тесты (admin)
  getAllTests(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Тесты конкретного курса
  getTestsByCourse(courseId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/course/${courseId}`);
  }

  // Тест с вопросами и вариантами ответов
  getTestWithQuestions(testId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${testId}`);
  }

  // Создать тест (admin)
  createTest(data: { courseId: string; title: string; description?: string; testType: string }): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  // Удалить тест (admin)
  deleteTest(testId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${testId}`);
  }

  // Добавить вопрос (admin)
  addQuestion(data: { testId: string; questionText: string; questionType: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/question/add`, data);
  }

  // Удалить вопрос (admin)
  deleteQuestion(questionId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/question/${questionId}`);
  }

  // Добавить вариант ответа (admin)
  addAnswer(data: { questionId: string; answerText: string; isCorrect: boolean }): Observable<any> {
    return this.http.post(`${this.apiUrl}/answer/add`, data);
  }

  // Отправить ответы на тест (user)
  submitTest(testId: string, answers: { [questionId: string]: any }): Observable<any> {
    return this.http.post(`${this.apiUrl}/submit`, { testId, answers });
  }

  // Результаты теста (user)
  getTestResults(testId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${testId}/results`);
  }
}
