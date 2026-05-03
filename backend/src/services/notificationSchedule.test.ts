import assert from 'assert';
import { getNotificationSchedule } from './notificationSchedule';

assert.deepStrictEqual(getNotificationSchedule(100), [1, 0]);
assert.deepStrictEqual(getNotificationSchedule(90), [1, 0]);
assert.deepStrictEqual(getNotificationSchedule(70), [7, 4, 1, 0]);
assert.deepStrictEqual(getNotificationSchedule(60), [7, 4, 1, 0]);
assert.deepStrictEqual(getNotificationSchedule(59), [14, 12, 10, 8, 6, 4, 2, 0]);
assert.deepStrictEqual(getNotificationSchedule(null), [14, 12, 10, 8, 6, 4, 2, 0]);

console.log('notificationSchedule tests: OK');
