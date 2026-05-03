/**
 * Запуск: npx ts-node --transpile-only src/services/accessRuleSets.test.ts
 */
import assert from 'assert';
import {
  evaluateAccessRuleSets,
  userMatchesAccessRuleSet,
  type AccessRuleSetRow,
  type UserAccessRuleContext
} from './accessRuleSets';

const u: UserAccessRuleContext = {
  userId: 'u1',
  roles: ['табельщик'],
  accessLevelCodes: ['CONFIDENTIAL'],
  positionText: null,
  positionId: null,
  positionName: null
};

const ruleTabDSP: AccessRuleSetRow = {
  role: 'табельщик',
  classification: 'CONFIDENTIAL',
  position: null,
  role_required: true,
  classification_required: true,
  position_required: false
};

assert.strictEqual(userMatchesAccessRuleSet(u, ruleTabDSP), true);
assert.strictEqual(
  evaluateAccessRuleSets(u, [
    ruleTabDSP,
    {
      role: 'секретарь',
      classification: 'SECRET',
      position: null,
      role_required: true,
      classification_required: true,
      position_required: false
    }
  ]),
  true
);

const wrongClearance: UserAccessRuleContext = {
  ...u,
  accessLevelCodes: ['SECRET']
};
assert.strictEqual(userMatchesAccessRuleSet(wrongClearance, ruleTabDSP), false);

const posRule: AccessRuleSetRow = {
  role: 'табельщик',
  classification: 'CONFIDENTIAL',
  position: 'pos-uuid-1',
  role_required: true,
  classification_required: true,
  position_required: true
};
assert.strictEqual(
  userMatchesAccessRuleSet(
    { ...u, positionId: 'pos-uuid-1' },
    posRule
  ),
  true
);
assert.strictEqual(
  userMatchesAccessRuleSet(
    { ...u, positionName: 'Специалист' },
    { ...posRule, position: 'Специалист' }
  ),
  true
);

assert.strictEqual(evaluateAccessRuleSets(u, []), false);

console.log('accessRuleSets tests: OK');
