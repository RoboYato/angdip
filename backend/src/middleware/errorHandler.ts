import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);

  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }

  res.status(500).json({ message: 'Internal server error' });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
};
