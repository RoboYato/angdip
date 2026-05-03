import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { pool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

// GET /api/tests/course/:courseId — тесты курса (для пользователя и админа)
export async function getTestsByCourse(req: AuthRequest, res: Response) {
  try {
    const { courseId } = req.params;
    const userId = req.user?.userId;

    const testsResult = await pool.query(
      `SELECT t.*,
         (SELECT COUNT(*)::int FROM test_questions tq WHERE tq.test_id = t.id) as questions_count
       FROM tests t
       WHERE t.course_id = $1
       ORDER BY t.created_at ASC`,
      [courseId]
    );

    // Для каждого теста добавим последний результат пользователя
    const tests = [];
    for (const test of testsResult.rows) {
      let lastResult = null;
      if (userId) {
        const resResult = await pool.query(
          `SELECT score, passed, completed_at FROM user_test_results
           WHERE user_id = $1 AND test_id = $2
           ORDER BY completed_at DESC LIMIT 1`,
          [userId, test.id]
        );
        if (resResult.rows.length > 0) lastResult = resResult.rows[0];
      }
      tests.push({ ...test, last_result: lastResult });
    }

    res.json(tests);
  } catch (error) {
    console.error('Get tests by course error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/tests/:testId — получить тест с вопросами и вариантами ответов
export async function getTestWithQuestions(req: AuthRequest, res: Response) {
  try {
    const { testId } = req.params;

    const testResult = await pool.query(
      `SELECT t.*, c.title as course_title
       FROM tests t
       LEFT JOIN courses c ON t.course_id = c.id
       WHERE t.id = $1`,
      [testId]
    );
    if (testResult.rows.length === 0) {
      return res.status(404).json({ message: 'Тест не найден' });
    }
    const test = testResult.rows[0];

    const questionsResult = await pool.query(
      `SELECT * FROM test_questions WHERE test_id = $1 ORDER BY order_num ASC`,
      [testId]
    );

    const questions = [];
    for (const q of questionsResult.rows) {
      const answersResult = await pool.query(
        `SELECT id, answer_text, order_num FROM test_answers WHERE question_id = $1 ORDER BY order_num ASC`,
        [q.id]
      );
      questions.push({ ...q, answers: answersResult.rows });
    }

    // Последний результат текущего пользователя
    let lastResult = null;
    if (req.user?.userId) {
      const resResult = await pool.query(
        `SELECT * FROM user_test_results WHERE user_id = $1 AND test_id = $2 ORDER BY completed_at DESC LIMIT 1`,
        [req.user.userId, testId]
      );
      if (resResult.rows.length > 0) lastResult = resResult.rows[0];
    }

    res.json({ ...test, questions, last_result: lastResult });
  } catch (error) {
    console.error('Get test with questions error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/tests — все тесты (admin)
export async function getAllTests(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const testsResult = await pool.query(
      `SELECT t.*,
         c.title as course_title,
         (SELECT COUNT(*)::int FROM test_questions tq WHERE tq.test_id = t.id) as questions_count,
         (SELECT COUNT(*)::int FROM user_test_results utr WHERE utr.test_id = t.id) as attempts_count
       FROM tests t
       LEFT JOIN courses c ON t.course_id = c.id
       ORDER BY t.created_at DESC`
    );

    res.json(testsResult.rows);
  } catch (error) {
    console.error('Get all tests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE /api/tests/:testId (admin)
export async function deleteTest(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const { testId } = req.params;
    const result = await pool.query('DELETE FROM tests WHERE id = $1 RETURNING id', [testId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Тест не найден' });
    }
    res.json({ message: 'Тест удалён' });
  } catch (error) {
    console.error('Delete test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// DELETE question
export async function deleteQuestion(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    const { questionId } = req.params;
    await pool.query('DELETE FROM test_questions WHERE id = $1', [questionId]);
    res.json({ message: 'Вопрос удалён' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createTest(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { courseId, title, description, testType } = req.body;

    if (!courseId || !title || !testType) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const testId = uuidv4();

    const testResult = await pool.query(
      `INSERT INTO tests (id, course_id, title, description, test_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [testId, courseId, title, description || null, testType, req.user.userId]
    );

    res.status(201).json(testResult.rows[0]);
  } catch (error) {
    console.error('Create test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function addQuestionToTest(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { testId, questionText, questionType } = req.body;

    if (!testId || !questionText) {
      return res.status(400).json({ message: 'Test ID and question text required' });
    }

    // Get max order
    const orderResult = await pool.query(
      'SELECT MAX(order_num) as max_order FROM test_questions WHERE test_id = $1',
      [testId]
    );
    const orderNum = (orderResult.rows[0]?.max_order || 0) + 1;

    const questionId = uuidv4();

    const questionResult = await pool.query(
      `INSERT INTO test_questions (id, test_id, question_text, question_type, order_num)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [questionId, testId, questionText, questionType || null, orderNum]
    );

    res.status(201).json(questionResult.rows[0]);
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function addAnswerToQuestion(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { questionId, answerText, isCorrect } = req.body;

    if (!questionId || !answerText) {
      return res.status(400).json({ message: 'Question ID and answer text required' });
    }

    // Get max order
    const orderResult = await pool.query(
      'SELECT MAX(order_num) as max_order FROM test_answers WHERE question_id = $1',
      [questionId]
    );
    const orderNum = (orderResult.rows[0]?.max_order || 0) + 1;

    const answerId = uuidv4();

    const answerResult = await pool.query(
      `INSERT INTO test_answers (id, question_id, answer_text, is_correct, order_num)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [answerId, questionId, answerText, isCorrect || false, orderNum]
    );

    res.status(201).json(answerResult.rows[0]);
  } catch (error) {
    console.error('Add answer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function submitTestAnswers(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { testId, answers } = req.body;
    // answers = { questionId: answerId } for single/multiple choice
    // answers = { questionId: "text" } for text_input

    if (!testId || !answers) {
      return res.status(400).json({ message: 'Test ID and answers required' });
    }

    // Get total questions
    const questionsResult = await pool.query(
      `SELECT tq.id, tq.question_type FROM test_questions tq WHERE tq.test_id = $1`,
      [testId]
    );
    const totalQuestions = questionsResult.rows.length;
    if (totalQuestions === 0) {
      return res.status(400).json({ message: 'Тест не содержит вопросов' });
    }

    let correctCount = 0;

    for (const q of questionsResult.rows) {
      const userAnswer = answers[q.id];
      if (!userAnswer) continue;

      if (q.question_type === 'text_input') {
        // Текстовый ответ: сравниваем с правильными ответами (case-insensitive, trim)
        const correctResult = await pool.query(
          'SELECT answer_text FROM test_answers WHERE question_id = $1 AND is_correct = true',
          [q.id]
        );
        const userText = String(userAnswer).trim().toLowerCase();
        const isCorrect = correctResult.rows.some(
          (r: any) => r.answer_text && r.answer_text.trim().toLowerCase() === userText
        );
        if (isCorrect) correctCount++;
      } else if (q.question_type === 'multiple_choice') {
        // Множественный выбор: userAnswer = [answerId1, answerId2, ...]
        const correctResult = await pool.query(
          'SELECT id FROM test_answers WHERE question_id = $1 AND is_correct = true',
          [q.id]
        );
        const correctIds = new Set(correctResult.rows.map((r: any) => r.id));
        const userIds = new Set(Array.isArray(userAnswer) ? userAnswer : [userAnswer]);
        // Правильно если совпадают множества
        if (correctIds.size === userIds.size && [...correctIds].every(id => userIds.has(id))) {
          correctCount++;
        }
      } else {
        // single_choice: userAnswer = answerId
        const correctResult = await pool.query(
          'SELECT id FROM test_answers WHERE question_id = $1 AND is_correct = true',
          [q.id]
        );
        const correctIds = correctResult.rows.map((r: any) => r.id);
        if (correctIds.includes(userAnswer)) {
          correctCount++;
        }
      }
    }

    const score = Math.round((correctCount / totalQuestions) * 100);
    const passed = score >= 70;

    const resultId = uuidv4();

    const resultResult = await pool.query(
      `INSERT INTO user_test_results (id, user_id, test_id, score, passed, completed_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [resultId, req.user.userId, testId, score, passed]
    );

    res.json({
      ...resultResult.rows[0],
      correct_count: correctCount,
      total_questions: totalQuestions
    });
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getTestResults(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { testId } = req.params;

    const resultsResult = await pool.query(
      `SELECT * FROM user_test_results
       WHERE user_id = $1 AND test_id = $2
       ORDER BY completed_at DESC`,
      [req.user.userId, testId]
    );

    res.json(resultsResult.rows);
  } catch (error) {
    console.error('Get test results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
