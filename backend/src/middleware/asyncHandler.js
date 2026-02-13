export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const withUpload = (uploadMiddleware, fn) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) return next(err);
    Promise.resolve(fn(req, res, next)).catch(next);
  });
};
