class ApiError extends Error {
    constructor(statusCode, message = "Something went wrong", errors = [], stack = "", success) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.message = message;
        this.data = null;
        this.success = success;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.contructor);
        }
    }
}

export { ApiError };