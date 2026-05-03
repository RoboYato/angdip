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
}

export interface UserAccessRuleContext {
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
  if (rule.role_required) {
    if (!rule.role || !user.roles.includes(rule.role)) {
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
    const need = rule.department?.trim();
    const got = user.department?.trim();
    if (!need || !got || got !== need) {
      return false;
    }
  }
  return true;
}

/** true, если хотя бы один набор выполнен; при пустом списке — false (используйте наследие ABAC снаружи). */
export function evaluateAccessRuleSets(
  user: UserAccessRuleContext,
  rules: AccessRuleSetRow[]
): boolean {
  if (!rules.length) {
    return false;
  }
  return rules.some((rule) => userMatchesAccessRuleSet(user, rule));
}
