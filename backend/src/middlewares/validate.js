import AppError from '../utils/AppError.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return next(new AppError('Validation failed', 400, fieldErrors));
    }
    req.body = result.data;
    next();
  };
}
