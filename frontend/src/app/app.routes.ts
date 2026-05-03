import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

// Auth components
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';

// User components
import { UserCoursesComponent } from './components/user-courses/user-courses.component';
import { UserProgressComponent } from './components/user-progress/user-progress.component';
import { UserDocumentationComponent } from './components/user-documentation/user-documentation.component';
import { CourseDetailComponent } from './components/course-detail/course-detail.component';
import { MaterialViewComponent } from './components/material-view/material-view.component';
import { UserTestComponent } from './components/user-test/user-test.component';

// Admin components
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { AdminCoursesComponent } from './components/admin-courses/admin-courses.component';
import { AdminUsersComponent } from './components/admin-users/admin-users.component';
import { AdminRolesComponent } from './components/admin-roles/admin-roles.component';
import { AdminProgressComponent } from './components/admin-progress/admin-progress.component';
import { AdminMaterialsComponent } from './components/admin-materials/admin-materials.component';
import { AdminAuditComponent } from './components/admin-audit/admin-audit.component';
import { AdminTestsComponent } from './components/admin-tests/admin-tests.component';

import { AdminPositionsComponent } from './components/admin-positions.component/admin-positions.component'; // 🟢 ДОБАВИТЬ


import { ResponsibleDashboardComponent } from './components/responsible-dashboard/responsible-dashboard.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // User routes
  {
    path: 'user',
    component: UserCoursesComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: false }
  },
  {
    path: 'user/course/:id',
    component: CourseDetailComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: false }
  },
  {
    path: 'user/material/:id',
    component: MaterialViewComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: false }
  },
  {
    path: 'user/progress',
    component: UserProgressComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: false }
  },
  {
    path: 'user/documentation',
    component: UserDocumentationComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: false, requireDocumentationRole: true }
  },
  {
    path: 'user/document/:id',
    component: MaterialViewComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: false, requireDocumentationRole: true }
  },
  {
    path: 'user/test/:testId',
    component: UserTestComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: false }
  },

  // Admin routes
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },
  {
    path: 'admin/courses',
    component: AdminCoursesComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },
  {
    path: 'admin/materials',
    component: AdminMaterialsComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },
  {
    path: 'admin/users',
    component: AdminUsersComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },
  {
    path: 'admin/roles',
    component: AdminRolesComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },
  {
    path: 'admin/access-levels',
    component: AdminRolesComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },
  {
    path: 'admin/progress',
    component: AdminProgressComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },
  {
    path: 'admin/audit',
    component: AdminAuditComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },
  {
    path: 'admin/tests',
    component: AdminTestsComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true }
  },

  // 🟢 НОВЫЙ МАРШРУТ ДЛЯ ДАШБОРДА ОТВЕТСТВЕННОГО
{
  path: 'responsible/dashboard',
  component: ResponsibleDashboardComponent,
  canActivate: [AuthGuard],
  data: { title: 'Дашборд ответственного' }
},

 // 🟢 НОВЫЙ МАРШРУТ ДЛЯ ДОЛЖНОСТЕЙ
  {
    path: 'admin/positions',
    component: AdminPositionsComponent,
    canActivate: [AuthGuard],
    data: { adminOnly: true, title: 'Управление должностями' }
  },

  { path: '', redirectTo: 'user', pathMatch: 'full' },
  { path: '**', redirectTo: 'user' }
];
