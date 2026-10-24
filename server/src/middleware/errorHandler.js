const errorHandler = (err, req, res, next) => {
  const uploadStatus = err.code === 'LIMIT_FILE_SIZE' ? 413
    : err.code?.startsWith('LIMIT_') ? 400
      : null;
  const statusCode = err.statusCode || uploadStatus || (err.name === 'ZodError' ? 400 : 500);
  const message = statusCode >= 500 ? 'Internal Server Error'
    : err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 1 MiB upload limit'
      : err.message || 'Request failed';

  console.error(`[${new Date().toISOString()}] ${statusCode} ${err.message || message}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
  });
};

module.exports = errorHandler;
