/**
 * Логика проверки наборов правил доступа к материалу (OR по наборам).
 * Вынесено в отдельный модуль для тестирования и переиспользования из ABAC.
 */

export interface AccessRuleSetRow {
  role: string | null;
  classification: string | null;
  position: string | null;
  /** Отдел (как в профиле пользователя), если включена проверка */
  department?: string | null;
  role_required: boolean;
  classification_required: boolean;
  position_required: boolean;
  department_required?: boolean;
  /** Если задан — доступ только у этого пользователя (ответственный за набор). */
  responsible_user_id?: string | null;
  /** Срок ознакомления: доступ, пока дата строго в будущем. */
  deadline?: string | Date | null;
  /** Хеш пароля (только на сервере); не передавать клиенту. */
  access_password_hash?: string | null;
}

export interface UserAccessRuleContext {
  /** id пользователя (для проверки ответственного) */
  userId: string;
  /** Имена ролей пользователя */
  roles: string[];
  /** Коды уровней доступа (грифов), назначенных пользователю */
  accessLevelCodes: string[];
  /** Подразделение пользователя */
  department?: string | null;
  /** Текстовое поле должности в профиле */
  positionText?: string | null;
  /** UUID должности в профиле */
  positionId?: string | null;
  /** Имя должности из справочника positions */
  positionName?: string | null;
}

export function userMatchesAccessRuleSet(
  user: UserAccessRuleContext,
  rule: AccessRuleSetRow
): boolean {
  if (rule.deadline != null && String(rule.deadline).trim() !== '') {
    const t = new Date(rule.deadline as string).getTime();
    if (!Number.isNaN(t) && t <= Date.now()) {
      return false;
    }
  }
  const resp = rule.responsible_user_id?.trim();
  if (resp && /^[0-9a-fA-F-]{36}$/.test(resp) && resp !== user.userId) {
    return false;
  }
  if (rule.role_required) {
    const need = rule.role?.trim();
    if (!need) {
      return false;
    }
    const ok = user.roles.some((rn) => (rn || '').trim().toLowerCase() === need.toLowerCase());
    if (!ok) {
      return false;
    }
  }
  if (rule.classification_required) {
    if (!rule.classification || !user.accessLevelCodes.includes(rule.classification)) {
      return false;
    }
  }
  if (rule.position_required) {
    if (!rule.position) {
      return false;
    }
    const r = rule.position;
    const byText = user.positionText != null && user.positionText === r;
    const byId = user.positionId != null && String(user.positionId) === String(r);
    const byName = user.positionName != null && user.positionName === r;
    if (!byText && !byId && !byName) {
      return false;
    }
  }
  if (rule.department_required) {
    const need = rule.department?.trim()?.toLowerCase();
    const got = user.department?.trim()?.toLowerCase();
    if (!need || !got || got !== need) {
      return false;
    }
  }
  return true;
}

/**
 * OR по наборам: подходит любой набор, у которого выполнены атрибуты.
 * Пароль: если у набора есть хеш, доступ только при hasPasswordUnlock (material_users).
 */
export function evaluateMaterialAbacAccess(
  user: UserAccessRuleContext,
  rules: AccessRuleSetRow[],
  hasPasswordUnlock: boolean
): boolean {
  if (!rules.length) {
    return false;
  }
  for (const rule of rules) {
    if (!userMatchesAccessRuleSet(user, rule)) {
      continue;
    }
    const hash = rule.access_password_hash?.trim();
    if (hash) {
      if (hasPasswordUnlock) {
        return true;
      }
      continue;
    }
    return true;
  }
  return false;
}

/** true, если хотя бы один набор выполнен по атрибутам (без учёта пароля набора). */
export function evaluateAccessRuleSets(
  user: UserAccessRuleContext,
  rules: AccessRuleSetRow[]
): boolean {
  if (!rules.length) {
    return false;
  }
  return rules.some((rule) => userMatchesAccessRuleSet(user, rule));
}

/** Документация в списке: без разблокировки скрывать наборы только с паролем. */
export function documentationVisibleForUser(
  user: UserAccessRuleContext,
  rules: AccessRuleSetRow[],
  hasPasswordUnlock: boolean
): boolean {
  return evaluateMaterialAbacAccess(user, rules, hasPasswordUnlock);
}

/** Фильтр по полям материала (legacy), если наборов правил нет. */
export function legacyDocumentationDepartmentsPositionsOk(
  userDept: string,
  userPosId: string,
  userPosText: string,
  requiredDepartments: unknown,
  requiredPositions: unknown
): boolean {
  const reqDept = normalizeJsonStringArray(requiredDepartments);
  const reqPos = normalizeJsonStringArray(requiredPositions);
 const deptOk = reqDept.length === 0 ||
  (userDept.length > 0 && reqDept.some(d => d.trim().toLowerCase() === userDept.trim().toLowerCase()));
const posOk = reqPos.length === 0 ||
  (userPosId.length > 0 && reqPos.some(p => p.trim() === userPosId.trim())) ||
  (userPosText.length > 0 && reqPos.some(p => p.trim().toLowerCase() === userPosText.trim().toLowerCase()));
  return deptOk && posOk;
}

function normalizeJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x));
  }
  if (typeof raw === 'string' && raw) {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map((x: unknown) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}
